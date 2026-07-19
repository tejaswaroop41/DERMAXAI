"""
DERMAXAI v6 — Core Configuration
Centralized settings for the entire backend.
"""
import os
from pathlib import Path


def _csv_env(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]

BASE_DIR = Path(__file__).resolve().parent.parent


def _default_model_path(base_dir: Path = BASE_DIR) -> str:
    """Return the preferred checkpoint path, with a legacy local fallback."""
    model_dir = Path(base_dir) / "models"
    preferred = model_dir / "best.pth"
    legacy = model_dir / "dermaxai_v5_best.pth"
    if preferred.exists() or not legacy.exists():
        return str(preferred)
    return str(legacy)


class Settings:
    # ── App ──────────────────────────────────────────────
    APP_NAME    = "DERMAXAI v6"
    APP_VERSION = "6.0.0"
    DEBUG       = os.getenv("DEBUG", "false").lower() == "true"

    # ── Paths ────────────────────────────────────────────
    MODEL_PATH = os.getenv("MODEL_PATH", _default_model_path())
    UPLOADS_DIR     = os.getenv("UPLOADS_DIR", str(BASE_DIR / "uploads"))
    HEATMAPS_DIR    = os.getenv("HEATMAPS_DIR", str(BASE_DIR / "heatmaps"))
    REPORTS_DIR     = os.getenv("REPORTS_DIR", str(BASE_DIR / "generated_reports"))
    KNOWLEDGE_DIR   = os.getenv("KNOWLEDGE_DIR", str(BASE_DIR / "knowledge"))

    # ── Database ─────────────────────────────────────────
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/dermaxai.db")

    # ── Auth ─────────────────────────────────────────────
    SECRET_KEY  = os.getenv("SECRET_KEY", "dermaxai-v6-change-in-production")
    ALGORITHM   = "HS256"
    TOKEN_EXPIRE_MINUTES = 60 * 24

    # ── Model architecture (must match training) ──────────
    MODEL_NAME  = "efficientnet_b3"
    IMG_SIZE    = 224
    DROPOUT     = 0.3
    NUM_CLASSES = 7

    # CRITICAL: this order must exactly match CLASS_NAMES in the training
    # notebook (Cell 4), since it defines what each output index means.
    # Do NOT alphabetize this list.
    CLASSES = ['mel', 'nv', 'bcc', 'akiec', 'bkl', 'df', 'vasc']
    MALIGNANT_CLASSES = ['akiec', 'bcc', 'mel']
    MINORITY_CLASSES  = ['df', 'vasc', 'akiec']

    CLASS_FULL_NAMES = {
        'akiec': 'Actinic Keratoses',
        'bcc':   'Basal Cell Carcinoma',
        'bkl':   'Benign Keratosis',
        'df':    'Dermatofibroma',
        'mel':   'Melanoma',
        'nv':    'Melanocytic Nevi',
        'vasc':  'Vascular Lesions',
    }

    # ── Inference ────────────────────────────────────────
    TTA_CROPS         = 8
    MC_DROPOUT_PASSES = 20
    UNCERTAINTY_THETA = 0.40   # MCUE deferral threshold (entropy-normalized)

    # ── Normalization (must match training) ───────────────
    NORM_MEAN = [0.485, 0.456, 0.406]
    NORM_STD  = [0.229, 0.224, 0.225]

    # ── CORS ─────────────────────────────────────────────
    CORS_ORIGINS = _csv_env("CORS_ORIGINS", ["*"])

settings = Settings()

# Ensure runtime directories exist
for d in [settings.UPLOADS_DIR, settings.HEATMAPS_DIR,
          settings.REPORTS_DIR, settings.KNOWLEDGE_DIR]:
    os.makedirs(d, exist_ok=True)
