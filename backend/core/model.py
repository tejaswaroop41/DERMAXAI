"""
DERMAXAI — Model Architecture
Rewritten to exactly match the architecture actually trained in
dermaxai_v5 notebook: EfficientNet-B3 backbone (timm) + plain
LayerNorm MLP head. No SE block, no CBAM — the real checkpoint
(best.pth, originally produced by the v5 training notebook) has no weights for those modules.

If you retrain with SE/CBAM added, update this file AND retrain;
until then this must mirror Cell 7 of the notebook exactly so the
saved state_dict loads with zero missing/unexpected keys.
"""
import torch
import torch.nn as nn
import timm

from core.config import settings


class DERMAXAIClassifier(nn.Module):
    """
    Matches notebook Cell 7 exactly:
      EfficientNet-B3 (timm, num_classes=0 -> pooled 1536-d features)
        -> Linear(1536,512) -> LayerNorm -> GELU -> Dropout
        -> Linear(512,256)  -> LayerNorm -> GELU -> Dropout
        -> Linear(256, num_classes)
    """
    def __init__(self, num_classes=7, dropout_rate=0.3,
                 model_name="efficientnet_b3", pretrained=False):
        super().__init__()
        self.backbone = timm.create_model(
            model_name, pretrained=pretrained, num_classes=0
        )
        feat_dim = self.backbone.num_features  # 1536 for B3

        self.head = nn.Sequential(
            nn.Linear(feat_dim, 512),
            nn.LayerNorm(512),
            nn.GELU(),
            nn.Dropout(dropout_rate),
            nn.Linear(512, 256),
            nn.LayerNorm(256),
            nn.GELU(),
            nn.Dropout(dropout_rate),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        return self.head(self.backbone(x))

    def forward_features(self, x):
        """Returns pooled backbone embedding (pre-head). Used for t-SNE / feature inspection."""
        return self.backbone(x)


# Backwards-compatible alias — older code in this repo may import DERMAXAIv6
DERMAXAIv6 = DERMAXAIClassifier


def load_model(model_path: str, device: torch.device) -> DERMAXAIClassifier:
    """
    Loads DERMAXAI weights from a training checkpoint (best.pth).
    Checkpoint is a dict with 'model_state_dict' plus
    metadata (epoch, val_acc, class_names, mcue_threshold, ...).
    """
    model = DERMAXAIClassifier(
        num_classes=settings.NUM_CLASSES,
        dropout_rate=settings.DROPOUT,
        model_name=settings.MODEL_NAME,
        pretrained=False
    ).to(device)

    import os
    if not os.path.exists(model_path):
        print(f"[WARNING] Model weights not found at {model_path}.")
        print("[WARNING] Using randomly initialized weights — predictions will be meaningless.")
        print("[WARNING] Copy your trained checkpoint to backend/models/best.pth")
        model.eval()
        model.mcue_threshold = None
        return model

    ckpt  = torch.load(model_path, map_location=device, weights_only=False)
    state = ckpt.get("model_state_dict", ckpt)

    missing, unexpected = model.load_state_dict(state, strict=False)
    if missing:    print(f"[WARNING] Missing keys: {len(missing)} — {missing[:5]}")
    if unexpected: print(f"[WARNING] Unexpected keys: {len(unexpected)} — {unexpected[:5]}")
    if not missing and not unexpected:
        print("[INFO] State dict loaded with an exact key match.")

    model.eval()
    epoch   = ckpt.get("epoch", "unknown")
    val_acc = ckpt.get("val_acc", "unknown")

    # Sanity-check class order against what's baked into the checkpoint
    ckpt_classes = ckpt.get("class_names")
    if ckpt_classes and list(ckpt_classes) != list(settings.CLASSES):
        print("[ERROR] settings.CLASSES order does not match the checkpoint's "
              "class_names! Predictions will be mislabeled.")
        print(f"        checkpoint class_names = {ckpt_classes}")
        print(f"        settings.CLASSES       = {settings.CLASSES}")

    # Attach the training-calibrated MCUE entropy threshold so the
    # uncertainty engine never has to guess or hardcode it.
    model.mcue_threshold = ckpt.get("mcue_threshold", None)
    if model.mcue_threshold is None:
        print("[WARNING] Checkpoint has no 'mcue_threshold' — uncertainty "
              "engine will fall back to an uncalibrated default.")

    print(f"[INFO] Model loaded — epoch={epoch}, val_acc={val_acc}")
    return model