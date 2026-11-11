# TrustLayer — Production Readiness Enhancement Plan

**Project:** TrustLayer: Multimodal AI-Powered Scam, Phishing, and Social-Engineering Interception Platform  
**Author:** Ameer Hamza (`BSCSE-23-11`, BSCS 2023–2027)  
**Purpose:** Step-by-step engineering roadmap and implementation log for upgrading TrustLayer from a single-process prototype into a multi-worker, concurrency-safe, production-ready deployment while preserving 100% backward compatibility with Tasks 1, 2, and 3.

---

## Executive Summary

TrustLayer already includes a strong baseline of security and privacy controls (`MultiFernet` `EncryptedText` field encryption, chained `HMAC-SHA256` audit logs, token-bucket rate limiting, 4-stage Alembic migrations, and non-root Docker images). However, a full architectural audit identified **six production-readiness gaps** that arise when running under multi-worker containers (`uvicorn --workers 2`), high database concurrency, real-world Android image sharing, and bilingual English/Urdu OCR.

This document tracks the sequential implementation of all **6 Production Enhancements**:

| # | Enhancement Title | Target Subsystem / Files | Priority | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Multi-Worker State Synchronization (Redis Auth State & Cross-Worker IOC TTL Sync)** | `backend/app/security/auth.py`, `backend/app/routers/admin.py`, `backend/app/services/analysis_engine.py` | **High** | Completed |
| **2** | **Concurrent Write Serialization on the Chained HMAC-SHA256 Audit Ledger** | `backend/app/security/audit.py` | **High** | Completed |
| **3** | **Direct Screenshot Sharing (`image/*`) via Android OS Share Sheet** | `AndroidManifest.xml`, `MainActivity.kt`, `InterceptionBridge.kt`, `protection_service.dart` | **Medium** | Completed |
| **4** | **Working-Directory (CWD) Independence for Static Assets & Test Execution** | `backend/app/main.py`, `.github/workflows/ci.yml` | **Medium** | Completed |
| **5** | **Bilingual English + Urdu (`eng+urd`) OCR Support in Vision Service & Docker** | `services/vision/ocr.py`, `infrastructure/docker/Dockerfile` | **Medium** | Completed |
| **6** | **Calibrated ML Probability Scoring (`CalibratedClassifierCV` / Sigmoid Calibration)** | `ml/training/train_model.py`, `services/nlp/classifier.py` | **Medium** | Completed |

---

## Detailed Specification of the 6 Enhancements

### Enhancement 1: Multi-Worker State Synchronization (Redis Auth State & Cross-Worker IOC Sync)
* **Problem:** Production Docker runs Uvicorn with `--workers 2` (multiple OS processes). Previously, revoked JWT token IDs (`_REVOKED_JTIS`), brute-force login counters (`_FAILED_LOGINS`), and custom SOC Indicators of Compromise (`_CUSTOM_DOMAINS`, `_CUSTOM_KEYWORDS`, `_CUSTOM_SENDERS`) were stored only in process-local Python memory. A token revoked or an IOC added on Worker 1 was invisible to Worker 2.
* **Solution:**
  1. Extend [`backend/app/security/auth.py`](backend/app/security/auth.py) to store JWT `jti` revocations and per-email failed-login counters in Redis (with automatic TTL expiry matching token lifetime / lockout window) whenever `REDIS_URL` is configured, while retaining thread-safe in-memory fallback for local development.
  2. Add a lightweight cross-worker TTL cache (`_IOC_SYNC_TTL_SECONDS = 5.0`) in [`backend/app/routers/admin.py`](backend/app/routers/admin.py) and [`backend/app/services/analysis_engine.py`](backend/app/services/analysis_engine.py) so every worker process automatically refreshes its in-memory IOC sets from `threat_iocs` without requiring a server restart.

