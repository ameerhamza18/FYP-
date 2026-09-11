"""Synthetic dataset generator for the TrustLayer scam classifier.

Combines scam/ham templates with randomized slots (brands, amounts, links,
phones) so the model must learn *patterns*, not memorize fixed strings.
Output: ml/data/dataset.csv  (label,text)
"""
import csv
import random
from pathlib import Path

from ml.training.templates import HAM_TEMPLATES, SCAM_TEMPLATES, fill

random.seed(42)

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
OUTPUT = DATA_DIR / "dataset.csv"


def generate(n_scam: int = 3000, n_ham: int = 3000) -> list:
    rows = [("scam", fill(SCAM_TEMPLATES)) for _ in range(n_scam)]
    rows += [("ham", fill(HAM_TEMPLATES)) for _ in range(n_ham)]
    random.shuffle(rows)
    return rows


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    rows = generate()
    with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["label", "text"])
        writer.writerows(rows)
    print(f"Dataset written: {OUTPUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
