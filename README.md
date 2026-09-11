# 🛡 TrustLayer — AI-Powered Scam, Phishing & Social-Engineering Detection Platform

**Final Year Project** · TrustLayer doesn't just answer *"Scam / Not Scam"* —
it answers **"🚨 HIGH RISK — 91/100"**, then explains **why** (suspicious URL,
urgency-based social engineering, credential requests, financial impersonation,
suspicious domain characteristics) and **what to do**.

---

## 1. Problem

People receive suspicious **SMS, WhatsApp messages, emails, URLs, screenshots,
job offers, investment offers, fake banking messages, prize scams, and
impersonation attempts**. Most people don't know *why* something is suspicious.
Existing solutions only give a binary verdict — useless for building digital
resilience.

## 2. Architecture

```
USER (Flutter app)
        │
        ▼
┌─────────────────┐
│ TrustLayer App  │
└───────┬─────────┘
        │
   ┌────┼──────────┐
   ▼    ▼          ▼
 Text  Screenshot  URL
   │    │          │
   ▼    ▼          ▼
 NLP   OCR     URL Analyzer      ← services/
   └────┼──────────┘
        ▼
┌─────────────────┐
│  Threat Engine  │                 ← services/threat_engine
└───────┬─────────┘
        │
  ┌─────┼──────────────┐
  ▼     ▼              ▼
  ML    Rules     Threat Intel
  └─────┼──────────────┘
        ▼
┌─────────────────┐
│  Risk Scoring   │   0–100, deterministic fusion
└───────┬─────────┘
        ▼
┌─────────────────┐
│ AI Explanation  │   LLM explains — never decides
└───────┬─────────┘
        ▼
   USER REPORT
```

**Key design decision:** the LLM is *not* the security decision-maker. Risk
scores come from an auditable, deterministic fusion of ML + rules + threat
intelligence + URL analysis. The LLM only re-words the decided evidence into a
human explanation (with prompt-injection defenses and output validation).

## 3. Threat Model

See [`security/threat-model/threat-model.md`](security/threat-model/threat-model.md)
— full STRIDE analysis (14 threats mapped to implemented mitigations) and
[`security/policies/security-policy.md`](security/policies/security-policy.md)
(OWASP API Top-10 control mapping).

Highlights:
- JWT auth + bcrypt(cost 12), no user enumeration
- RBAC (`require_admin`) + object-level authorization (BOLA defense)
- Sliding-window rate limiting, upload size caps, magic-byte image validation
- In-memory-only screenshot processing (never written to disk)
- Prompt-injection signature scanning; LLM output contract validation
- Append-only audit log of every security-relevant event
- URL analysis is static — the server never fetches submitted URLs (no SSRF)

## 4. Dataset

`ml/training/generate_dataset.py` builds a balanced synthetic corpus
(6,000 messages) modeled on real scam categories — phishing, banking fraud,
job scams, investment scams, prize scams, impersonation — versus OTP delivery,
transaction alerts, delivery updates, bills and personal messages. Template
slots (brands, amounts, domains, phones) are randomized so the model learns
*patterns*, not memorized strings.

## 5. ML Experiments

```bash
python -m ml.training.generate_dataset     # build dataset
python -m ml.training.train_model          # TF-IDF (word+char) → Logistic Regression
python -m ml.evaluation.evaluate           # full metric report
```

Evaluated per the FYP research questions (RQ1–RQ4): **precision, recall, F1,
ROC-AUC, false-positive rate, false-negative rate, latency, throughput** →
`ml/evaluation/reports/evaluation_report.json`.

## 6. Security

Demonstrated in `security/security-tests/run_security_checks.py` — we attack
our own application:

```
python security/security-tests/run_security_checks.py http://localhost:8000
```

Checks: unauthenticated access, forged JWTs, RBAC bypass, BOLA, SQLi payloads,
prompt-injection payloads, malicious uploads, login rate limiting.

## 7. API

Full reference: [`docs/api/api.md`](docs/api/api.md) · interactive: `http://localhost:8000/docs`

| Endpoint | Purpose |
|---|---|
| `POST /api/analyze/text` | analyze SMS/WhatsApp/email text |
| `POST /api/analyze/url` | analyze a URL |
| `POST /api/analyze/screenshot` | OCR + analyze a screenshot |
| `GET /api/analyze/history` | user's recent threats |
| `GET /api/admin/stats` | SOC dashboard metrics (admin) |
| `GET /api/admin/campaigns` | coordinated campaign registry (admin) |

