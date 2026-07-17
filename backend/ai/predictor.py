"""
DERMAXAI v7 — Predictor Engine

Runs Test-Time Augmentation (TTA) inference using the trained
EfficientNet-B3 classifier and returns calibrated class
probabilities for downstream fusion.
"""
import torch
import numpy as np

from core.config import settings
from core.model import load_model
from core.preprocessing import get_tta_transforms, load_image, validate_image_quality


class Predictor:
    """
    Singleton-style predictor wrapping the trained DERMAXAI v6 model.
    Performs TTA-averaged inference for stable, robust predictions.
    """
    def __init__(self):
        self.device  = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model   = None
        self.loaded  = False
        self.tta_tfms = get_tta_transforms(settings.TTA_CROPS)
        self.classes  = settings.CLASSES

    def load(self):
        if self.loaded:
            return
        self.model  = load_model(settings.MODEL_PATH, self.device)
        self.loaded = True
        print(f"[Predictor] Ready on device={self.device}")

    @torch.no_grad()
    def predict(self, image_path: str) -> dict:
        """
        Runs full TTA inference pipeline:
          1. Load + validate image quality
          2. Run model on 8 augmented crops
          3. Average softmax probabilities
          4. Return predicted class, confidence, full distribution
        """
        if not self.loaded:
            self.load()

        img_np  = load_image(image_path)
        quality = validate_image_quality(img_np)

        preds = torch.zeros(1, len(self.classes)).to(self.device)
        self.model.eval()
        for tfm in self.tta_tfms:
            t = tfm(image=img_np)["image"].unsqueeze(0).to(self.device)
            preds += torch.softmax(self.model(t), dim=1)
        preds /= len(self.tta_tfms)

        probs      = preds[0].cpu().numpy()
        class_idx  = int(np.argmax(probs))
        pred_class = self.classes[class_idx]
        confidence = float(probs[class_idx])

        return {
            "predicted_class": pred_class,
            "class_name":      settings.CLASS_FULL_NAMES[pred_class],
            "confidence":      round(confidence, 4),
            "is_malignant":    pred_class in settings.MALIGNANT_CLASSES,
            "class_probabilities": {
                self.classes[i]: round(float(probs[i]), 4)
                for i in range(len(self.classes))
            },
            "raw_probs":  probs,          # used internally by uncertainty/decision engines
            "image_quality": quality,
        }

    @torch.no_grad()
    def get_features(self, image_path: str) -> np.ndarray:
        """Returns the pooled feature vector for t-SNE/feature inspection."""
        if not self.loaded:
            self.load()
        img_np = load_image(image_path)
        tfm    = self.tta_tfms[0]
        t      = tfm(image=img_np)["image"].unsqueeze(0).to(self.device)
        feats  = self.model.forward_features(t)
        return feats.cpu().numpy()[0]


# Module-level singleton
predictor = Predictor()
