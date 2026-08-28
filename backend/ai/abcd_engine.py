"""
DERMAXAI -- ABCD Explainability Engine
Ports the ABCD dermoscopy feature extraction from the DERMAXAI_NOVA
training notebook (Cell 6) into the live inference pipeline.

IMPORTANT: these features are explainability output ONLY -- they are
computed alongside the model's prediction for clinician/patient context
(matching real ABCD dermoscopy criteria clinicians already use), but are
NEVER fed into the classifier itself. Changing this file cannot change
what the model predicts, only what's shown about the image.

Asymmetry, border irregularity, and color variation are unitless scores
in [0, 1] (higher = more asymmetric / more irregular / more varied).
Diameter is reported in pixels (no physical calibration available from
a single 2D dermoscopic image without a reference scale).
"""
import math
import cv2
import numpy as np


def _otsu_segment(img_bgr: np.ndarray):
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    # lesion is usually the darker central region; if mask covers >70% of
    # the image, the threshold likely inverted onto the background instead
    if mask.mean() / 255 > 0.7:
        mask = 255 - mask
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return mask, None
    largest = max(contours, key=cv2.contourArea)
    return mask, largest


def _normalized_color_variation(lesion_pixels: np.ndarray):
    """Return mean channel standard deviation normalized to [0, 1]."""
    if lesion_pixels is None or len(lesion_pixels) == 0:
        return None
    channel_std_mean = lesion_pixels.reshape(-1, 3).std(axis=0).mean()
    return float(np.clip(channel_std_mean / 255.0, 0, 1))


def extract_abcd_features(image_path: str) -> dict:
    """
    Returns a dict with asymmetry, border_irregularity, color_variation,
    diameter_px, and segmentation_ok. All four scores are None if Otsu
    segmentation fails to find a usable lesion contour (e.g. very low
    contrast image) -- callers should treat None as "not available",
    not as zero.
    """
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        return {"asymmetry": None, "border_irregularity": None,
                "color_variation": None, "diameter_px": None,
                "segmentation_ok": False}

    h, w = img_bgr.shape[:2]
    mask, contour = _otsu_segment(img_bgr)
    if contour is None or cv2.contourArea(contour) < 50:
        return {"asymmetry": None, "border_irregularity": None,
                "color_variation": None, "diameter_px": None,
                "segmentation_ok": False}

    lesion_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(lesion_mask, [contour], -1, 255, thickness=-1)

    # --- Asymmetry: overlap difference between the shape and its mirror ---
    flip_h = cv2.flip(lesion_mask, 1)
    flip_v = cv2.flip(lesion_mask, 0)
    area = lesion_mask.sum() / 255 + 1e-6
    diff_h = np.logical_xor(lesion_mask > 0, flip_h > 0).sum() / area
    diff_v = np.logical_xor(lesion_mask > 0, flip_v > 0).sum() / area
    asymmetry = float(np.clip((diff_h + diff_v) / 2, 0, 1))

    # --- Border irregularity: compactness deviation from a perfect circle ---
    perimeter = cv2.arcLength(contour, True)
    lesion_area = cv2.contourArea(contour)
    compactness = (4 * math.pi * lesion_area) / (perimeter ** 2 + 1e-6)
    border_irregularity = float(np.clip(1 - compactness, 0, 1))

    # --- Color variation: normalized channel dispersion within the lesion ---
    lesion_pixels = img_bgr[lesion_mask > 0]
    color_variation = _normalized_color_variation(lesion_pixels)

    # --- Diameter: min enclosing circle, in pixels ---
    (_, _), radius = cv2.minEnclosingCircle(contour)
    diameter_px = float(radius * 2)

    return {
        "asymmetry": round(asymmetry, 4),
        "border_irregularity": round(border_irregularity, 4),
        "color_variation": round(color_variation, 4) if color_variation is not None else None,
        "diameter_px": round(diameter_px, 1),
        "segmentation_ok": True,
    }
