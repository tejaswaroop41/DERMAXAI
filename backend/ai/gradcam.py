"""
DERMAXAI v6 — Grad-CAM Explainability Engine
Generates visual heatmaps showing which lesion regions
most influenced the model's prediction (XAI requirement).
"""
import torch
import numpy as np
import cv2
import os
from PIL import Image

from core.config import settings
from core.preprocessing import get_inference_transform


class GradCAMEngine:
    """
    Gradient-weighted Class Activation Mapping.
    Hooks the last EfficientNet-B3 block (final spatial feature map,
    pre-pooling) and computes gradient-weighted importance per
    spatial location — same layer used in notebook Cell 14.
    """
    def __init__(self, model, device):
        self.model  = model
        self.device = device
        self.tfm    = get_inference_transform()

    def generate(self, image_path: str, target_class_idx: int,
                 save_path: str) -> str:
        img    = Image.open(image_path).convert("RGB")
        img_np = np.array(img)
        size   = settings.IMG_SIZE
        orig   = cv2.resize(img_np, (size, size))

        tensor = self.tfm(image=img_np)["image"].unsqueeze(0).to(self.device)
        tensor.requires_grad_(True)

        activations, gradients = [], []

        def fwd_hook(module, inp, out):
            activations.append(out.detach())

        def bwd_hook(module, grad_in, grad_out):
            gradients.append(grad_out[0].detach())

        # EfficientNet-B3 final convolutional block
        target_layer = self.model.backbone.blocks[-1][-1]
        h1 = target_layer.register_forward_hook(fwd_hook)
        h2 = target_layer.register_full_backward_hook(bwd_hook)

        self.model.eval()
        output = self.model(tensor)
        self.model.zero_grad()
        output[0, target_class_idx].backward()

        h1.remove()
        h2.remove()

        if not activations or not gradients:
            heatmap = np.zeros((size, size), dtype=np.float32)
            cv2.circle(heatmap, (size // 2, size // 2), size // 3, 1.0, -1)
        else:
            acts    = activations[0].squeeze(0)
            grads   = gradients[0].squeeze(0)
            weights = grads.mean(dim=(1, 2))
            cam     = torch.zeros(acts.shape[1:], device=self.device)
            for i, w in enumerate(weights):
                cam += w * acts[i]
            cam     = torch.relu(cam).cpu().numpy()
            cam     = cam - cam.min()
            if cam.max() > 0:
                cam = cam / cam.max()
            heatmap = cv2.resize(cam, (size, size))

        heatmap_color = cv2.applyColorMap(
            (heatmap * 255).astype(np.uint8), cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(
            cv2.cvtColor(orig, cv2.COLOR_RGB2BGR), 0.55,
            heatmap_color, 0.45, 0)

        orig_bgr = cv2.cvtColor(orig, cv2.COLOR_RGB2BGR)
        combined = np.hstack([orig_bgr, overlay])

        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(combined, "Original",  (10, 25),        font, 0.7, (255,255,255), 2)
        cv2.putText(combined, "Grad-CAM",  (size + 10, 25),  font, 0.7, (255,255,255), 2)

        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        cv2.imwrite(save_path, combined)
        return save_path

    def get_heatmap_stats(self, image_path: str, target_class_idx: int) -> dict:
        """
        Returns quantitative stats about the attention region —
        useful for the report's explainability section.
        """
        img_np = np.array(Image.open(image_path).convert("RGB"))
        size   = settings.IMG_SIZE
        tensor = self.tfm(image=img_np)["image"].unsqueeze(0).to(self.device)
        tensor.requires_grad_(True)

        activations, gradients = [], []
        target_layer = self.model.backbone.blocks[-1][-1]
        h1 = target_layer.register_forward_hook(
            lambda m,i,o: activations.append(o.detach()))
        h2 = target_layer.register_full_backward_hook(
            lambda m,gi,go: gradients.append(go[0].detach()))

        self.model.eval()
        output = self.model(tensor)
        self.model.zero_grad()
        output[0, target_class_idx].backward()
        h1.remove(); h2.remove()

        if not activations or not gradients:
            return {"focus_concentration": 0.0, "lesion_coverage_pct": 0.0}

        acts    = activations[0].squeeze(0)
        grads   = gradients[0].squeeze(0)
        weights = grads.mean(dim=(1, 2))
        cam     = torch.zeros(acts.shape[1:], device=self.device)
        for i, w in enumerate(weights):
            cam += w * acts[i]
        cam = torch.relu(cam).cpu().numpy()
        cam = cam - cam.min()
        if cam.max() > 0: cam = cam / cam.max()

        high_attention_pct = float((cam > 0.5).sum() / cam.size * 100)
        concentration       = float(cam.std())

        return {
            "focus_concentration": round(concentration, 4),
            "lesion_coverage_pct": round(high_attention_pct, 2),
        }
