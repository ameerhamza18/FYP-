# TrustLayer Security Policy

## Supported version
| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ |

## Reporting a vulnerability
Email `security@trustlayer.local` (PGP key in `keys/`). Do not open public
issues for exploitable findings. We commit to triage within 72 hours.

## Implemented security controls (OWASP API Security Top 10 mapping)

| OWASP API Risk | Control in TrustLayer |
|---|---|
| API1 BOLA | Object-level authorization on `/api/analyze/{id}` (owner or admin only) |
| API2 Broken Auth | bcrypt (cost 12) password hashing, JWT with expiry + `jti`, no user enumeration |
| API3 Property-Level Authorization | Pydantic strict schemas, field validators, control-char sanitization |
| API4 Resource Consumption | Sliding-window rate limits (per-IP, stricter on auth + analyze), upload size caps |
| API5 Function-Level Authorization | `require_admin` dependency on all `/api/admin/*` routes |
| API6 Business Flow | Campaign detection flags coordinated reporting abuse |
| API7 SSRF | URL analysis is fully static — the server never fetches submitted URLs |
| API8 Security Misconfiguration | Secrets from env only; CORS allow-list; debug off in prod |
| API9 Inventory | OpenAPI docs at `/docs`; append-only audit log of security events |
| API10 Unsafe Consumption | Threat intel feed is local/offline; LLM output contract-validated |

## LLM-specific controls
- The LLM is **not** the security decision-maker (deterministic Trust Engine decides).
- Prompt-injection signature scanning on all analyzed content.
- Untrusted text wrapped in delimiters; the system prompt forbids following
  instructions found in analyzed messages.
- LLM output is validated (length cap, credential-echo rejection) before use.

## File upload safety
- In-memory processing only — uploaded screenshots are never written to disk.
- Magic-byte (PNG/JPEG) validation, content-type checks, size cap.
- OCR runs in an isolated decode step; malformed images raise 422.
