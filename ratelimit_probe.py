"""Probe the analyze rate limiter on a running TrustLayer API.

Sends N rapid /api/analyze/url requests and reports each status code, so we can
confirm whether a 429 is what breaks demo_live.py step 5.

Run:  python ratelimit_probe.py [base_url] [count]
"""
import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 14

c = httpx.Client(base_url=BASE, timeout=30)
c.post("/api/auth/register", json={"email": "rl@example.com", "password": "RlTest@12345"})
r = c.post("/api/auth/login", json={"email": "rl@example.com", "password": "RlTest@12345"})
assert r.status_code == 200, r.text
H = {"Authorization": f"Bearer {r.json()['access_token']}"}

codes = {}
for n in range(N):
    resp = c.post("/api/analyze/url", json={"url": "http://prize-claim-center.tk/c"}, headers=H)
    codes[resp.status_code] = codes.get(resp.status_code, 0) + 1
    if resp.status_code != 200:
        print(f"  request {n + 1}: HTTP {resp.status_code} -> {resp.text[:200]}")
    else:
        print(f"  request {n + 1}: HTTP 200")

print("\nstatus code tally:", codes)
print("rate limiter enforced" if 429 in codes else "no 429 observed in this window")
