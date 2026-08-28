"""
DERMAXAI v6 — Grad-CAM Explainability Engine
Generates visual heatmaps showing which lesion regions most influenced the prediction.
"""
import torch
import numpy as np
import cv2
import os
from PIL import Image

from core.config import settings
from core.preprocessing import get_inference_transform


class GradCAMEngine:
    def __init__(self, model, device):
        self.model = model
        self.device = device
        self.tfm = get_inference_transform()

    def _target_layer(self):
        """Return the final spatial backbone block, or None if the timm structure changed."""
        try:
            blocks = self.model.backbone.blocks
            return blocks[-1][-1]
        except (AttributeError, IndexError, TypeError):
            return None

    def _render(self, img_np, heatmap, save_path):
        size = settings.IMG_SIZE
        orig = cv2.resize(img_np, (size, size))
        heatmap_color = cv2.applyColorMap((heatmap * 255).astype(np.uint8), cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(cv2.cvtColor(orig, cv2.COLOR_RGB2BGR), 0.55, heatmap_color, 0.45, 0)
        combined = np.hstack([cv2.cvtColor(orig, cv2.COLOR_RGB2BGR), overlay])
        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(combined, "Original", (10, 25), font, 0.7, (255, 255, 255), 2)
        cv2.putText(combined, "Grad-CAM", (size + 10, 25), font, 0.7, (255, 255, 255), 2)
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        cv2.imwrite(save_path, combined)
        return save_path

    def generate(self, image_path: str, target_class_idx: int, save_path: str) -> str:
        img_np = np.array(Image.open(image_path).convert("RGB"))
        size = settings.IMG_SIZE
        target_layer = self._target_layer()
        if target_layer is None:
            raise RuntimeError("Grad-CAM target layer is unavailable; explanation not generated")

        tensor = self.tfm(image=img_np)["image"].unsqueeze(0).to(self.device)
        tensor.requires_grad_(True)
        activations, gradients = [], []

        def fwd_hook(module, inp, out):
            activations.append(out.detach())

        def bwd_hook(module, grad_in, grad_out):
            if grad_out and grad_out[0] is not None:
                gradients.append(grad_out[0].detach())

        h1 = target_layer.register_forward_hook(fwd_hook)
        h2 = target_layer.register_full_backward_hook(bwd_hook)
        try:
            self.model.eval()
            output = self.model(tensor)
            if output.ndim != 2 or output.shape[0] != 1 or not (0 <= target_class_idx < output.shape[1]):
                raise RuntimeError("Invalid Grad-CAM target class")
            self.model.zero_grad()
            output[0, target_class_idx].backward()
        finally:
            h1.remove()
            h2.remove()

        if not activations or not gradients:
            raise RuntimeError("Grad-CAM gradients or activations are unavailable; explanation not generated")

        acts = activations[0].squeeze(0)
        grads = gradients[0].squeeze(0)
        weights = grads.mean(dim=(1, 2))
        cam = torch.sum(weights[:, None, None] * acts, dim=0)
        cam = torch.relu(cam).cpu().numpy()
        cam = cam - cam.min()
        if cam.max() <= 0:
            raise RuntimeError("Grad-CAM produced an empty activation map; explanation not generated")
        cam = cam / cam.max()
        heatmap = cv2.resize(cam, (size, size))
        return self._render(img_np, heatmap, save_path)

    def get_heatmap_stats(self, image_path: str, target_class_idx: int) -> dict:
        img_np = np.array(Image.open(image_path).convert("RGB"))
        target_layer = self._target_layer()
        if target_layer is None:
            return {"focus_concentration": 0.0, "lesion_coverage_pct": 0.0, "fallback": True}

        tensor = self.tfm(image=img_np)["image"].unsqueeze(0).to(self.device)
        tensor.requires_grad_(True)
        activations, gradients = [], []
        h1 = target_layer.register_forward_hook(lambda m, i, o: activations.append(o.detach()))
        h2 = target_layer.register_full_backward_hook(
            lambda m, gi, go: gradients.append(go[0].detach()) if go and go[0] is not None else None
        )
        try:
            self.model.eval()
            output = self.model(tensor)
            if output.ndim != 2 or output.shape[0] != 1 or not (0 <= target_class_idx < output.shape[1]):
                return {"focus_concentration": 0.0, "lesion_coverage_pct": 0.0, "fallback": True}
            self.model.zero_grad()
            output[0, target_class_idx].backward()
        finally:
            h1.remove()
            h2.remove()

        if not activations or not gradients:
            return {"focus_concentration": 0.0, "lesion_coverage_pct": 0.0, "fallback": True}

        acts = activations[0].squeeze(0)
        grads = gradients[0].squeeze(0)
        weights = grads.mean(dim=(1, 2))
        cam = torch.sum(weights[:, None, None] * acts, dim=0)
        cam = torch.relu(cam).cpu().numpy()
        cam = cam - cam.min()
        if cam.max() <= 0:
            return {"focus_concentration": 0.0, "lesion_coverage_pct": 0.0, "fallback": True}
        cam = cam / cam.max()
        high_attention_pct = float((cam > 0.5).sum() / cam.size * 100)
        return {"focus_concentration": round(float(cam.std()), 4),
                "lesion_coverage_pct": round(high_attention_pct, 2),
                "fallback": False}
