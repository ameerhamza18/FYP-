# TrustLayer — System Architecture

## 1. The problem
People receive suspicious SMS/WhatsApp messages, emails, URLs, screenshots,
job & investment offers, fake banking messages, prize scams and impersonation
attempts. Existing tools answer only **"Scam / Not Scam."** TrustLayer answers
**"HIGH RISK — 91/100"** and then explains **why** (suspicious URL, urgency-based
social engineering, credential requests, financial impersonation, domain
characteristics) and **what to do**.

## 2. What TrustLayer detects
1. **Phishing** — urgency, impersonation, suspicious URL, credential requests
2. **Fake jobs** — upfront payment, unrealistic offers, employment-scam patterns
3. **Banking scams** — financial impersonation, urgency, credential harvesting, malicious URLs
4. **Investment scams** — guaranteed returns, financial manipulation, unrealistic claims
5. **Social engineering techniques** — Authority ("I'm from your bank"), Urgency
   ("Act within 10 minutes"), Fear ("Your account will be closed"), Reward
   ("You've won Rs. 50,000"), Scarcity ("Only 2 spots remaining"), Trust (fake
   institutional identity), Financial pressure ("Pay immediately"),
   Credential harvesting ("Enter your password")

## 3. High-level data flow

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
 NLP   OCR      URL Analyzer
   └────┼──────────┘
        ▼
┌─────────────────┐
│  Threat Engine  │
└───────┬─────────┘
        │
  ┌─────┼──────────────┐
  ▼     ▼              ▼
  ML    Rules    Threat Intel
  └─────┼──────────────┘
        ▼
┌─────────────────┐
│  Risk Scoring   │   ← deterministic fusion, 0-100
└───────┬─────────┘
        ▼
┌─────────────────┐
│ AI Explanation  │   ← LLM explains, never decides
└───────┬─────────┘
        ▼
   USER REPORT
```

## 4. Service decomposition (this repository)

| Service | Location | Responsibility |
|---|---|---|
| NLP service | `services/nlp` | preprocessing, IOC/entity extraction, SE-technique classification, ML inference wrapper |
| Vision (OCR) service | `services/vision` | in-memory OCR of screenshots (Tesseract) |
| URL intelligence | `services/url_intelligence` | static, explainable URL risk analysis (typosquatting, punycode, shorteners, brand impersonation…) |
| Threat engine | `services/threat_engine` | deterministic rule engine, local threat-intel feed, risk-score fusion, campaign detection |
| LLM service | `services/llm` | explainable-AI explanations with prompt-injection defense + output validation |
| Backend API | `backend/app` | FastAPI: auth (JWT/bcrypt), rate limiting, validation, audit logging, SOC admin APIs |
| ML pipeline | `ml/` | dataset generation, TF-IDF + LogReg training, evaluation (precision/recall/F1/ROC-AUC/FPR/FNR/latency) |

## 5. Why the LLM is not the decision-maker
Industry-grade design decision: risk scores come from a **deterministic,
auditable fusion** of ML + rules + intel + URL analysis. The LLM receives the
already-decided verdict and only produces the human explanation. Its output is
contract-validated before reaching the client. This guarantees:
- reproducible, explainable verdicts (needed for RQ1/RQ2 evaluation)
- no prompt-injection-driven verdict flipping
- graceful degradation (template explanations) when the LLM is unavailable

## 6. Tech stack (prioritizing free/open-source)
- **Mobile:** Flutter (Android/iOS), `http`, `image_picker`, `shared_preferences`
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, PyJWT, bcrypt
- **ML:** scikit-learn (TF-IDF word+char n-grams → Logistic Regression)
- **OCR:** Tesseract via pytesseract
- **LLM:** Google Gemini API (optional; template fallback offline)
- **DB:** SQLite (dev) → PostgreSQL (prod)
- **Infra:** Docker Compose, Terraform (AWS), GitHub Actions CI
