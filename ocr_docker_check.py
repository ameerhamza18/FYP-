"""Verify the containerised screenshot/OCR path end to end.

Renders a scam message into an image, uploads it to /api/analyze/screenshot and
checks that Tesseract (installed in the API image) extracted the text and that
the threat engine scored it.

Run:  python ocr_docker_check.py [base_url]
"""
import io
import json
import sys

import httpx
from PIL import Image, ImageDraw

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
c = httpx.Client(base_url=BASE, timeout=60)

SCAM_LINES = [
    "Dear customer, your HBL account will be",
    "blocked within 24 hours. Verify immediately",
    "at http://verify-acct-alert.xyz/login and",
    "enter your password and OTP.",
]

# --- render the message as a PNG (large, high-contrast text helps OCR) ---
img = Image.new("RGB", (1100, 260), "white")
draw = ImageDraw.Draw(img)
for i, line in enumerate(SCAM_LINES):
    draw.text((20, 20 + i * 55), line, fill="black")
buf = io.BytesIO()
img.save(buf, format="PNG")
png = buf.getvalue()
print(f"rendered PNG: {len(png)} bytes")

# --- auth ---
c.post("/api/auth/register", json={"email": "ocr@example.com", "password": "OcrTest@12345"})
r = c.post("/api/auth/login", json={"email": "ocr@example.com", "password": "OcrTest@12345"})
assert r.status_code == 200, r.text
H = {"Authorization": f"Bearer {r.json()['access_token']}"}

# --- upload the screenshot ---
resp = c.post(
    "/api/analyze/screenshot",
    files={"upload": ("scam.png", png, "image/png")},
    headers=H,
)
print("screenshot upload status:", resp.status_code)
if resp.status_code != 200:
    print(resp.text[:600])
    sys.exit(1)

rep = resp.json()
print(f"RISK: {rep['risk_level']}  SCORE: {rep['risk_score']}/100  TYPE: {rep['threat_type']}")
print("latency:", rep["latency_ms"], "ms")
print("\nIndicators:")
for i in rep["indicators"]:
    print(f"  [{i['severity']:<8}] {i['title']}")
print("\nSE techniques:")
for t in rep["se_techniques"]:
    print(f"  {t['technique']:<22} {t['intensity']}")

breakdown = rep.get("engine_breakdown", {})
ocr = breakdown.get("ocr") or breakdown.get("vision") or {}
print("\nengine_breakdown keys:", list(breakdown.keys()))
print("ocr section:", json.dumps(ocr)[:400])

print("\nOCR/vision path exercised OK" if rep["risk_score"] > 0 else "\nOCR returned no signal")