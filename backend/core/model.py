"""
DERMAXAI — Model Architecture
Rewritten to match the DERMAXAI_NOVA training notebook exactly:
EfficientNet-B3 backbone (timm) -> CBAM (channel + spatial attention)
-> GeM (Generalized Mean) pooling -> 3-layer LayerNorm/GELU/Dropout
MLP head.
"""
import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import timm

from core.config import settings


class GeM(nn.Module):
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
        return self.spatial_attn(self.channel_attn(x))


class MLPHead(nn.Module):
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
    def __init__(self, num_classes=7, dropout_rate=0.3,
                 model_name="efficientnet_b3", pretrained=False):
        super().__init__()
        self.backbone = timm.create_model(
            model_name, pretrained=pretrained, features_only=True, out_indices=(4,)
        )
        feat_dim = self.backbone.feature_info.channels()[-1]
        self.cbam = CBAM(feat_dim)
        self.pool = GeM()
        self.head = MLPHead(feat_dim, num_classes, hidden=512, drop=dropout_rate)

    def _pooled_features(self, x):
        feats = self.backbone(x)[-1]
        feats = self.cbam(feats)
        return self.pool(feats)

    def forward(self, x):
        return self.head(self._pooled_features(x))

    def forward_features(self, x):
        return self._pooled_features(x)


DERMAXAIv6 = DERMAXAIClassifier


def _extract_state_dict(ckpt):
    if isinstance(ckpt, dict):
        state = ckpt.get("model_state")
        if state is None:
            state = ckpt.get("model_state_dict")
        if state is None and all(hasattr(v, "shape") for v in ckpt.values()):
            state = ckpt
        return state
    return None


def _validate_checkpoint_class_order(ckpt):
    """Reject a checkpoint when it explicitly declares a different class order."""
    if not isinstance(ckpt, dict):
        return
    ckpt_classes = ckpt.get("class_names")
    if ckpt_classes and list(ckpt_classes) != list(settings.CLASSES):
        raise RuntimeError(
            "Checkpoint class_names order does not match settings.CLASSES; refusing to serve."
        )


def load_model(model_path: str, device: torch.device) -> DERMAXAIClassifier:
    """Load the trained checkpoint and fail closed when it is unavailable/invalid."""
    model = DERMAXAIClassifier(
        num_classes=settings.NUM_CLASSES,
        dropout_rate=settings.DROPOUT,
        model_name=settings.MODEL_NAME,
        pretrained=False,
    ).to(device)

    if not os.path.exists(model_path):
        allow_random = os.getenv("ALLOW_RANDOM_WEIGHTS", "false").lower() == "true"
        if allow_random:
            print(f"[WARNING] Model weights not found at {model_path}; "
                  "ALLOW_RANDOM_WEIGHTS=true so random weights are enabled for dev/CI only.")
            model.eval()
            model.mcue_threshold = None
            return model
        raise RuntimeError(
            f"Trained model weights not found at {model_path}. "
            "Refusing to start with random weights. Set ALLOW_RANDOM_WEIGHTS=true "
            "only for development/CI."
        )

    try:
        try:
            ckpt = torch.load(model_path, map_location=device, weights_only=True)
        except (TypeError, RuntimeError, ValueError) as exc:
            print(f"[WARNING] weights_only=True could not read checkpoint ({exc}); "
                  "falling back to legacy checkpoint loading.")
            ckpt = torch.load(model_path, map_location=device, weights_only=False)
    except Exception as exc:
        raise RuntimeError(f"Failed to load model checkpoint {model_path}: {exc}") from exc

    _validate_checkpoint_class_order(ckpt)

    state = _extract_state_dict(ckpt)
    if state is None:
        raise RuntimeError("Checkpoint does not contain a recognized model state dict")

    missing, unexpected = model.load_state_dict(state, strict=False)
    if missing or unexpected:
        raise RuntimeError(
            f"Checkpoint architecture mismatch: missing={len(missing)}, "
            f"unexpected={len(unexpected)}. Refusing to serve a partially loaded model."
        )

    model.eval()
    model.mcue_threshold = ckpt.get("mcue_threshold") if isinstance(ckpt, dict) else None

    epoch = ckpt.get("epoch", "unknown") if isinstance(ckpt, dict) else "unknown"
    score = ckpt.get("val_acc", ckpt.get("combined_score", "unknown")) if isinstance(ckpt, dict) else "unknown"
    print(f"[INFO] Model loaded -- epoch={epoch}, val_acc/score={score}")
    return model
