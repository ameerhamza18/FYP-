"""Unit tests: URL intelligence analyzer."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.url_intelligence.analyzer import analyze_url


def test_legit_domain_scores_low():
    r = analyze_url("https://www.hbl.com/ebanking/login")
    assert r["score"] < 30


def test_ip_literal_host_flagged():
    r = analyze_url("http://192.168.13.37/verify/account")
    assert any(i["title"] == "IP-literal host" for i in r["indicators"])
    assert r["score"] >= 30


def test_suspicious_tld_flagged():
    r = analyze_url("http://prize-center.tk/claim")
    assert any(".tk" in i["title"] for i in r["indicators"])


def test_shortener_flagged():
    r = analyze_url("https://bit.ly/3xY2zQ")
    assert any(i["title"] == "URL shortener" for i in r["indicators"])


def test_punycode_flagged():
    r = analyze_url("https://xn--pypal-4ve.com/login")
    assert any(i["title"] == "Punycode (IDN) domain" for i in r["indicators"])


def test_brand_keyword_in_domain():
    r = analyze_url("http://jazzcash-winner-claim.xyz/")
    assert any(i["title"] == "Brand keyword in URL" for i in r["indicators"])


def test_at_trick_flagged():
    r = analyze_url("http://hbl.com@evil-secure-login.top/account")
    assert any("@" in i["title"] or "Credential-style" in i["title"] for i in r["indicators"])


def test_empty_url():
    r = analyze_url("")
    assert r["score"] == 0.0 and r["indicators"] == []
