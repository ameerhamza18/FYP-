"""ML classifier wrapper: TF-IDF + Logistic Regression scam detector.

Loads the trained artifact from ``ml/models/scam_model.joblib`` (see
``ml/training/train_model.py``). When the artifact is absent (e.g. fresh
checkout) the service reports ``available = False`` and the Trust Engine
falls back to deterministic rules only — never a silent failure.
"""
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("trustlayer.nlp.classifier")

MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "models" / "scam_model.joblib"


class ScamClassifier:
    def __init__(self) -> None:
        self._model = None
        self.available = False
        self._try_load()

    def _try_load(self) -> None:
        try:
            import joblib

            if MODEL_PATH.exists():
                self._model = joblib.load(MODEL_PATH)
                self.available = True
                logger.info("Loaded scam model from %s", MODEL_PATH)
            else:
                logger.warning("Scam model artifact not found at %s — rules-only mode", MODEL_PATH)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not load scam model (%s) — rules-only mode", exc)

    def predict_proba(self, text: str) -> Optional[float]:
        """Return P(scam) in [0, 1], or None when the model is unavailable."""
        if not self.available or self._model is None:
            return None
        try:
            proba = self._model.predict_proba([text])[0]
            return float(proba[1])
        except Exception as exc:  # noqa: BLE001
            logger.error("Scam model inference failed: %s", exc)
            return None

    def predict_with_confidence(self, text: str) -> dict:
        """Return probability along with confidence bounds.
        
        Flags ambiguous model outputs in the [0.40, 0.60] boundary so the
        engine can escalate to expert deterministic rules.
        """
        prob = self.predict_proba(text)
        if prob is None:
            return {"probability": None, "confidence": "UNAVAILABLE", "is_uncertain": False}

        if 0.40 <= prob <= 0.60:
            confidence = "UNCERTAIN"
        elif prob >= 0.80 or prob <= 0.20:
            confidence = "HIGH"
        else:
            confidence = "MODERATE"

        return {
            "probability": prob,
            "confidence": confidence,
            "is_uncertain": confidence == "UNCERTAIN",
        }


_classifier_singleton: Optional[ScamClassifier] = None


def get_classifier() -> ScamClassifier:
    global _classifier_singleton
    if _classifier_singleton is None:
        _classifier_singleton = ScamClassifier()
    return _classifier_singleton