## 8. Mobile App

Full Flutter client in [`apps/mobile`](apps/mobile) — login/register, Home
(Analyze Message / Screenshot / Check URL), Analysis Report screen (risk gauge,
indicators, SE-technique breakdown, AI explanation, recommendation), Recent
Threats. Setup instructions in [`apps/mobile/README.md`](apps/mobile/README.md).

## 9. Deployment

```bash
# Local dev (SQLite, no Docker)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload            # → http://localhost:8000

# Production stack (PostgreSQL + hardened image)
cp backend/.env.example backend/.env     # set SECRET_KEY, ADMIN_PASSWORD…
docker compose -f infrastructure/docker/docker-compose.yml up --build

# Cloud (AWS EC2 + TLS via certbot)
cd infrastructure/terraform && terraform apply -var key_name=my-key
```

HTTPS termination is handled by nginx + certbot in front of the API.
Secrets never live in code — environment variables only (`.env.example` is the
template; `.env` is git-ignored).

## 10. Evaluation

| Metric | Source |
|---|---|
| Precision / Recall / F1 / ROC-AUC | `ml/evaluation/evaluate.py` |
| FPR / FNR | confusion matrix in the same report |
| Latency / throughput | per-analysis `latency_ms` + batch report |
| Security control effectiveness | `security/security-tests/run_security_checks.py` |
| Functional correctness | `pytest tests/ -v` (60+ assertions) |

## 11. Demo scenario (final viva flow)

1. Sign in to the Flutter app → paste *"Your bank account will be blocked.
   Verify now at http://verify-acct-alert.xyz — enter your password and OTP"*
2. Show the report: **HIGH RISK 94/100 · Phishing / Financial Fraud** with
   indicators (suspicious URL, urgency, financial impersonation, credential
   request) and the SE-technique breakdown
3. Open `http://localhost:8000` → **SOC Security Center** → totals, threat
   trend, top attack techniques
4. Send the same scam text from two more accounts → point out
   **🚨 coordinated campaign detected**
5. Run `security/security-tests/run_security_checks.py` live — all controls hold
6. Show `ml/evaluation/reports/evaluation_report.json` — the research numbers

## 12. Repository structure

```
trustlayer/
├── apps/
│   └── mobile/                  # Flutter client
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entrypoint, CORS, rate-limit middleware
│   │   ├── config.py            # env-based secrets management
│   │   ├── database.py          # SQLAlchemy (SQLite dev / PostgreSQL prod)
│   │   ├── models.py            # users, analyses, indicators, campaigns, audit
│   │   ├── schemas.py           # strict Pydantic validation
│   │   ├── security/            # auth.py, rate_limit.py, validation.py,
│   │   │                        # llm_guard.py, audit.py
│   │   ├── services/            # Trust Engine orchestrator
│   │   ├── routers/             # auth, analyze, admin
│   │   └── static/              # SOC dashboard (web)
│   └── requirements.txt
├── services/
│   ├── nlp/                     # preprocessing, SE techniques, ML wrapper
│   ├── vision/                  # OCR (in-memory, Tesseract)
│   ├── url-intelligence/        # static URL risk analysis
│   ├── threat-engine/           # rules, intel, fusion, campaign detection
│   └── llm/                     # explanation engine + guards
├── ml/
│   ├── training/                # dataset generator + trainer
│   ├── evaluation/              # metrics reports
│   └── models/                  # scam_model.joblib (built by CI/training)
├── security/
│   ├── policies/                # OWASP-aligned security policy
│   ├── threat-model/            # STRIDE threat model
│   └── security-tests/          # ethical self-attack suite
├── infrastructure/
│   ├── docker/                  # Dockerfile + docker-compose (API + PostgreSQL)
│   └── terraform/               # AWS deployment
├── tests/                       # pytest suite (unit + integration + security)
├── docs/
│   ├── architecture/
│   ├── threat-model/
│   └── api/
├── .github/workflows/ci.yml     # CI: train model → run tests → flutter analyze
└── README.md
```

## Quick start (2 commands)

```bash
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload
```

Sign in at `http://localhost:8000/docs` with the bootstrap admin
(`ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env.example`) or register a
fresh user, then `POST /api/analyze/text` with any suspicious message.

