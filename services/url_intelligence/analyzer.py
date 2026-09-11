"""URL risk analyzer.

Performs deterministic, explainable URL analysis — no live network requests
are required (safe-by-default; live reputation feeds can be plugged into
``threat_intel``). Detects IP-literal hosts, punycode tricks, suspicious
TLDs, shorteners, brand impersonation, typosquatting and more.
"""
import ipaddress
import re
from typing import Dict, List
from urllib.parse import urlparse

SUSPICIOUS_TLDS = {
    "tk", "ml", "ga", "cf", "gq", "xyz", "top", "buzz", "click", "link",
    "fit", "rest", "icu", "cyou", "sbs", "zip", "mov", "work", "loan", "cam",
}
SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "rb.gy",
    "shorturl.at", "tiny.cc", "rebrand.ly", "bit.do", "adf.ly",
}
BRAND_DOMAINS = {
    "paypal.com", "google.com", "facebook.com", "whatsapp.com", "apple.com",
    "microsoft.com", "amazon.com", "netflix.com", "hbl.com", "ubl.com.pk",
    "meezanbank.com", "jazzcash.com.pk", "easypaisa.com.pk", "nadra.gov.pk",
    "fbr.gov.pk", "daraz.pk", "telenor.com.pk", "zong.com.pk",
}
BRAND_KEYWORDS = [
    "paypal", "jazzcash", "easypaisa", "hbl", "ubl", "meezan", "nadra",
    "fbr", "daraz", "netflix", "facebook", "whatsapp", "apple", "icloud",
    "google", "amazon", "microsoft", "outlook", "gmail",
]


def _levenshtein(a: str, b: str, cap: int = 3) -> int:
    if abs(len(a) - len(b)) > cap:
        return cap + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _registered_domain(host: str) -> str:
    parts = host.lower().split(".")
    if len(parts) <= 2:
        return host.lower()
    if parts[-2] in {"co", "com", "org", "gov", "net"} and parts[-1] in {"uk", "pk", "in", "au"}:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def analyze_url(url: str) -> Dict:
    """Analyze a URL and return score (0-100), indicators and features."""
    indicators: List[Dict] = []
    url = (url or "").strip()
    if not url:
        return {"score": 0.0, "indicators": [], "features": {}}
    if not url.lower().startswith(("http://", "https://")):
        url = "http://" + url

    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
    except ValueError:
        return {
            "score": 70.0,
            "indicators": [{"severity": "HIGH", "title": "Malformed URL",
                            "detail": "The URL could not be parsed safely."}],
            "features": {},
        }

    if not host:
        return {
            "score": 70.0,
            "indicators": [{"severity": "HIGH", "title": "Missing host",
                            "detail": "URL has no resolvable host component."}],
            "features": {},
        }

    score = 0.0
    path = (parsed.path or "").lower() + (parsed.query or "").lower()

    def add(severity: str, title: str, detail: str, weight: float) -> None:
        nonlocal score
        indicators.append({"severity": severity, "title": title, "detail": detail})
        score += weight

    # --- IP literal host ---
    try:
        ipaddress.ip_address(host)
        add("HIGH", "IP-literal host",
            f"URL uses a raw IP address ({host}) instead of a domain name.", 30)
    except ValueError:
        pass

    # --- Plain HTTP ---
    if parsed.scheme == "http":
        add("MEDIUM", "Insecure transport (HTTP)",
            "Credentials submitted over plain HTTP can be intercepted.", 12)

    # --- Suspicious TLD ---
    tld = host.rsplit(".", 1)[-1]
    if tld in SUSPICIOUS_TLDS:
        add("HIGH", f"Suspicious TLD .{tld}",
            "This top-level domain is frequently abused for phishing.", 22)

    # --- URL shortener ---
    if host in SHORTENERS or _registered_domain(host) in SHORTENERS:
        add("MEDIUM", "URL shortener",
            "Shortened URLs hide the real destination.", 15)

    # --- Punycode / homograph ---
    if "xn--" in host:
        add("HIGH", "Punycode (IDN) domain",
            "Domain uses internationalized encoding often used for look-alike attacks.", 28)

    # --- Brand impersonation / typosquatting ---
    reg = _registered_domain(host)
    if reg not in BRAND_DOMAINS:
        for kw in BRAND_KEYWORDS:
            if kw in host:
                add("HIGH", "Brand keyword in URL",
                    f"Domain '{host}' references brand '{kw}' without being its official domain.", 25)
                break
        for brand in BRAND_DOMAINS:
            brand_name = brand.split(".")[0]
            reg_name = reg.split(".")[0]
            if len(brand_name) >= 5 and 0 < _levenshtein(reg_name, brand_name, cap=3) <= 2:
                add("CRITICAL", "Typosquatting suspected",
                    f"'{reg}' closely resembles '{brand}'.", 35)
                break

    # --- Excessive subdomains / hyphens ---
    sub_count = max(0, len(host.split(".")) - 2)
    if sub_count >= 3:
        add("MEDIUM", "Excessive subdomains",
            f"Host has {sub_count} subdomain levels — common in phishing kits.", 12)
    if host.count("-") >= 3:
        add("LOW", "Many hyphens in host", "Hyphen-rich domains are typical of disposable hosts.", 8)

    # --- URL length + '@' trick + non-standard port ---
    if len(url) > 100:
        add("LOW", "Unusually long URL", f"URL length is {len(url)} characters.", 6)
    if "@" in url.split("//", 1)[-1].split("/")[0]:
        add("HIGH", "Credential-style '@' in URL",
            "The text before '@' is ignored by browsers — classic spoofing trick.", 25)
    if parsed.port and parsed.port not in (80, 443):
        add("MEDIUM", "Non-standard port", f"URL targets port {parsed.port}.", 10)

    # --- Credential-themed path keywords ---
    if re.search(r"(login|verify|secure|update|account|confirm|signin|webscr|banking)", path):
        add("MEDIUM", "Credential-themed path",
            "Path contains credential-harvesting keywords.", 10)

    score = min(100.0, score)
    return {"score": round(score, 1), "indicators": indicators, "features": {"host": host, "tld": tld}}

