"""
DERMAXAI -- Monte Carlo Uncertainty Estimation (MCUE)

Combines uncertainty from stochastic MC-dropout predictions with the
existing deterministic TTA distribution. All reported components are
normalized to [0, 1].
"""
import numpy as np

from core.config import settings


class UncertaintyEngine:
    def __init__(self, model=None, device=None, mc_passes: int = None, theta_H: float = None):
        self.model = model
        self.device = device
        if theta_H is not None:
            self.theta_H = float(theta_H)
        elif model is not None and getattr(model, "mcue_threshold", None) is not None:
            self.theta_H = float(model.mcue_threshold)
        else:
            self.theta_H = float(settings.UNCERTAINTY_THETA)
        self.mc_passes = max(2, int(mc_passes or settings.MC_DROPOUT_PASSES))

    @staticmethod
    def _normalize_distribution(probs: np.ndarray) -> np.ndarray:
        probs = np.asarray(probs, dtype=np.float64)
        if probs.ndim != 1 or not np.all(np.isfinite(probs)):
            raise ValueError("probabilities must be a finite 1-D vector")
        probs = np.clip(probs, 0.0, None)
        total = float(probs.sum())
        if total <= 0:
            raise ValueError("probabilities must contain positive probability mass")
        return probs / total

    @staticmethod
    def predictive_entropy(probs: np.ndarray) -> float:
        """Normalized entropy H(p) / log(K), bounded in [0, 1]."""
        probs = UncertaintyEngine._normalize_distribution(probs)
        eps = 1e-12
        return float(-(probs * np.log(np.clip(probs, eps, 1.0))).sum() / np.log(len(settings.CLASSES)))

    @staticmethod
    def mutual_information(mc_probs: np.ndarray) -> float:
        """Normalized BALD mutual information, bounded in [0, 1]."""
        samples = np.asarray(mc_probs, dtype=np.float64)
        if samples.ndim != 2 or samples.shape[1] != len(settings.CLASSES):
            raise ValueError("mc_probs must have shape (passes, num_classes)")
        samples = np.vstack([UncertaintyEngine._normalize_distribution(row) for row in samples])
        mean_probs = samples.mean(axis=0)
        predictive_h = UncertaintyEngine.predictive_entropy(mean_probs)
        expected_h = float(np.mean([UncertaintyEngine.predictive_entropy(row) for row in samples]))
        return float(np.clip(predictive_h - expected_h, 0.0, 1.0))

    @staticmethod
    def jensen_shannon_divergence(p: np.ndarray, q: np.ndarray) -> float:
        """Jensen-Shannon divergence normalized to [0, 1]."""
        p = UncertaintyEngine._normalize_distribution(p)
        q = UncertaintyEngine._normalize_distribution(q)
        m = 0.5 * (p + q)
        eps = 1e-12

        def kl(a, b):
            return float(np.sum(a * np.log(np.clip(a, eps, 1.0) / np.clip(b, eps, 1.0))))

        js_nats = 0.5 * kl(p, m) + 0.5 * kl(q, m)
        return float(np.clip(js_nats / np.log(2.0), 0.0, 1.0))

    def composite_uncertainty(self, raw_probs=None, mc_probs=None, image_path: str = None) -> dict:
        """Calculate MCUE from TTA and stochastic MC-dropout distributions."""
        if raw_probs is None:
            raise ValueError("composite_uncertainty requires raw_probs from predictor.predict()")
        if mc_probs is None:
            raise ValueError("composite_uncertainty requires mc_probs from predictor.predict()")

        tta_probs = self._normalize_distribution(raw_probs)
        samples = np.asarray(mc_probs, dtype=np.float64)
        if samples.ndim != 2 or samples.shape[1] != len(settings.CLASSES):
            raise ValueError("mc_probs must have shape (passes, num_classes)")
        if samples.shape[0] < 2:
            raise ValueError("mc_probs must contain at least two stochastic passes")
        samples = np.vstack([self._normalize_distribution(row) for row in samples])

        mc_mean = samples.mean(axis=0)
        predictive_entropy = self.predictive_entropy(mc_mean)
        expected_entropy = float(np.mean([self.predictive_entropy(row) for row in samples]))
        epistemic = float(np.clip(predictive_entropy - expected_entropy, 0.0, 1.0))
        aleatory = float(np.clip(expected_entropy, 0.0, 1.0))
        fusion = self.jensen_shannon_divergence(tta_probs, mc_mean)

        # Transparent fixed composition until a validation-set calibration pass
        # establishes task-specific weights and a properly calibrated threshold.
        composite = float(np.clip(0.4 * aleatory + 0.4 * epistemic + 0.2 * fusion, 0.0, 1.0))
        requires_review = composite > self.theta_H

        return {
            "aleatory_uncertainty": round(aleatory, 4),
            "epistemic_uncertainty": round(epistemic, 4),
            "fusion_uncertainty": round(fusion, 4),
            "composite_uncertainty": round(composite, 4),
            "raw_entropy": round(predictive_entropy, 4),
            "theta_H": round(self.theta_H, 4),
            "requires_review": bool(requires_review),
            "confidence_level": self._confidence_label(composite),
            "mc_passes": int(samples.shape[0]),
        }

    def _confidence_label(self, normalized_score: float) -> str:
        if normalized_score < 0.20:
            return "Very High"
        if normalized_score < 0.40:
            return "High"
        if normalized_score < 0.60:
            return "Moderate"
        if normalized_score < 0.80:
            return "Low"
        return "Very Low"
