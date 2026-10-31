"""Model training: 4-Step Preprocessed TF-IDF (15,000 features) + L2 Logistic Regression.

Trains on an 80% stratified split (4,800 rows) of ml/data/dataset.csv, persists
the exact 20% held-out split (1,200 rows) to ml/data/test_split.csv so
ml/evaluation/evaluate.py measures strictly unseen data (Section 2.4.2), and
saves the pipeline to ml/models/scam_model.joblib.
"""
import csv
import sys
import time
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from services.nlp.preprocessing import preprocess_for_ml  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "dataset.csv"
TRAIN_SPLIT_PATH = ROOT / "data" / "train_split.csv"
TEST_SPLIT_PATH = ROOT / "data" / "test_split.csv"
MODELS_DIR = ROOT / "models"
MODEL_PATH = MODELS_DIR / "scam_model.joblib"

# Total TF-IDF vocabulary capped at 15,000 features (7,500 word + 7,500 char_wb) per Section 2.4.2
WORD_MAX_FEATURES = 7500
CHAR_MAX_FEATURES = 7500


def load_dataset():
    rows = []
    with open(DATA, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append({
                "label": row["label"],
                "category": row.get("category", "uncategorized"),
                "text": row["text"],
            })
    return rows


def _write_split(path: Path, rows: list) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["label", "category", "text"])
        for r in rows:
            writer.writerow([r["label"], r["category"], r["text"]])


def build_pipeline() -> Pipeline:
    """Build dual N-gram TF-IDF (capped at 15,000 total features) + L2 Logistic Regression."""
    features = FeatureUnion([
        (
            "word",
            TfidfVectorizer(
                preprocessor=preprocess_for_ml,
                ngram_range=(1, 2),
                sublinear_tf=True,
                min_df=2,
                max_features=WORD_MAX_FEATURES,
            ),
        ),
        (
            "char",
            TfidfVectorizer(
                preprocessor=preprocess_for_ml,
                analyzer="char_wb",
                ngram_range=(3, 5),
                sublinear_tf=True,
                min_df=3,
                max_features=CHAR_MAX_FEATURES,
            ),
        ),
    ])
    clf = LogisticRegression(C=3.0, max_iter=1000, class_weight="balanced")
    return Pipeline([("features", features), ("clf", clf)])


def main() -> None:
    rows = load_dataset()
    labels = [1 if r["label"] == "scam" else 0 for r in rows]
    strat_keys = [f"{r['label']}:{r['category']}" for r in rows]

    train_rows, test_rows, y_tr, y_te = train_test_split(
        rows, labels, test_size=0.2, stratify=strat_keys, random_state=42
    )
    _write_split(TRAIN_SPLIT_PATH, train_rows)
    _write_split(TEST_SPLIT_PATH, test_rows)

    X_tr = [r["text"] for r in train_rows]
    X_te = [r["text"] for r in test_rows]

    pipe = build_pipeline()
    t0 = time.perf_counter()
    pipe.fit(X_tr, y_tr)
    train_time = time.perf_counter() - t0

    t1 = time.perf_counter()
    proba = pipe.predict_proba(X_te)[:, 1]
    infer_total = time.perf_counter() - t1
    preds = (proba >= 0.5).astype(int)

    metrics = {
        "accuracy": round(accuracy_score(y_te, preds), 4),
        "precision": round(precision_score(y_te, preds), 4),
        "recall": round(recall_score(y_te, preds), 4),
        "f1": round(f1_score(y_te, preds), 4),
        "roc_auc": round(roc_auc_score(y_te, proba), 4),
        "max_tfidf_features": WORD_MAX_FEATURES + CHAR_MAX_FEATURES,
        "train_seconds": round(train_time, 2),
        "avg_latency_ms": round(infer_total / len(X_te) * 1000, 3),
        "train_size": len(X_tr),
        "test_size": len(X_te),
    }

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, MODEL_PATH)

    print("Model saved:", MODEL_PATH)
    for k, v in metrics.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
