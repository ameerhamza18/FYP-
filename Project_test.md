# TrustLayer — Complete Project Test & Run Guide

> **Your environment:** Python 3.12 · Node 26 · npm 11 · Docker 29 · Flutter ❌ (not yet installed)

---

## Table of Contents
1. [Prerequisites & One-Time Setup](#1-prerequisites--one-time-setup)
2. [Start the Backend API (Local Dev)](#2-start-the-backend-api-local-dev)
3. [Run the Automated Test Suite (85 Tests)](#3-run-the-automated-test-suite-85-tests)
4. [Manual API Testing (curl / Postman)](#4-manual-api-testing-curl--postman)
5. [Start the Web Dashboard (SOC)](#5-start-the-web-dashboard-soc)
6. [Test the Web Dashboard Manually](#6-test-the-web-dashboard-manually)
7. [Run the Security Self-Attack Suite](#7-run-the-security-self-attack-suite)
8. [Run the Live Demo Script (Viva Mode)](#8-run-the-live-demo-script-viva-mode)
9. [Test the ML Model Standalone](#9-test-the-ml-model-standalone)
10. [Run the Full Stack with Docker](#10-run-the-full-stack-with-docker)
11. [Flutter Mobile App (Once Flutter is Installed)](#11-flutter-mobile-app-once-flutter-is-installed)
12. [Troubleshooting Common Issues](#12-troubleshooting-common-issues)
13. [Test Checklist (Pass / Fail Summary)](#13-test-checklist-pass--fail-summary)

---

## 1. Prerequisites & One-Time Setup

### 1.1 Install Python Dependencies

Open **PowerShell** and run:

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer\backend
pip install -r requirements.txt
```

**You should see packages like:** fastapi, uvicorn, sqlalchemy, pydantic, scikit-learn, pytesseract, pytest

### 1.2 Install Tesseract OCR (for Screenshot Analysis)

> If you skip this, text + URL analysis still work. Only screenshot falls back gracefully.

1. Download from: https://github.com/UB-Mannheim/tesseract/wiki
2. Install to `C:\Program Files\Tesseract-OCR\`
3. Verify: `tesseract --version`

### 1.3 Create the Backend `.env` File

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer\backend
Copy-Item .env.example .env
```

Default `.env` works immediately — SQLite, no external services needed.

### 1.4 Install Web Dashboard Dependencies

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer\web
npm install
```

---

## 2. Start the Backend API (Local Dev)

> **Run all backend commands from the `trustlayer/` root directory.**

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer
uvicorn backend.app.main:app --reload --port 8001
```

### Expected Console Output
```
INFO:     TrustLayer API starting up (development)
INFO:     Admin user ensured: admin@trustlayer.com
INFO:     Uvicorn running on http://127.0.0.1:8001 (Press CTRL+C to quit)
```

> Keep this terminal open. Open a **new PowerShell window** for the next steps.

### 2.1 Verify Server is Running

```powershell
curl http://localhost:8001/api/health
```

**Expected:**
```json
{"status": "ok", "service": "TrustLayer API"}
```

### 2.2 Verify Database Readiness

```powershell
curl http://localhost:8001/api/ready
```

**Expected:**
```json
{"status": "ready", "database": "ok"}
```

### 2.3 Open Interactive API Docs

- **Swagger UI:** http://localhost:8001/docs
- **ReDoc:**      http://localhost:8001/redoc

You will see all 14 API endpoints with interactive "Try it out" buttons.

---

## 3. Run the Automated Test Suite (85 Tests)

> This is the most important verification step. All 85 tests must pass.

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer
pytest tests/ -v
```

### Expected Final Output
```
====================== 85 passed, 7 warnings in ~40s ======================
```

### Run Individual Test Files

```powershell
pytest tests/test_api.py -v                    # API integration tests
pytest tests/test_se_techniques.py -v          # SE technique detection
pytest tests/test_threat_engine.py -v          # Rule engine + risk fusion
pytest tests/test_url_analyzer.py -v           # URL risk analysis
pytest tests/test_production_readiness.py -v   # Production config guards
pytest tests/test_rate_limit.py -v             # Rate limiter
pytest tests/test_campaign_llm_guard.py -v     # Campaign + LLM guard
pytest tests/test_preprocessing.py -v          # NLP preprocessing
```

### Run With Coverage Report

```powershell
pip install pytest-cov
pytest tests/ --cov=. --cov-report=term-missing
```

---

## 4. Manual API Testing (curl / Postman)

> **Prerequisite:** Backend running on http://localhost:8001 (Step 2).

### 4.1 Register a New User

```powershell
curl -X POST http://localhost:8001/api/auth/register `
  -H "Content-Type: application/json" `
  -d "{""email"": ""test@example.com"", ""password"": ""Test@12345""}"
```

**Expected:** `{"id": 2, "email": "test@example.com", "role": "user"}`

### 4.2 Login and Get a Token

```powershell
curl -X POST http://localhost:8001/api/auth/login `
  -H "Content-Type: application/json" `
  -d "{""email"": ""test@example.com"", ""password"": ""Test@12345""}"
```

**Expected:** `{"access_token": "eyJhbGciOiJIUzI1...", "token_type": "bearer"}`

> **Save the token!** Replace `YOUR_TOKEN` below with this value.

### 4.3 Analyse a Scam SMS

```powershell
curl -X POST http://localhost:8001/api/analyze/text `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d "{""text"": ""URGENT: Your HBL account has been blocked. Call 0300-1234567 to verify your OTP or your account will be permanently deleted."", ""source"": ""sms""}"
```

**Expected Response:**
```json
{
  "risk_score": 88,
  "risk_level": "CRITICAL",
  "threat_type": "PHISHING",
  "se_findings": [
    {"technique": "URGENCY", "intensity": "HIGH"},
    {"technique": "FEAR", "intensity": "HIGH"},
    {"technique": "CREDENTIAL_HARVESTING", "intensity": "HIGH"}
  ]
}
```

### 4.4 Analyse a Legitimate (Ham) Message

```powershell
curl -X POST http://localhost:8001/api/analyze/text `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d "{""text"": ""Hi Sarah, are you coming to the team lunch tomorrow at 1pm?"", ""source"": ""whatsapp""}"
```

**Expected:** `{"risk_score": 5, "risk_level": "LOW", "threat_type": "CLEAN"}`

### 4.5 Analyse a Suspicious URL

```powershell
curl -X POST http://localhost:8001/api/analyze/url `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d "{""url"": ""http://193.56.29.105/hbl-login/verify.php""}"
```

**Expected:** `{"risk_score": 92, "risk_level": "CRITICAL"}` — IP literal + login path indicators

### 4.6 Test a Roman Urdu Scam

```powershell
curl -X POST http://localhost:8001/api/analyze/text `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d "{""text"": ""Congratulations! Aap ne BISP scheme mein 50000 rupay ka inam jeet liya. Apna OTP bataen."", ""source"": ""sms""}"
```

**Expected:** `{"risk_score": 85, "risk_level": "HIGH"}` — REWARD + CREDENTIAL_HARVESTING detected

### 4.7 View Analysis History

```powershell
curl http://localhost:8001/api/analyze/history `
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** JSON array of previous analyses.

### 4.8 Test SQL Injection Protection

```powershell
curl -X POST http://localhost:8001/api/analyze/text `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d "{""text"": ""' OR 1=1 --; DROP TABLE users;"", ""source"": ""test""}"
```

**Expected:** Valid JSON analysis response — no crash, no HTTP 500.

### 4.9 Admin: Get System Stats

First login as admin:
```powershell
curl -X POST http://localhost:8001/api/auth/login `
  -H "Content-Type: application/json" `
  -d "{""email"": ""admin@trustlayer.com"", ""password"": ""Admin@12345""}"
```

Then (replace `ADMIN_TOKEN`):
```powershell
curl http://localhost:8001/api/admin/stats `
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected:**
```json
{
  "total_analyses": 4,
  "critical_count": 1,
  "risk_distribution": {...},
  "daily_trend": [...]
}
```

### 4.10 Test Rate Limiting

```powershell
for ($i=0; $i -lt 12; $i++) {
  $r = curl -s -o /dev/null -w "%{http_code}" `
    -X POST http://localhost:8001/api/analyze/text `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer YOUR_TOKEN" `
    -d "{""text"": ""test $i"", ""source"": ""test""}"
  Write-Host "Request $i`: HTTP $r"
}
```

**Expected:** First 10 → HTTP 200, request 11+ → HTTP **429**

### 4.11 Test Unauthorized Admin Access

```powershell
curl http://localhost:8001/api/admin/stats `
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**Expected:** HTTP **403** `{"detail": "Admin access required"}`

### 4.12 Download Audit Log CSV (Admin)

In your browser (while logged in as admin in the SOC dashboard), click **"↓ Audit CSV"**, or:

```powershell
curl http://localhost:8001/api/admin/export/audit-logs/csv `
  -H "Authorization: Bearer ADMIN_TOKEN" `
  -o audit_logs.csv
```

**Expected:** Downloads `audit_logs.csv` with columns: id, user_id, action, resource, ip, timestamp.

---

## 5. Start the Web Dashboard (SOC)

Open a **new PowerShell window:**

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer\web
npm run dev
```

**Expected:**
```
Next.js 15.x
Local: http://localhost:3000
Ready in Xs
```

Open http://localhost:3000 in your browser.

---

## 6. Test the Web Dashboard Manually

### 6.1 Landing Page — http://localhost:3000

- [ ] TrustLayer hero section loads with dark background
- [ ] "Start Analysing Free" button visible
- [ ] Features section (4 capability cards) renders
- [ ] How It Works (3 steps) renders
- [ ] Security band renders
- [ ] Footer shows **Privacy Policy** link at bottom

### 6.2 Login Page — http://localhost:3000/login

- [ ] Login form renders
- [ ] `admin@trustlayer.com` / `Admin@12345` → redirects to `/dashboard`
- [ ] Wrong password → shows error alert

### 6.3 Threat Analyser — http://localhost:3000/analyze

**Text tab test:**
1. Paste: `Urgent! Your bank account is compromised. Click: http://myb4nk-secure.xyz to verify`
2. Click **Analyse Threat**
3. Expected: Red `CRITICAL` badge, SE findings list, recommendation shown

**URL tab test:**
1. Paste: `http://192.168.1.1/paypal-login/verify.html`
2. Click **Analyse Threat**
3. Expected: IP literal + suspicious path indicators displayed

**Screenshot tab test:**
1. Upload any screenshot containing text
2. Click **Analyse Threat**
3. Expected: OCR text extracted and analysed (or graceful "OCR unavailable" if Tesseract not installed)

### 6.4 SOC Dashboard — http://localhost:3000/dashboard

- [ ] 4 headline metric cards load (Analyses, Critical, High, Distinct Users)
- [ ] 14-day trend line chart renders
- [ ] Manipulation technique bar chart renders
- [ ] Threat Feed table shows rows
- [ ] Campaign Registry table loads
- [ ] Audit Trail table loads
- [ ] **"↓ Audit CSV"** button → browser downloads a CSV file
- [ ] **"↓ Threat CSV"** button → browser downloads a CSV file
- [ ] **"Refresh"** button reloads data

### 6.5 Privacy Policy — http://localhost:3000/privacy

- [ ] Page loads with "Privacy Policy" heading
- [ ] Data collection table with 7 rows renders
- [ ] "What We Do NOT Do" checklist visible
- [ ] Contact email `privacy@trustlayer.app` is a clickable link

---

## 7. Run the Security Self-Attack Suite

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer
python run_security_checks.py
```

**Expected:**
```
===== TrustLayer Security Checks =====
[PASS] Health endpoint accessible
[PASS] Unauthenticated request returns 401
[PASS] Admin endpoint blocked for regular user (403)
[PASS] Weak password rejected
[PASS] Rate limiter activates after 10 requests
[PASS] SQL injection does not crash the server
[PASS] Oversized payload rejected
[PASS] Object-level authorisation blocks cross-user access
[PASS] Prompt injection handled safely
===== 9/9 checks passed =====
```

---

## 8. Run the Live Demo Script (Viva Mode)

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer
python demo_live.py
```

This script automatically:
- Registers a demo user
- Analyses 5 different inputs (scam SMS, phishing URL, legitimate message, Roman Urdu scam, admin view)
- Prints colour-coded risk results in the terminal
- Perfect for FYP viva / presentation demonstration

---

## 9. Test the ML Model Standalone

### 9.1 Retrain the Model

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer
python ml/training/train.py
```

**Expected:**
```
Generating dataset (6000 messages)...
Training TF-IDF + Logistic Regression...
Saving model to ml/models/scam_model.joblib
Training complete.
```

### 9.2 Evaluate the Model

```powershell
python ml/evaluation/evaluate.py
```

**Expected:**
```
F1 Score:    > 0.90   (target: PASS)
ROC-AUC:     > 0.95   (target: PASS)
Precision:   > 0.88
Recall:      > 0.90
Latency p50: < 5ms
```

### 9.3 Quick Interactive Test in Python

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer
python -c "
import sys; sys.path.insert(0, '.')
from services.nlp.classifier import get_classifier
clf = get_classifier()

scam = clf.predict_proba('URGENT: Your HBL account is blocked! Verify OTP now.')
ham  = clf.predict_proba('Hi, can we meet for lunch tomorrow?')

print('Scam probability:', scam, '(expected > 0.80)')
print('Ham probability: ', ham,  '(expected < 0.20)')
"
```

### 9.4 Test Social-Engineering Detection

```powershell
python -c "
import sys; sys.path.insert(0, '.')
from services.nlp import se_techniques

findings = se_techniques.detect_techniques('URGENT: Your account will be blocked! Send your OTP immediately.')
for f in findings:
    print(f['technique'], '-', f['intensity'], ':', f['evidence'][:60])
"
```

**Expected:** URGENCY HIGH, FEAR HIGH, CREDENTIAL_HARVESTING HIGH

---

## 10. Run the Full Stack with Docker

> **Prerequisite:** Docker Desktop is running (you have Docker 29 installed).

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer\infrastructure\docker
docker compose up --build
```

**Expected:** 3 containers start:
- `trustlayer_api` — FastAPI + Gunicorn
- `trustlayer_db` — PostgreSQL 15
- `trustlayer_nginx` — nginx reverse proxy

**Verify:**
```powershell
curl http://localhost:8001/api/health
curl http://localhost:8001/api/ready
```

**Stop:**
```powershell
docker compose down
```

**Rebuild from scratch (clean state):**
```powershell
docker compose down -v
docker compose up --build
```

---

## 11. Flutter Mobile App (Once Flutter is Installed)

### 11.1 Install Flutter

1. Download: https://docs.flutter.dev/get-started/install/windows
2. Extract to `C:\flutter\`
3. Add `C:\flutter\bin` to your Windows PATH environment variable
4. Restart PowerShell
5. Run `flutter doctor` — fix any issues it reports

### 11.2 Run the App on an Emulator or Device

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer\apps\mobile

# Install Dart dependencies
flutter pub get

# List available devices
flutter devices

# Run on connected device / emulator
flutter run
```

### 11.3 Manual App Test Flow

| Step | Action | Expected Result |
|---|---|---|
| 1 | Open app | Login screen appears with TrustLayer logo |
| 2 | Enter `test@example.com` / `Test@12345` → Sign In | HomeScreen with 3 tabs |
| 3 | **Text tab** → paste scam SMS → Analyse | Red CRITICAL badge + SE findings |
| 4 | **Text tab** → paste normal message → Analyse | Green LOW badge |
| 5 | **URL tab** → `http://192.168.1.1/verify.html` → Analyse | HIGH/CRITICAL verdict |
| 6 | **Screenshot tab** → pick image from gallery | OCR text extracted + analysed |
| 7 | **History tab** | Your previous analyses listed |
| 8 | Menu (⋮) → Sign out | Returns to login screen |
| 9 | Login again → Menu (⋮) → Delete Account → Confirm | Account deleted, back to login |

### 11.4 Build Release APK / AAB

```powershell
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer\apps\mobile

# Debug APK (for device testing)
flutter build apk --debug

# Release AAB (for Play Store)
# First: fill in android/key.properties with your keystore credentials
flutter build aab --release
# Output: build/app/outputs/bundle/release/app-release.aab
```

---

## 12. Troubleshooting Common Issues

| Problem | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'app'` | Wrong working directory | `cd c:\Users\PMYLS\Desktop\FYP1\trustlayer` then re-run |
| `Address already in use :8001` | Port conflict | `netstat -ano | findstr :8001` → `taskkill /PID <N> /F` |
| `TesseractNotFoundError` | Tesseract not installed | Install from UB-Mannheim link; other endpoints still work |
| `npm run dev` — Module not found | Missing node_modules | `Remove-Item -Recurse -Force node_modules; npm install` |
| `Connection refused` on curl | Server not running | Start backend in a separate window (Step 2) |
| HTTP `401 Unauthorized` | Token expired (60-min TTL) | Login again to get a fresh token |
| HTTP `403 Forbidden` on admin endpoint | Using user token | Login as `admin@trustlayer.com` to get admin token |
| `ScikitLearnVersionMismatch` on model load | Different sklearn version | `python ml/training/train.py` to retrain |
| `psycopg2` import error in Docker | Missing binary | Already in requirements; rebuild with `docker compose build --no-cache` |
| Flutter `flutter pub get` fails | No internet or SDK mismatch | Check Flutter version: `flutter --version` |

---

## 13. Test Checklist (Pass / Fail Summary)

Use this checklist to confirm the project is working correctly:

### Backend Server
- [ ] `pip install -r requirements.txt` — no errors
- [ ] `uvicorn backend.app.main:app --reload --port 8001` — server starts
- [ ] `GET /api/health` → `{"status":"ok"}`
- [ ] `GET /api/ready` → `{"status":"ready","database":"ok"}`
- [ ] Swagger UI renders at http://localhost:8001/docs

### Automated Tests
- [ ] `pytest tests/ -v` → **85 passed, 0 failed**

### Authentication Security
- [ ] Register → HTTP 201 with user object
- [ ] Login → returns JWT token
- [ ] No token → HTTP **401**
- [ ] Wrong password → HTTP **401**
- [ ] Duplicate email → HTTP **409**
- [ ] Weak password (`abc`) → HTTP **422**

### Threat Analysis
- [ ] Scam SMS → `HIGH` or `CRITICAL` risk level
- [ ] Legitimate message → `LOW` risk level
- [ ] Malicious URL (IP literal) → `CRITICAL`
- [ ] Legitimate URL (`google.com`) → `LOW`
- [ ] Roman Urdu scam (BISP + OTP bataen) → `HIGH`
- [ ] SQL injection payload → no HTTP 500 (treated as text)
- [ ] Empty text → HTTP **422**
- [ ] Oversized text → HTTP **413** or **422**

### Authorization Controls
- [ ] Regular user → `/api/admin/stats` → HTTP **403**
- [ ] Admin user → `/api/admin/stats` → HTTP **200**
- [ ] User A's analysis → User B cannot access → HTTP **403/404**
- [ ] 11th request per minute → HTTP **429**

### Admin SOC Features
- [ ] `GET /api/admin/stats` → metrics object
- [ ] `GET /api/admin/analyses` → paginated feed
- [ ] `GET /api/admin/campaigns` → list
- [ ] `GET /api/admin/audit-logs` → events
- [ ] `GET /api/admin/export/audit-logs/csv` → downloads CSV
- [ ] `GET /api/admin/export/analyses/csv` → downloads CSV

### Web Dashboard
- [ ] Landing page loads with hero section
- [ ] Login with admin credentials works
- [ ] Text analysis returns verdict
- [ ] URL analysis returns verdict
- [ ] SOC dashboard metrics load
- [ ] Privacy Policy page (`/privacy`) loads
- [ ] CSV export buttons download files

### ML Model
- [ ] `train.py` completes without error
- [ ] `evaluate.py` — F1 > 0.90
- [ ] Scam message: `predict_proba()` > 0.80
- [ ] Legitimate message: `predict_proba()` < 0.20
- [ ] SE detection: URGENCY + FEAR + CREDENTIAL_HARVESTING on test scam

### Security Suite
- [ ] `python run_security_checks.py` → **9/9 checks passed**

### Live Demo
- [ ] `python demo_live.py` completes without error

---

## Quick Reference — All Commands at a Glance

```powershell
# ONE-TIME SETUP
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer\backend
pip install -r requirements.txt
Copy-Item .env.example .env
cd ..\web && npm install

# START BACKEND (keep this window open)
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer
uvicorn backend.app.main:app --reload --port 8001

# RUN ALL 85 TESTS (new window)
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer
pytest tests/ -v

# START WEB DASHBOARD (new window)
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer\web
npm run dev
# Open: http://localhost:3000

# SECURITY CHECKS
python run_security_checks.py

# LIVE VIVA DEMO
python demo_live.py

# ML RETRAIN + EVALUATE
python ml/training/train.py
python ml/evaluation/evaluate.py

# DOCKER FULL STACK
cd c:\Users\PMYLS\Desktop\FYP1\trustlayer\infrastructure\docker
docker compose up --build

# REGENERATE PDF SYNOPSIS
cd c:\Users\PMYLS\Desktop\FYP1
python generate_synopsis.py
```

---
*TrustLayer — AI Scam & Fraud Interception Platform · Testing Guide · 2026*
