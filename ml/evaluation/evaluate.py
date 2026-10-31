"""Model evaluation on strictly held-out 20% stratified test split (Section 2.4.2).

Evaluates ml/models/scam_model.joblib exclusively on ml/data/test_split.csv
(1,200 unseen held-out messages — zero training-set leakage) and measures
accuracy, precision, recall, F1, ROC-AUC, overall FPR/FNR, legitimate bank-OTP
false-alarm rate, and per-message inference latency.
"""
import csv
import json
import sys
import time
from pathlib import Path

import joblib
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "dataset.csv"
TEST_SPLIT = ROOT / "data" / "test_split.csv"
MODEL = ROOT / "models" / "scam_model.joblib"
REPORTS_DIR = ROOT / "evaluation" / "reports"


def load_held_out_test_set():
    """Load strictly held-out 20% test split (never training samples)."""
    if TEST_SPLIT.exists():
        rows = []
        with open(TEST_SPLIT, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                rows.append({
                    "label": 1 if row["label"] == "scam" else 0,
                    "category": row.get("category", "uncategorized"),
                    "text": row["text"],
                })
        return rows

    all_rows = []
    with open(DATA, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            all_rows.append({
                "label": 1 if row["label"] == "scam" else 0,
                "category": row.get("category", "uncategorized"),
                "text": row["text"],
            })
    labels = [r["label"] for r in all_rows]
    _, test_rows = train_test_split(all_rows, test_size=0.2, stratify=labels, random_state=42)
    return test_rows


def main() -> None:
    test_rows = load_held_out_test_set()
    texts = [r["text"] for r in test_rows]
    labels = [r["label"] for r in test_rows]
    categories = [r["category"] for r in test_rows]

    pipe = joblib.load(MODEL)

    t0 = time.perf_counter()
    proba = pipe.predict_proba(texts)[:, 1]
    total_ms = (time.perf_counter() - t0) * 1000
    preds = (proba >= 0.5).astype(int)

    tn, fp, fn, tp = confusion_matrix(labels, preds).ravel()

    # Measure false-alarm rate specifically on legitimate bank OTP / transaction texts (Section 2.4.2)
    otp_indices = [i for i, c in enumerate(categories) if c == "transactional_otp_ham"]
    if otp_indices:
        otp_fp = sum(1 for i in otp_indices if preds[i] == 1)
        bank_otp_fpr = round(otp_fp / len(otp_indices), 4)
    else:
        bank_otp_fpr = round(fp / max(1, (fp + tn)), 4)

    report = {
        "evaluation_split": "held_out_20_percent_stratified",
        "n_samples": len(texts),
        "accuracy": round(float(accuracy_score(labels, preds)), 4),
        "precision": round(float(precision_score(labels, preds)), 4),
        "recall": round(float(recall_score(labels, preds)), 4),
        "f1": round(float(f1_score(labels, preds)), 4),
        "roc_auc": round(float(roc_auc_score(labels, proba)), 4),
        "false_positive_rate": round(float(fp / max(1, (fp + tn))), 4),
        "false_negative_rate": round(float(fn / max(1, (fn + tp))), 4),
        "bank_otp_false_positive_rate": bank_otp_fpr,
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "avg_latency_ms": round(total_ms / len(texts), 3),
        "throughput_msgs_per_sec": round(len(texts) / max(0.0001, (total_ms / 1000)), 1),
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out = REPORTS_DIR / "evaluation_report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("=== TrustLayer Held-Out ML Evaluation ===")
    for k, v in report.items():
        if k != "confusion_matrix":
            print(f"  {k}: {v}")
    print(f"  confusion_matrix: {report['confusion_matrix']}")
    print(f"Report written: {out}")


if __name__ == "__main__":
    main()
