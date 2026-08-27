"""
DERMAXAI v6 — Core Configuration
Centralized settings for the entire backend.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def _csv_env(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


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
    APP_NAME    = "DERMAXAI"
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
    _secret_key_env = os.getenv("SECRET_KEY")
    SECRET_KEY  = _secret_key_env or ""
    ALGORITHM   = "HS256"
    TOKEN_EXPIRE_MINUTES = 60 * 24

    # ── Model architecture (must match training) ──────────
    MODEL_NAME  = "efficientnet_b3"
    IMG_SIZE    = 300
    DROPOUT     = 0.3
    NUM_CLASSES = 7

    CLASSES = ['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc']
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

    UNCERTAINTY_THETA = 0.8054

    LOGIT_ADJUSTMENT_ENABLED = True
    LOGIT_ADJUSTMENT_CLASS   = "mel"
    LOGIT_ADJUSTMENT_TAU     = 0.3
    MEL_LOG_PRIOR            = -2.1970

    # ── Normalization (must match training) ───────────────
    NORM_MEAN = [0.485, 0.456, 0.406]
    NORM_STD  = [0.229, 0.224, 0.225]

    # ── CORS ─────────────────────────────────────────────
    CORS_ORIGINS = _csv_env(
        "CORS_ORIGINS",
        ["http://localhost:5173", "http://localhost:8000"]
    )


settings = Settings()

if not settings.SECRET_KEY and not settings.DEBUG:
    raise RuntimeError(
        "SECRET_KEY must be set in non-debug deployments. "
        "Refusing to start with an empty JWT signing key."
    )

for d in [settings.UPLOADS_DIR, settings.HEATMAPS_DIR,
          settings.REPORTS_DIR, settings.KNOWLEDGE_DIR]:
    os.makedirs(d, exist_ok=True)
