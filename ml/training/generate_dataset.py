"""Dataset generator for the TrustLayer scam classifier.

Combines an expanded corpus of synthetic scam/ham templates (with randomized
slots for banks, wallets, brands, domains, amounts, phone numbers, and cities)
with authentic real-world SMS spam/ham messages to build a diverse, robust,
balanced dataset.

Output: ml/data/dataset.csv  (label,text)
"""
import csv
import random
from pathlib import Path

from ml.training.templates import HAM_TEMPLATES, SCAM_TEMPLATES, fill

random.seed(42)

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
OUTPUT = DATA_DIR / "dataset.csv"
REAL_DATA_TSV = DATA_DIR / "real_sms_spam.tsv"


def load_real_sms() -> list:
    """Load authentic real-world SMS spam/ham dataset if present."""
    if not REAL_DATA_TSV.exists():
        return []

    real_rows = []
    with open(REAL_DATA_TSV, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) >= 2 and row[0] in ("ham", "spam"):
                label = "scam" if row[0] == "spam" else "ham"
                text = row[1].strip()
                if text:
                    real_rows.append((label, text))
    return real_rows


def generate(n_scam: int = 15000, n_ham: int = 15000, include_real: bool = True) -> list:
    """Generate balanced dataset mixing synthetic templates and real data."""
    real_data = load_real_sms() if include_real else []
    real_scam = [r for r in real_data if r[0] == "scam"]
    real_ham = [r for r in real_data if r[0] == "ham"]

    # If requested total is smaller than real data, sample down proportionally
    if n_scam < len(real_scam):
        real_scam = random.sample(real_scam, n_scam)
    if n_ham < len(real_ham):
        real_ham = random.sample(real_ham, n_ham)

    # Synthesize templates to reach balanced targets
    synth_scam_count = max(0, n_scam - len(real_scam))
    synth_ham_count = max(0, n_ham - len(real_ham))

    rows = list(real_scam) + [("scam", fill(SCAM_TEMPLATES)) for _ in range(synth_scam_count)]
    rows += list(real_ham) + [("ham", fill(HAM_TEMPLATES)) for _ in range(synth_ham_count)]

    random.shuffle(rows)
    return rows


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    rows = generate()
    with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["label", "text"])
        writer.writerows(rows)
    scam_count = sum(1 for r in rows if r[0] == "scam")
    ham_count = sum(1 for r in rows if r[0] == "ham")
    print(f"Dataset written: {OUTPUT} ({len(rows)} rows: {scam_count} scam, {ham_count} ham)")


if __name__ == "__main__":
    main()