### Enhancement 2: Concurrent Write Serialization on the Chained HMAC-SHA256 Audit Ledger
* **Problem:** In [`backend/app/security/audit.py`](backend/app/security/audit.py), `log_event()` queries the latest `AuditLog` row (`ORDER BY id DESC LIMIT 1`), sets `prev_hash = last.hmac_signature`, and inserts a new row. Under concurrent requests across threads or PostgreSQL workers, two transactions can read the same tail row simultaneously and produce a forked hash chain.
* **Solution:**
  1. Introduce an in-process `threading.Lock` (`_AUDIT_WRITE_LOCK`) for SQLite / threaded concurrency.
  2. When running on PostgreSQL (`db.bind.dialect.name == "postgresql"`), acquire a transaction-level advisory lock (`SELECT pg_advisory_xact_lock(84729103)`) before reading the tail `hmac_signature` and inserting the new `AuditLog` entry, guaranteeing strict linear ordering of the cryptographic chain.

### Enhancement 3: Direct Screenshot Sharing (`image/*`) via Android OS Share Sheet
* **Problem:** [`AndroidManifest.xml`](apps/mobile/android/app/src/main/AndroidManifest.xml) and [`MainActivity.kt`](apps/mobile/android/app/src/main/kotlin/com/trustlayer/app/MainActivity.kt) only registered `Intent.ACTION_SEND` for `text/plain`. Users receiving suspicious EasyPaisa, JazzCash, or bank receipt screenshots in WhatsApp could not share the image directly to TrustLayer from Android's share sheet.
* **Solution:**
  1. Add an `<intent-filter>` for `Intent.ACTION_SEND` with `<data android:mimeType="image/*" />` in [`AndroidManifest.xml`](apps/mobile/android/app/src/main/AndroidManifest.xml).
  2. Update [`MainActivity.kt`](apps/mobile/android/app/src/main/kotlin/com/trustlayer/app/MainActivity.kt) and [`InterceptionBridge.kt`](apps/mobile/android/app/src/main/kotlin/com/trustlayer/app/InterceptionBridge.kt) to safely read shared `content://` image streams (`Intent.EXTRA_STREAM`) capped at `8 MB`, encode the bytes for the `MethodChannel`, and dispatch `onSharedImageReceived` to [`protection_service.dart`](apps/mobile/lib/services/protection_service.dart) for automatic `/api/analyze/image` scanning.

### Enhancement 4: Working-Directory (CWD) Independence for Static Assets & Test Execution
* **Problem:** Running `uvicorn` or `pytest` from the repository root (`trustlayer/`) vs. `trustlayer/backend/` behaved differently if relative paths were used for SQLite or static directories.
* **Solution:**
  1. Anchor path resolution in [`backend/app/main.py`](backend/app/main.py) using `Path(__file__).resolve().parent` so the FastAPI app initializes identically regardless of the current working directory.

### Enhancement 5: Bilingual English + Urdu (`eng+urd`) OCR Support in Vision Service & Docker
* **Problem:** [`infrastructure/docker/Dockerfile`](infrastructure/docker/Dockerfile) only installed `tesseract-ocr-eng`, and [`services/vision/ocr.py`](services/vision/ocr.py) called `pytesseract.image_to_string(grayscale)` with default English-only settings. Pakistani scam screenshots frequently combine English and Urdu script.
* **Solution:**
  1. Install `tesseract-ocr-urd` alongside `tesseract-ocr-eng` in [`infrastructure/docker/Dockerfile`](infrastructure/docker/Dockerfile).
  2. Enhance [`services/vision/ocr.py`](services/vision/ocr.py) to dynamically detect available Tesseract languages (`pytesseract.get_languages()`), using `lang="eng+urd"` when Urdu training data is available and falling back cleanly to `lang="eng"`.

### Enhancement 6: Calibrated ML Probability Scoring (`CalibratedClassifierCV`)
* **Problem:** Uncalibrated L2 Logistic Regression (`C=3.0`) on high-dimensional (15,000-feature) TF-IDF vectors can push probabilities toward extreme `0.0` or `1.0` values on borderline messages.
* **Solution:**
  1. Enhance [`ml/training/train_model.py`](ml/training/train_model.py) and [`services/nlp/classifier.py`](services/nlp/classifier.py) with calibrated probability scaling (using 3-fold `CalibratedClassifierCV` sigmoid calibration wrapped around the 15,000-feature TF-IDF + L2 Logistic Regression estimator) so `predict_proba()` outputs well-calibrated confidence probabilities across both clear-cut scams and ambiguous messages while maintaining `> 0.90` precision/recall/F1 on the held-out test split.

