"""
DERMAXAI -- Uncertainty Engine (MCUE)
Matches DERMAXAI_NOVA notebook Cell 18 exactly.

IMPORTANT CHANGE from an earlier version of this file: the NOVA
notebook's MCUE does NOT use MC-Dropout / T stochastic passes. It's
simpler: predictive entropy from a single (TTA-averaged) softmax
distribution, normalized to [0, 1] by dividing by log(num_classes),
compared against theta_H -- an entropy threshold calibrated to sit at
90% coverage on the validation set (see notebook's
`compute_theta_h_at_coverage`). If you want MC-Dropout back, that's a
retrain + a different notebook cell, not a drop-in toggle here.

Field names in composite_uncertainty()'s return dict intentionally
match the existing Diagnosis DB schema (aleatory_uncertainty,
epistemic_uncertainty, fusion_uncertainty, composite_uncertainty) so
no migration is needed -- only the underlying math changed. Since the
NOVA notebook doesn't decompose aleatoric vs epistemic uncertainty,
epistemic_uncertainty is fixed at 0.0 here (not computed, not guessed).
"""
import numpy as np

from core.config import settings
from core.preprocessing import get_tta_transforms, load_image


class UncertaintyEngine:
    def __init__(self, model, device, mc_passes: int = None, theta_H: float = None):
        self.model = model
        self.device = device
        self.tta_tfms = get_tta_transforms(settings.TTA_CROPS)

        if theta_H is not None:
            self.theta_H = float(theta_H)
        elif getattr(model, "mcue_threshold", None) is not None:
            self.theta_H = float(model.mcue_threshold)
        else:
            self.theta_H = settings.UNCERTAINTY_THETA
            print(f"[INFO] Using settings.UNCERTAINTY_THETA={self.theta_H} as theta_H "
                  "(no per-checkpoint value found -- this is expected for NOVA "
                  "checkpoints, which calibrate theta_H once in the notebook, not "
                  "per-checkpoint).")

        # mc_passes kept as a constructor arg for backward compatibility with
        # app.py's call site, but is unused -- NOVA's MCUE is single-pass.
        self.mc_passes = mc_passes

    def predictive_entropy(self, probs: np.ndarray) -> float:
        """Normalized predictive entropy, exactly as in notebook Cell 18."""
        eps = 1e-8
        probs = np.clip(probs, eps, 1.0)
        ent = -(probs * np.log(probs)).sum()
        max_ent = np.log(len(settings.CLASSES))
        return float(ent / max_ent)

    def composite_uncertainty(self, image_path: str) -> dict:
        """
        Runs the same TTA-averaged forward pass predictor.predict() uses,
        computes normalized predictive entropy, and compares it to theta_H.
        """
        import torch

        img_np = load_image(image_path)
        preds = torch.zeros(1, len(settings.CLASSES)).to(self.device)
        self.model.eval()
        with torch.no_grad():
            for tfm in self.tta_tfms:
                t = tfm(image=img_np)["image"].unsqueeze(0).to(self.device)
                preds += torch.softmax(self.model(t), dim=1)
        preds /= len(self.tta_tfms)
        probs = preds[0].cpu().numpy()

        aleatory = self.predictive_entropy(probs)   # normalized 0-1
        epistemic = 0.0   # not computed -- NOVA's MCUE has no MC-Dropout decomposition
        fusion = 0.0       # cross-modal fusion uncertainty combined in decision_engine instead
        composite = aleatory   # single-term composite since epistemic/fusion are both 0

        requires_review = aleatory > self.theta_H

        return {
            "aleatory_uncertainty":  round(aleatory, 4),
            "epistemic_uncertainty": round(epistemic, 4),
            "fusion_uncertainty":    round(fusion, 4),
            "composite_uncertainty": round(composite, 4),
            "raw_entropy":           round(aleatory, 4),   # normalized 0-1, same units as theta_H
            "theta_H":               round(self.theta_H, 4),
            "requires_review":       bool(requires_review),
            "confidence_level":      self._confidence_label(aleatory),
        }

    def _confidence_label(self, normalized_score: float) -> str:
        if normalized_score < 0.20: return "Very High"
        if normalized_score < 0.40: return "High"
        if normalized_score < 0.60: return "Moderate"
        if normalized_score < 0.80: return "Low"
        return "Very Low"
