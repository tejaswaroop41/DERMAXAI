"""
DERMAXAI v6 — Image Preprocessing
Implements the exact same augmentation pipeline used at training time
for standard inference, plus 8-crop TTA transforms.
"""
import numpy as np
import cv2
from PIL import Image
import albumentations as A
from albumentations.pytorch import ToTensorV2

from core.config import settings

NORM = dict(mean=settings.NORM_MEAN, std=settings.NORM_STD)
IMG_SIZE = settings.IMG_SIZE


def get_inference_transform():
    """Standard single-pass inference transform."""
    return A.Compose([
        A.Resize(IMG_SIZE, IMG_SIZE),
        A.Normalize(**NORM),
        ToTensorV2()
    ])


def get_tta_transforms(n=8):
    """
    8-crop Test-Time Augmentation transforms.
    Used at inference to average predictions over multiple views,
    improving robustness and reducing prediction variance.
    """
    base = [A.Resize(IMG_SIZE, IMG_SIZE)]
    tfms = [
        A.Compose(base + [A.Normalize(**NORM), ToTensorV2()]),
        A.Compose(base + [A.HorizontalFlip(p=1), A.Normalize(**NORM), ToTensorV2()]),
        A.Compose(base + [A.VerticalFlip(p=1), A.Normalize(**NORM), ToTensorV2()]),
        A.Compose(base + [A.Rotate(limit=90, p=1), A.Normalize(**NORM), ToTensorV2()]),
        A.Compose(base + [A.Rotate(limit=180, p=1), A.Normalize(**NORM), ToTensorV2()]),
        A.Compose(base + [A.Rotate(limit=270, p=1), A.Normalize(**NORM), ToTensorV2()]),
        A.Compose(base + [A.Transpose(p=1), A.Normalize(**NORM), ToTensorV2()]),
        A.Compose(base + [A.Rotate(limit=45, p=1), A.Normalize(**NORM), ToTensorV2()]),
    ]
    return tfms[:n]


def load_image(image_path: str) -> np.ndarray:
    """Load an image file and return as RGB numpy array."""
    img = Image.open(image_path).convert("RGB")
    return np.array(img)


def validate_image_quality(img_np: np.ndarray) -> dict:
    """
    Basic image quality checks before inference.
    Flags blurry, too-dark, or too-bright images that may
    reduce diagnostic confidence.
    """
    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)

    # Blur detection via Laplacian variance
    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    is_blurry  = blur_score < 100

    # Brightness check
    mean_brightness = gray.mean()
    too_dark  = mean_brightness < 40
    too_bright = mean_brightness > 220

    # Resolution check
    h, w = img_np.shape[:2]
    too_small = min(h, w) < 100

    warnings = []
    if is_blurry:   warnings.append("Image appears blurry — consider retaking for better accuracy")
    if too_dark:    warnings.append("Image is too dark — improve lighting conditions")
    if too_bright:  warnings.append("Image is overexposed — reduce lighting or flash")
    if too_small:   warnings.append("Image resolution is low — use higher quality capture")

    return {
        "is_valid":         len(warnings) == 0,
        "warnings":         warnings,
        "blur_score":       float(blur_score),
        "mean_brightness":  float(mean_brightness),
        "resolution":       f"{w}x{h}",
    }
