"""
DERMAXAI v6 — Predictor Engine

Runs Test-Time Augmentation (TTA) inference using the trained
EfficientNet-B3 classifier and returns calibrated class
probabilities for downstream fusion. It also computes stochastic
Monte Carlo dropout samples for uncertainty estimation.
"""
import os

import torch
import torch.nn as nn
import numpy as np
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

from core.config import settings
from core.model import load_model
from core.preprocessing import get_tta_transforms, load_image, validate_image_quality


SUPPORTED_IMAGE_FORMATS = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".bmp": "BMP"}


def validate_image_file(path: str) -> None:
    """Validate the actual image payload before it reaches preprocessing/inference."""
    extension = os.path.splitext(path)[1].lower()
    expected_format = SUPPORTED_IMAGE_FORMATS.get(extension)
    if expected_format is None:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    try:
        with Image.open(path) as image:
            actual_format = (image.format or "").upper()
            if actual_format != expected_format:
                raise HTTPException(status_code=400, detail="Invalid image file")
            image.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid image file")


class Predictor:
    """
    Singleton-style predictor wrapping the trained DERMAXAI v6 model.
    Performs fixed-view TTA-averaged inference and optional MC-dropout sampling.
    """
    def __init__(self):
        self.device  = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model   = None
        self.loaded  = False
        self.tta_tfms = get_tta_transforms(settings.TTA_VIEWS)
        self.classes  = settings.CLASSES

        # Surgical, mel-only logit adjustment (see notebook Cells B/G/H).
        # Built once at init as a (num_classes,) vector that's all zeros
        # except at the mel index, so it never touches any other class's logits.
        self._adj_vec = torch.zeros(len(self.classes), device=self.device)
        if settings.LOGIT_ADJUSTMENT_ENABLED and settings.LOGIT_ADJUSTMENT_CLASS in self.classes:
            mel_idx = self.classes.index(settings.LOGIT_ADJUSTMENT_CLASS)
            self._adj_vec[mel_idx] = settings.LOGIT_ADJUSTMENT_TAU * settings.MEL_LOG_PRIOR

    def load(self):
        if self.loaded:
            return
        self.model  = load_model(settings.MODEL_PATH, self.device)
        self.loaded = True
        print(f"[Predictor] Ready on device={self.device}")

    def _mc_dropout_probs(self, img_np: np.ndarray) -> np.ndarray:
        """Run stochastic forward passes with only dropout layers enabled."""
        if not self.loaded:
            self.load()

        passes = max(2, int(settings.MC_DROPOUT_PASSES))
        tfm = self.tta_tfms[0]
        t = tfm(image=img_np)["image"].unsqueeze(0).to(self.device)

        # Keep batch-normalization and the rest of the network in eval mode;
        # only explicit dropout modules are switched to train mode so each
        # pass samples a different sub-network without changing BN statistics.
        original_states = {module: module.training for module in self.model.modules()}
        try:
            self.model.eval()
            for module in self.model.modules():
                if isinstance(module, (nn.Dropout, nn.Dropout1d, nn.Dropout2d,
                                       nn.Dropout3d, nn.AlphaDropout,
                                       nn.FeatureAlphaDropout)):
                    module.train()

            samples = []
            for _ in range(passes):
                logits = self.model(t) + self._adj_vec
                samples.append(torch.softmax(logits, dim=1)[0].detach().cpu().numpy())
            return np.stack(samples, axis=0).astype(np.float32)
        finally:
            for module, training in original_states.items():
                module.train(training)

    @torch.no_grad()
    def predict(self, image_path: str) -> dict:
        """
        Runs the full inference pipeline:
          1. Validate the actual image payload and image quality
          2. Run model on configured TTA views
          3. Average TTA probabilities for the primary prediction
          4. Run stochastic MC-dropout passes on the deterministic view
          5. Return both distributions for downstream MCUE uncertainty
        """
        if not self.loaded:
            self.load()

        validate_image_file(image_path)
        img_np  = load_image(image_path)
        quality = validate_image_quality(img_np)

        preds = torch.zeros(1, len(self.classes)).to(self.device)
        self.model.eval()
        for tfm in self.tta_tfms:
            t = tfm(image=img_np)["image"].unsqueeze(0).to(self.device)
            logits = self.model(t) + self._adj_vec  # surgical mel-only adjustment, pre-softmax
            preds += torch.softmax(logits, dim=1)
        preds /= len(self.tta_tfms)

        probs      = preds[0].cpu().numpy()
        class_idx  = int(np.argmax(probs))
        pred_class = self.classes[class_idx]
        confidence = float(probs[class_idx])

        mc_probs = self._mc_dropout_probs(img_np)

        return {
            "predicted_class": pred_class,
            "class_name":      settings.CLASS_FULL_NAMES[pred_class],
            "confidence":      round(confidence, 4),
            "is_malignant":    pred_class in settings.MALIGNANT_CLASSES,
            "class_probabilities": {
                self.classes[i]: round(float(probs[i]), 4)
                for i in range(len(self.classes))
            },
            "raw_probs":  probs,          # TTA mean probabilities
            "mc_probs":   mc_probs,       # stochastic MC-dropout probabilities
            "image_quality": quality,
        }

    @torch.no_grad()
    def get_features(self, image_path: str) -> np.ndarray:
        """Returns the pooled feature vector for t-SNE/feature inspection."""
        if not self.loaded:
            self.load()
        validate_image_file(image_path)
        img_np = load_image(image_path)
        tfm    = self.tta_tfms[0]
        t      = tfm(image=img_np)["image"].unsqueeze(0).to(self.device)
        feats  = self.model.forward_features(t)
        return feats.cpu().numpy()[0]


# Module-level singleton
predictor = Predictor()
