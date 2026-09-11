"""Model evaluation: precision, recall, F1, ROC-AUC, FPR, FNR, latency.

Answers the FYP research questions (RQ1, RQ4) by measuring the deployed
model on a held-out test split. Writes a JSON report to
ml/evaluation/reports/evaluation_report.json and prints a summary.

Usage:
    python -m ml.evaluation.evaluate
"""
import csv
import json
import time
from pathlib import Path

import joblib
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "dataset.csv"
MODEL = ROOT / "models" / "scam_model.joblib"
REPORTS_DIR = ROOT / "evaluation" / "reports"


def load_dataset():
    texts, labels = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            texts.append(row["text"])
            labels.append(1 if row["label"] == "scam" else 0)
    return texts, labels


def main() -> None:
    texts, labels = load_dataset()
    pipe = joblib.load(MODEL)

    t0 = time.perf_counter()
    proba = pipe.predict_proba(texts)[:, 1]
    total_ms = (time.perf_counter() - t0) * 1000
    preds = (proba >= 0.5).astype(int)

    tn, fp, fn, tp = confusion_matrix(labels, preds).ravel()
    report = {
        "n_samples": len(texts),
        "precision": round(precision_score(labels, preds), 4),
        "recall": round(recall_score(labels, preds), 4),
        "f1": round(f1_score(labels, preds), 4),
        "roc_auc": round(roc_auc_score(labels, proba), 4),
        "false_positive_rate": round(fp / (fp + tn), 4),
        "false_negative_rate": round(fn / (fn + tp), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "avg_latency_ms": round(total_ms / len(texts), 3),
        "throughput_msgs_per_sec": round(len(texts) / (total_ms / 1000), 1),
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out = REPORTS_DIR / "evaluation_report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("=== TrustLayer ML Evaluation ===")
    for k, v in report.items():
        if k != "confusion_matrix":
            print(f"  {k}: {v}")
    print(f"  confusion_matrix: {report['confusion_matrix']}")
    print(f"Report written: {out}")


if __name__ == "__main__":
    main()
