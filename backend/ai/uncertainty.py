"""
DERMAXAI — Uncertainty Engine (MCUE)
Faithful implementation of Cell 13 in the training notebook.

The accept/review decision is gated on raw predictive entropy from T
MC-Dropout passes, compared against theta_H — the 95th-percentile
entropy threshold calibrated on validation data during training
(saved in the checkpoint as 'mcue_threshold', ~1.448 nats). That is
the exact operating point your model was evaluated against; nothing
here invents a different number.

Field names in composite_uncertainty()'s return dict intentionally
match the existing Diagnosis DB schema (aleatory_uncertainty,
epistemic_uncertainty, fusion_uncertainty, composite_uncertainty) so
no migration is needed — only the underlying math changed.
"""
import torch
import numpy as np

from core.config import settings
from core.preprocessing import get_inference_transform, load_image


class UncertaintyEngine:
    def __init__(self, model, device, mc_passes: int = None, theta_H: float = None):
        self.model     = model
        self.device    = device
        self.mc_passes = mc_passes or settings.MC_DROPOUT_PASSES
        self.tfm       = get_inference_transform()

        if theta_H is not None:
            self.theta_H = float(theta_H)
        elif getattr(model, "mcue_threshold", None) is not None:
            self.theta_H = float(model.mcue_threshold)
        else:
            print("[WARNING] No calibrated mcue_threshold found on the model/checkpoint. "
                  f"Falling back to settings.UNCERTAINTY_THETA={settings.UNCERTAINTY_THETA}, "
                  "which is NOT empirically calibrated — treat review flags with caution.")
            self.theta_H = settings.UNCERTAINTY_THETA

    @torch.no_grad()
    def mcue_predict(self, x_tensor: torch.Tensor, T: int = None) -> dict:
        """
        Mirrors the notebook's mcue_predict() exactly:
          - enable dropout at inference time
          - run T stochastic forward passes
          - mean_probs  = average softmax across passes
          - entropy     = H(mean_probs)                    (total uncertainty, nats)
          - expected_H  = mean over passes of H(each pass)  (average aleatory)
          - mutual_info = entropy - expected_H              (epistemic uncertainty)
        """
        T = T or self.mc_passes
        self.model.train()   # enable dropout layers
        all_probs = []
        for _ in range(T):
            p = torch.softmax(self.model(x_tensor), dim=1)
            all_probs.append(p.cpu().numpy())
        self.model.eval()

        all_probs  = np.stack(all_probs, axis=0)   # (T, B, K)
        mean_probs = all_probs.mean(axis=0)[0]      # (K,)

        eps         = 1e-8
        entropy     = float(-(mean_probs * np.log(mean_probs + eps)).sum())
        expected_H  = float(-(all_probs * np.log(all_probs + eps)).sum(axis=2).mean(axis=0)[0])
        mutual_info = entropy - expected_H

        return {
            "mean_probs":  mean_probs,
            "entropy":     entropy,
            "expected_H":  expected_H,
            "mutual_info": mutual_info,
        }

    def composite_uncertainty(self, image_path: str) -> dict:
        """
        Loads the image with the same single-view transform used at
        validation time, runs MCUE, and returns the calibrated
        accept/review decision plus a descriptive breakdown.
        """
        img_np = load_image(image_path)
        x = self.tfm(image=img_np)["image"].unsqueeze(0).to(self.device)

        result      = self.mcue_predict(x)
        entropy     = result["entropy"]
        mutual_info = result["mutual_info"]

        max_entropy = float(np.log(len(settings.CLASSES)))
        aleatory    = entropy / max_entropy                          # normalized 0-1
        epistemic   = min(max(mutual_info, 0.0) / max_entropy, 1.0)  # normalized 0-1, clipped
        fusion      = 0.0  # cross-modal fusion uncertainty is not yet calibrated;
                            # symptom/demographic signals are combined in decision_engine instead

        composite = 0.7 * aleatory + 0.3 * epistemic

        # The decision that matters: raw entropy vs the checkpoint's calibrated theta_H.
        requires_review = entropy > self.theta_H

        return {
            "aleatory_uncertainty":  round(aleatory, 4),
            "epistemic_uncertainty": round(epistemic, 4),
            "fusion_uncertainty":    round(fusion, 4),
            "composite_uncertainty": round(composite, 4),
            "raw_entropy":           round(entropy, 4),   # nats — same units as theta_H
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