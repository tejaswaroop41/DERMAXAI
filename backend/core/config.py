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


def _bounded_int_value(name: str, raw: str, minimum: int, maximum: int) -> int:
    """Parse an integer configuration value and enforce safe runtime bounds."""
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"{name} must be an integer between {minimum} and {maximum}") from exc
    if not minimum <= value <= maximum:
        raise RuntimeError(f"{name} must be between {minimum} and {maximum}")
    return value


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

    # ── Password reset ───────────────────────────────────
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    PASSWORD_RESET_TOKEN_MINUTES = int(os.getenv("PASSWORD_RESET_TOKEN_MINUTES", "30"))
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
    SMTP_STARTTLS = os.getenv("SMTP_STARTTLS", "true").lower() == "true"

    # ── Model architecture (must match training) ──────────
    MODEL_NAME  = "efficientnet_b3"
    IMG_SIZE    = 300
    DROPOUT     = 0.3
    NUM_CLASSES = 7

    CLASSES = ['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc']

    # Only BCC and MEL are treated as malignant classes for the binary
    # malignant/not-malignant presentation layer. AKIEC is kept as a
    # separate clinical-concern class because the HAM10000 category combines
    # actinic keratoses with intraepithelial carcinoma/Bowen disease.
    MALIGNANT_CLASSES = ['bcc', 'mel']
    CLINICAL_CONCERN_CLASSES = ['akiec', 'bcc', 'mel']
    MINORITY_CLASSES  = ['df', 'vasc', 'akiec']

    CLASS_FULL_NAMES = {
        'akiec': 'Actinic Keratoses / Intraepithelial Carcinoma',
        'bcc':   'Basal Cell Carcinoma',
        'bkl':   'Benign Keratosis',
        'df':    'Dermatofibroma',
        'mel':   'Melanoma',
        'nv':    'Melanocytic Nevi',
        'vasc':  'Vascular Lesions',
    }

    # ── Inference ────────────────────────────────────────
    # Canonical name: this pipeline uses full-image transformed views,
    # not spatial crops. TTA_CROPS remains as a backward-compatible alias.
    _tta_raw = os.getenv("TTA_VIEWS", os.getenv("TTA_CROPS", "8"))
    TTA_VIEWS = _bounded_int_value("TTA_VIEWS", _tta_raw, 1, 8)
    TTA_CROPS = TTA_VIEWS  # deprecated compatibility alias; use TTA_VIEWS
    MC_DROPOUT_PASSES = _bounded_int_value(
        "MC_DROPOUT_PASSES", os.getenv("MC_DROPOUT_PASSES", "20"), 1, 64
    )

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
