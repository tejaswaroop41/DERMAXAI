"""
DERMAXAI -- Uncertainty Engine (MCUE)
Matches DERMAXAI_NOVA notebook Cell 18 exactly.

MCUE is computed from the predictor's TTA-averaged probability
vector. The predictor is the single source of truth for preprocessing
and the calibrated mel-only logit adjustment, so uncertainty cannot
silently disagree with the prediction shown to the user.
"""
import numpy as np

from core.config import settings


class UncertaintyEngine:
    def __init__(self, predictor, mc_passes: int = None, theta_H: float = None):
        self.predictor = predictor

        if theta_H is not None:
            self.theta_H = float(theta_H)
        elif getattr(predictor.model, "mcue_threshold", None) is not None:
            self.theta_H = float(predictor.model.mcue_threshold)
        else:
            self.theta_H = settings.UNCERTAINTY_THETA
            print(f"[INFO] Using settings.UNCERTAINTY_THETA={self.theta_H} as theta_H "
                  "(no per-checkpoint value found).")

        # Kept for backwards compatibility with app.py/config; NOVA MCUE
        # does not use stochastic MC-Dropout passes.
        self.mc_passes = mc_passes

    def predictive_entropy(self, probs: np.ndarray) -> float:
        """Normalized predictive entropy in [0, 1]."""
        eps = 1e-8
        probs = np.clip(probs, eps, 1.0)
        ent = -(probs * np.log(probs)).sum()
        max_ent = np.log(len(settings.CLASSES))
        return float(ent / max_ent)

    def composite_uncertainty(self, image_path: str) -> dict:
        """Compute MCUE from the predictor's already-calibrated TTA output."""
        result = self.predictor.predict(image_path)
        probs = np.asarray(result["raw_probs"], dtype=np.float32)

        aleatory = self.predictive_entropy(probs)
        epistemic = 0.0
        fusion = 0.0
        composite = aleatory
        requires_review = aleatory > self.theta_H

        return {
            "aleatory_uncertainty": round(aleatory, 4),
            "epistemic_uncertainty": round(epistemic, 4),
            "fusion_uncertainty": round(fusion, 4),
            "composite_uncertainty": round(composite, 4),
            "raw_entropy": round(aleatory, 4),
            "theta_H": round(self.theta_H, 4),
            "requires_review": bool(requires_review),
            "confidence_level": self._confidence_label(aleatory),
        }

    def _confidence_label(self, normalized_score: float) -> str:
        if normalized_score < 0.20: return "Very High"
        if normalized_score < 0.40: return "High"
        if normalized_score < 0.60: return "Moderate"
        if normalized_score < 0.80: return "Low"
        return "Very Low"
