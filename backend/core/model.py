"""
DERMAXAI — Model Architecture
Rewritten to match the DERMAXAI_NOVA training notebook exactly:
EfficientNet-B3 backbone (timm) -> CBAM (channel + spatial attention)
-> GeM (Generalized Mean) pooling -> 3-layer LayerNorm/GELU/Dropout
MLP head. This REPLACES the earlier plain-EfficientNet-B3 + LayerNorm
head architecture (no CBAM/GeM) that a previous checkpoint used.

self.backbone is still a standard timm model (num_classes=0), NOT
features_only=True, specifically so `self.backbone.blocks[-1][-1]`
keeps working for ai/gradcam.py's forward/backward hooks unchanged.
CBAM + GeM are applied on top of `self.backbone.forward_features(x)`
(the pre-pool spatial feature map), not inside the backbone itself.

If you retrain again with a different architecture, update this file
AND retrain so the saved state_dict loads with zero missing/unexpected
keys -- that's the contract this repo depends on.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
import timm

from core.config import settings


class GeM(nn.Module):
    """Generalized Mean Pooling -- matches notebook Cell 9 exactly."""
    def __init__(self, p=3.0, eps=1e-6):
        super().__init__()
        self.p = nn.Parameter(torch.ones(1) * p)
        self.eps = eps

    def forward(self, x):
        x = x.clamp(min=self.eps).pow(self.p)
        x = F.adaptive_avg_pool2d(x, 1).pow(1.0 / self.p)
        return x.flatten(1)


class ChannelAttention(nn.Module):
    def __init__(self, channels, reduction=16):
        super().__init__()
        hidden = max(channels // reduction, 8)
        self.mlp = nn.Sequential(
            nn.Linear(channels, hidden), nn.ReLU(inplace=True), nn.Linear(hidden, channels)
        )

    def forward(self, x):
        avg = F.adaptive_avg_pool2d(x, 1).flatten(1)
        mx = F.adaptive_max_pool2d(x, 1).flatten(1)
        attn = torch.sigmoid(self.mlp(avg) + self.mlp(mx))
        return x * attn.unsqueeze(-1).unsqueeze(-1)


class SpatialAttention(nn.Module):
    def __init__(self, kernel_size=7):
        super().__init__()
        self.conv = nn.Conv2d(2, 1, kernel_size, padding=kernel_size // 2, bias=False)

    def forward(self, x):
        avg = x.mean(dim=1, keepdim=True)
        mx, _ = x.max(dim=1, keepdim=True)
        attn = torch.sigmoid(self.conv(torch.cat([avg, mx], dim=1)))
        return x * attn


class CBAM(nn.Module):
    def __init__(self, channels, reduction=16, kernel_size=7):
        super().__init__()
        self.channel_attn = ChannelAttention(channels, reduction)
        self.spatial_attn = SpatialAttention(kernel_size)

    def forward(self, x):
        x = self.channel_attn(x)
        x = self.spatial_attn(x)
        return x


class MLPHead(nn.Module):
    """
    3-layer MLP head, LayerNorm BEFORE each Linear (not after) --
    matches notebook Cell 9's MLPHead exactly. This ordering matters
    for state_dict compatibility; do not silently "fix" it to
    Linear->LayerNorm ordering, that was the OLD architecture.
    """
    def __init__(self, in_dim, num_classes, hidden=512, drop=0.3):
        super().__init__()
        self.net = nn.Sequential(
            nn.LayerNorm(in_dim), nn.Linear(in_dim, hidden), nn.GELU(), nn.Dropout(drop),
            nn.LayerNorm(hidden), nn.Linear(hidden, hidden // 2), nn.GELU(), nn.Dropout(drop),
            nn.LayerNorm(hidden // 2), nn.Linear(hidden // 2, num_classes),
        )

    def forward(self, x):
        return self.net(x)


class DERMAXAIClassifier(nn.Module):
    """
    Matches DERMAXAI_NOVA notebook Cell 9 exactly:
      EfficientNet-B3 (timm, num_classes=0) -> forward_features() (spatial)
        -> CBAM (channel + spatial attention)
        -> GeM pooling
        -> MLPHead (LayerNorm -> Linear -> GELU -> Dropout, x3)
    """
    def __init__(self, num_classes=7, dropout_rate=0.3,
                 model_name="efficientnet_b3", pretrained=False):
        super().__init__()
        # Matches the notebook's Cell 9 construction EXACTLY:
        # features_only=True, out_indices=(4,) -- this still exposes
        # self.backbone.blocks[-1][-1] (EfficientNetFeatures keeps .blocks
        # as a real attribute), so gradcam.py's hooks work unmodified, AND
        # it has zero conv_head/bn2/classifier parameters at all (unlike a
        # standard num_classes=0 model, which instantiates them unused and
        # produces "missing key" noise on every checkpoint load).
        self.backbone = timm.create_model(
            model_name, pretrained=pretrained, features_only=True, out_indices=(4,)
        )
        feat_dim = self.backbone.feature_info.channels()[-1]  # 384 for efficientnet_b3

        self.cbam = CBAM(feat_dim)
        self.pool = GeM()   # NOTE: must be named "pool", not "gem" -- the notebook's
                             # DermaNet class uses self.pool = GeM(), and checkpoints
                             # store this parameter as "pool.p". Renaming this attribute
                             # will silently stop the trained GeM exponent from loading
                             # (falls back to the default p=3.0 init instead) -- do not
                             # "clean up" this name without re-checking checkpoint keys.
        self.head = MLPHead(feat_dim, num_classes, hidden=512, drop=dropout_rate)

    def _pooled_features(self, x):
        feats = self.backbone(x)[-1]  # (B, C, H, W) -- features_only returns a list
        feats = self.cbam(feats)
        return self.pool(feats)  # (B, C)

    def forward(self, x):
        return self.head(self._pooled_features(x))

    def forward_features(self, x):
        """Returns pooled (post-CBAM, post-GeM) embedding. Used for t-SNE / feature inspection."""
        return self._pooled_features(x)


# Backwards-compatible alias -- older code in this repo may import DERMAXAIv6
DERMAXAIv6 = DERMAXAIClassifier


def load_model(model_path: str, device: torch.device) -> DERMAXAIClassifier:
    """
    Loads DERMAXAI weights from a training checkpoint (best.pth /
    best_phase4.pth). The notebook's Phase-4 checkpoint format is:
      {"epoch": int, "model_state": <state_dict>, "combined_score": float}
    Older checkpoints used "model_state_dict" plus class_names/mcue_threshold
    metadata -- both keys are handled here for backward compatibility.
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
        print("[WARNING] Using randomly initialized weights -- predictions will be meaningless.")
        print("[WARNING] Copy your trained checkpoint to backend/models/best.pth "
              "(or best_phase4.pth, whichever you're deploying)")
        model.eval()
        model.mcue_threshold = None
        return model

    ckpt = torch.load(model_path, map_location=device, weights_only=False)
    # Phase-4 notebook checkpoints use "model_state"; older ones used "model_state_dict"
    state = ckpt.get("model_state", ckpt.get("model_state_dict", ckpt))

    missing, unexpected = model.load_state_dict(state, strict=False)
    if missing:    print(f"[WARNING] Missing keys: {len(missing)} -- {missing[:5]}")
    if unexpected: print(f"[WARNING] Unexpected keys: {len(unexpected)} -- {unexpected[:5]}")
    if not missing and not unexpected:
        print("[INFO] State dict loaded with an exact key match.")

    model.eval()
    epoch = ckpt.get("epoch", "unknown")
    val_acc = ckpt.get("val_acc", ckpt.get("combined_score", "unknown"))

    # Sanity-check class order against what's baked into the checkpoint, if present.
    # NOTE: the DERMAXAI_NOVA notebook checkpoints do NOT save class_names -- the
    # order is implicit (alphabetical: akiec,bcc,bkl,df,mel,nv,vasc) and MUST match
    # settings.CLASSES exactly, or predictions will be silently mislabeled.
    ckpt_classes = ckpt.get("class_names")
    if ckpt_classes and list(ckpt_classes) != list(settings.CLASSES):
        print("[ERROR] settings.CLASSES order does not match the checkpoint's "
              "class_names! Predictions will be mislabeled.")
        print(f"        checkpoint class_names = {ckpt_classes}")
        print(f"        settings.CLASSES       = {settings.CLASSES}")

    # The DERMAXAI_NOVA notebook does not bake mcue_threshold into best_phase4.pth --
    # theta_H is a separately-calibrated constant, set via settings.UNCERTAINTY_THETA.
    model.mcue_threshold = ckpt.get("mcue_threshold", None)
    if model.mcue_threshold is None:
        print(f"[INFO] No mcue_threshold in checkpoint -- using calibrated "
              f"settings.UNCERTAINTY_THETA={settings.UNCERTAINTY_THETA} "
              "(copy the exact theta_H your notebook computed in Cell 18).")

    print(f"[INFO] Model loaded -- epoch={epoch}, val_acc/score={val_acc}")
    return model