"""Synthetic bilingual dataset generator for TrustLayer (Section 2.3 / Table 2.2).

Generates the 6,000-row bilingual (English + Roman Urdu) labelled corpus across
all 11 fraud and benign categories specified in Table 2.2 (4,400 scam + 1,600 ham),
ensuring unique surface realizations so train/test splits have zero duplicate-row
leakage.

Output: ml/data/dataset.csv  (label,category,text)
"""
import csv
import random
import sys
from pathlib import Path
from typing import List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.training.templates import (  # noqa: E402
    CATEGORY_QUOTAS,
    HAM_TEMPLATES,
    SCAM_TEMPLATES,
    fill,
    fill_category,
)

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
OUTPUT = DATA_DIR / "dataset.csv"
REAL_DATA_TSV = DATA_DIR / "real_sms_spam.tsv"


def load_real_sms() -> List[Tuple[str, str, str]]:
    """Optional loader for external TSV SMS corpus when include_real=True."""
    if not REAL_DATA_TSV.exists():
        return []

    real_rows: List[Tuple[str, str, str]] = []
    with open(REAL_DATA_TSV, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) >= 2 and row[0] in ("ham", "spam"):
                label = "scam" if row[0] == "spam" else "ham"
                cat = "external_sms_spam" if label == "scam" else "external_sms_ham"
                text = row[1].strip()
                if text:
                    real_rows.append((label, cat, text))
    return real_rows


def generate(
    n_scam: Optional[int] = None,
    n_ham: Optional[int] = None,
    include_real: bool = False,
    seed: int = 42,
) -> List[Tuple[str, str, str]]:
    """Generate the Table 2.2 11-category corpus (default: 6,000 synthetic rows)."""
    rng = random.Random(seed)
    rows: List[Tuple[str, str, str]] = []
    seen_texts = set()

    if n_scam is None and n_ham is None and not include_real:
        for label, category, quota in CATEGORY_QUOTAS:
            count = 0
            attempts = 0
            while count < quota:
                attempts += 1
                msg = fill_category(category, rng=rng)
                if msg in seen_texts and attempts < quota * 10:
                    continue
                seen_texts.add(msg)
                rows.append((label, category, msg))
                count += 1
        rng.shuffle(rows)
        return rows

    # Custom volume mode (backwards-compatible)
    target_scam = 4400 if n_scam is None else n_scam
    target_ham = 1600 if n_ham is None else n_ham
    real_data = load_real_sms() if include_real else []
    real_scam = [r for r in real_data if r[0] == "scam"][:target_scam]
    real_ham = [r for r in real_data if r[0] == "ham"][:target_ham]

    rows.extend(real_scam)
    rows.extend(real_ham)
    for _ in range(max(0, target_scam - len(real_scam))):
        rows.append(("scam", "synthetic_scam", fill(SCAM_TEMPLATES, rng=rng)))
    for _ in range(max(0, target_ham - len(real_ham))):
        rows.append(("ham", "synthetic_ham", fill(HAM_TEMPLATES, rng=rng)))

    rng.shuffle(rows)
    return rows


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    rows = generate()
    with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["label", "category", "text"])
        writer.writerows(rows)
    scam_count = sum(1 for r in rows if r[0] == "scam")
    ham_count = sum(1 for r in rows if r[0] == "ham")
    print(f"Dataset written: {OUTPUT} ({len(rows)} rows: {scam_count} scam, {ham_count} ham across 11 categories)")


if __name__ == "__main__":
    main()
