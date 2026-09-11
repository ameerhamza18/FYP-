# TrustLayer API Reference

Base URL: `http://localhost:8000` (interactive docs at `/docs`, OpenAPI at `/openapi.json`)

All `/api/*` routes require `Authorization: Bearer <jwt>` except register/login.

## Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, password}` | 201 → user; 409 if exists |
| POST | `/api/auth/login` | `{email, password}` | 200 → `{access_token, token_type, role}` |
| GET | `/api/auth/me` | — | current user profile |

## Analysis
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/analyze/text` | `{text, source}` | full risk report |
| POST | `/api/analyze/url` | `{url}` | full risk report incl. `url_score` |
| POST | `/api/analyze/screenshot` | multipart `upload` (PNG/JPEG) | OCR → full risk report |
| GET | `/api/analyze/history?limit=20` | — | user's recent threats |
| GET | `/api/analyze/{id}` | — | one report (owner/admin only — BOLA enforced) |

### Risk report shape
```json
{
  "id": 1,
  "risk_score": 91, "risk_level": "HIGH",
  "threat_type": "Phishing",
  "ml_score": 0.98, "rule_score": 46.0, "intel_score": 12.0, "url_score": 47.0,
  "recommendation": "Do not click links...",
  "explanation": "Summary: ...\nWhy this is risky: ...\nWhat you should do: ...",
  "explanation_source": "template",
  "campaign_flagged": false,
  "latency_ms": 8.4,
  "indicators": [
    {"category": "URL", "severity": "HIGH", "title": "Suspicious TLD .xyz", "detail": "..."}
  ],
  "se_techniques": [
    {"technique": "Authority", "intensity": "HIGH", "evidence": "i am from your bank"}
  ]
}
```
Risk levels: `LOW` (<30) · `MEDIUM` (30-59) · `HIGH` (60-84) · `CRITICAL` (85+)

## Admin (SOC Security Center, role=admin)
| Method | Path | Returns |
|---|---|---|
| GET | `/api/admin/stats` | totals, high-risk, per-type counts, 14-day trend, top techniques, active campaigns |
| GET | `/api/admin/campaigns` | coordinated campaign registry |
| GET | `/api/admin/audit-logs?limit=100` | security audit trail |
| GET | `/api/admin/users` | account list |

## Ops
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/` | SOC dashboard (web, JWT client-side) |

## Error codes
`401` missing/invalid JWT · `403` RBAC/BOLA denial · `404` unknown resource ·
`409` duplicate email · `413` upload too large · `415` bad upload type ·
`422` validation failure · `429` rate limited · `503` OCR unavailable
