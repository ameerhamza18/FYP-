# TrustLayer Threat Model (STRIDE)

Scope: TrustLayer API + mobile client + Trust Engine + LLM explanation channel.

## Assets
1. User credentials & PII (emails, bcrypt hashes)
2. Analysis data (submitted messages, URLs, screenshots)
3. Risk verdicts (integrity — a tampered "SAFE" verdict causes real financial harm)
4. Threat-intel feed (poisoning → wrong verdicts)
5. Admin SOC console
6. LLM API key / secrets

## STRIDE analysis

| # | Threat | STRIDE | Attack scenario | Mitigation (implemented) |
|---|--------|--------|-----------------|--------------------------|
| T1 | Credential stuffing / brute force | Spoofing | Attacker floods `/api/auth/login` | Rate limiting on login; bcrypt cost 12; vague error messages; audit log of failures |
| T2 | Token theft | Spoofing | Stolen JWT replayed | 60-min expiry, HTTPS-only transport, `jti` claims (revocation-ready) |
| T3 | Unauthorized verdict access | Information Disclosure | User A reads User B's analysis | Object-level ownership check (BOLA defense), tested in CI |
| T4 | Privilege escalation | Elevation | User calls `/api/admin/*` | `require_admin` RBAC dependency, tested in CI |
| T5 | Verdict tampering | Tampering | MITM flips score to 0 | HTTPS enforcement, signed JWT, server-side scoring only |
| T6 | Prompt injection | Tampering/Elevation | Scam text contains "ignore previous instructions" | Injection signature scan; untrusted text delimited; LLM cannot alter verdict; output contract validation |
| T7 | LLM secret leakage | Information Disclosure | Extract system prompt / API key via payload | System-prompt hardening; output regex rejection of credential-like material |
| T8 | Malicious file upload | Tampering/EoD | Webshell/SVG-XSS uploaded as screenshot | In-memory only, magic-byte checks, size cap, never executed |
| T9 | SSRF via submitted URL | Information Disclosure | `http://169.254.169.254/` metadata probe | URL analyzer is static — server never fetches URLs |
| T10 | Resource exhaustion (DoS) | DoS | Massive text / upload floods | Body size caps, 10k char limit, per-IP sliding-window rate limits |
| T11 | Threat-intel poisoning | Tampering | Attacker injects fake IOCs into feed | Feed is version-controlled and code-reviewed; live feeds require signed sources |
| T12 | Audit-log tampering | Repudiation | Attacker erases traces | Append-only audit table, no delete/update endpoints |
| T13 | Campaign-alert abuse | Repudiation | Adversary reports their own scam to poison stats | Campaign flags require distinct-user threshold |
| T14 | Secrets in code | Information Disclosure | Hardcoded keys committed | `.env` git-ignored, `.env.example` template, secrets from environment |

## Residual risks (accepted / future work)
- OCR of adversarial images (evasion via crafted glyphs) — future: adversarial OCR hardening.
- Live threat feeds add supply-chain risk — mitigate with signed feeds (roadmap).
- JWT revocation before expiry — roadmap: Redis denylist keyed on `jti`.
