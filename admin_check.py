"""Admin SOC dashboard check — section 8 of the live demo.

Run:  python admin_check.py [base_url]   (default http://127.0.0.1:8010)
"""
import json
import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8010"
c = httpx.Client(base_url=BASE, timeout=30)
a = c.post("/api/auth/login",
           json={"email": "admin@trustlayer.com", "password": "Admin@12345"}).json()
AH = {"Authorization": f"Bearer {a['access_token']}"}

s = c.get("/api/admin/stats", headers=AH).json()
print("=== ADMIN — SOC Security Center stats ===")
print(json.dumps({k: s[k] for k in ("total_analyses", "high_risk", "phishing",
                                    "financial_fraud", "active_campaigns")}, indent=2))
print("top techniques:", [(t["technique"], t["count"]) for t in s["top_techniques"][:5]])

logs = c.get("/api/admin/audit-logs?limit=6", headers=AH).json()
print("\nrecent audit trail:")
for l in logs:
    print(f"  {l['action']:<16} user={l['user_id']} {l['resource'] or ''}")

print(f"\n✅ All 8 demo sections complete — SOC dashboard at {BASE}/")
