# DERMAXAI v6
### Multimodal AI-Powered Healthcare Diagnostic Assistant

> Final Year BE Project — Dr. AIT, Bengaluru | Course: 22CSP605 | 2025–26  
> Guide: Dr. Suresha D, Assoc. Prof., CSE Programme

DERMAXAI is a multimodal dermatology screening and clinical-review support system. It combines dermoscopic image classification with symptom analysis, demographic risk analysis, uncertainty estimation, explainable AI, clinical recommendations, lesion tracking, doctor review, and report generation.

This README deliberately contains **both** parts of the project documentation:

1. **Technical/project documentation** — architecture, workflows, API, database, setup, Docker, security, testing, and limitations.
2. **Algorithm documentation** — the exact algorithm/method used at each step of the diagnosis pipeline, with the corresponding implementation file.

> DERMAXAI is a student research/prototype screening and decision-support system. It is not a substitute for dermatologist assessment, clinical examination, or histopathological confirmation.

---

# Part A — Algorithm and AI Pipeline

## 1. Algorithm-to-Pipeline Mapping

| Step | Algorithm / Method | Implementation | Purpose |
|---|---|---|---|
| 1 | Image/file validation | `backend/ai/predictor.py` | Verify extension and actual encoded image |
| 2 | Laplacian variance + brightness + resolution checks | `backend/core/preprocessing.py` | Detect poor-quality input |
| 3 | Resize + ImageNet normalization | `backend/core/preprocessing.py` | Create model-ready 300×300 input |
| 4 | **TTA** — deterministic full-image views | `backend/core/preprocessing.py` | Obtain multiple inference views |
| 5 | **EfficientNet-B3** | `backend/core/model.py` | Extract deep spatial image features |
| 6 | **CBAM** channel + spatial attention | `backend/core/model.py` | Reweight informative features |
| 7 | **GeM** pooling | `backend/core/model.py` | Convert feature maps to a feature vector |
| 8 | LayerNorm + Linear + GELU + Dropout MLP | `backend/core/model.py` | Produce 7-class logits |
| 9 | Mel-only logit adjustment | `backend/ai/predictor.py` | Apply the configured targeted `mel` adjustment |
| 10 | Softmax + TTA probability averaging | `backend/ai/predictor.py` | Produce class probabilities and image confidence |
| 11 | **MC Dropout** | `backend/ai/predictor.py` | Produce stochastic prediction samples |
| 12 | **MCUE** | `backend/ai/uncertainty.py` | Estimate aleatory, epistemic, fusion and composite uncertainty |
| 13 | Rule-based clinical NLP + negation; optional BioBERT | `backend/ai/biobert_engine.py` | Convert symptoms into risk, duration and urgency |
| 14 | Demographic risk rules | `backend/ai/risk_engine.py` | Compute patient/profile risk contribution |
| 15 | **CMCA** | `backend/ai/decision_engine.py` | Fuse image concern, symptom risk and demographic risk |
| 16 | **Grad-CAM** | `backend/ai/gradcam.py` | Explain influential image regions |
| 17 | Otsu segmentation + ABCD features | `backend/ai/abcd_engine.py` | Generate lesion-context measurements |
| 18 | Knowledge-base recommendation rules | `backend/ai/recommendation_engine.py` | Produce recommendation, urgency and follow-up |
| 19 | SQLAlchemy + SQLite | `backend/core/database.py` | Persist diagnostic outputs |
| 20 | ReportLab | `backend/reports/report_generator.py` | Generate the PDF report |
| 21 | Atomic conditional database update | `backend/features/routes.py` | Attach a diagnosis safely to a tracked lesion |
| 22 | Doctor review workflow | `backend/app.py`, `backend/features/routes.py` | Queue, claim and review cases |

## 2. Complete Runtime Pipeline

```text
Dermoscopic Image + Symptoms + Patient Profile
                    │
                    ▼
              [1] Validation
                    │
                    ▼
              [2] Quality Checks
                    │
                    ▼
        [3] Resize + Normalization
                    │
                    ▼
               [4] TTA Views
                    │
                    ▼
        ┌───────────────────────────┐
        │     IMAGE CLASSIFIER      │
        │                           │
        │ [5] EfficientNet-B3       │
        │          ↓                │
        │ [6] CBAM                  │
        │          ↓                │
        │ [7] GeM                   │
        │          ↓                │
        │ [8] MLP Head              │
        │          ↓                │
        │ [9] Mel Logit Adjustment  │
        │          ↓                │
        │ [10] Softmax + TTA Mean   │
        └────────────┬──────────────┘
                     │
              Class + Confidence
                     │
              ┌──────┴──────┐
              ▼             ▼
      [11] MC Dropout    TTA distribution
              │             │
              └──────┬──────┘
                     ▼
                  [12] MCUE
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
   Image concern [13] NLP [14] Demographic
       mass       risk          risk
          │          │             │
          └──────────┼─────────────┘
                     ▼
                  [15] CMCA
                     │
                     ▼
          Clinical concern / review
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
 [16] Grad-CAM   [17] ABCD   [18] Recommendation
       │             │             │
       └─────────────┼─────────────┘
                     ▼
              [19] Diagnosis Record
                │            │
                ▼            ▼
          [20] PDF      [21] Lesion Tracking
                               │
                               ▼
                         [22] Doctor Review
```

## 3. Training-Time Algorithms

These methods are used to create the deployed checkpoint; they are not rerun during a normal diagnosis request.

| Method | Training role | Details |
|---|---|---|
| **ACWF-FL** | Loss | Effective-number class weighting + focal loss; `β=0.9999`, `γ=2.0`, with `1.5×` malignant-class loss amplification |
| **SAM** | Training phase | Sharpness-Aware Minimization |
| **SWA** | Final training phase | Stochastic Weight Averaging |

```text
Dataset
   ↓
EfficientNet-B3 + CBAM + GeM + MLP
   ↓
ACWF-FL
   ↓
SAM
   ↓
SWA
   ↓
Trained checkpoint
```

## 4. Steps 1–4 — Input Processing and TTA

### Step 1 — Image validation

The predictor checks both the declared extension and the real image encoding.

```text
.jpg   .jpeg   .png   .bmp
```

### Step 2 — Image quality checks

The preprocessing layer uses:

- **Laplacian variance** for blur (`< 100` flagged)
- grayscale mean brightness (`< 40` too dark, `> 220` too bright)
- minimum image dimension (`< 100 px` flagged)

These checks create quality warnings; they do not alter classifier probabilities.

### Step 3 — Preprocessing

```text
Resize → 300 × 300
Normalize → ImageNet statistics
```

```text
Mean = [0.485, 0.456, 0.406]
Std  = [0.229, 0.224, 0.225]
```

### Step 4 — TTA

Default deterministic full-image views:

```text
1. Original
2. Horizontal flip
3. Vertical flip
4. Rotate 90°
5. Rotate 180°
6. Rotate 270°
7. Transpose
8. Rotate 45°
```

Each transformed view is classified and the resulting probability vectors are averaged.

## 5. Steps 5–8 — Image Classification Model

```text
EfficientNet-B3
      ↓
CBAM Channel Attention
      ↓
CBAM Spatial Attention
      ↓
GeM Pooling
      ↓
LayerNorm
      ↓
Linear → 512
      ↓
GELU → Dropout(0.3)
      ↓
LayerNorm
      ↓
Linear → 256
      ↓
GELU → Dropout(0.3)
      ↓
LayerNorm
      ↓
Linear → 7 classes
```

### Step 5 — EfficientNet-B3

The timm EfficientNet-B3 backbone extracts the final spatial feature map used by the attention and pooling stages.

### Step 6 — CBAM

```text
Feature Maps
   ↓
Channel Attention
   ↓
Spatial Attention
   ↓
Refined Feature Maps
```

### Step 7 — GeM

```text
GeM(x) = ( mean(clamp(x, eps)^p) )^(1/p)
```

The pooling exponent `p` is learnable.

### Step 8 — MLP head

The pooled vector passes through LayerNorm, Linear, GELU and Dropout blocks before the final 7-class linear layer.

Classes:

```text
akiec · bcc · bkl · df · mel · nv · vasc
```

## 6. Steps 9–10 — Prediction and Logit Adjustment

### Step 9 — Mel-only logit adjustment

```text
LOGIT_ADJUSTMENT_ENABLED = true
LOGIT_ADJUSTMENT_CLASS   = mel
LOGIT_ADJUSTMENT_TAU     = 0.3
MEL_LOG_PRIOR            = -2.1970
```

Only the `mel` logit is modified, before softmax.

### Step 10 — Softmax + TTA averaging

```text
Model logits
    ↓
Mel adjustment
    ↓
Softmax
    ↓
Probability vector per TTA view
    ↓
TTA probability mean
    ↓
Predicted class + image confidence
```

## 7. Steps 11–12 — MC Dropout and MCUE

### Step 11 — MC Dropout

The predictor performs repeated stochastic passes with only explicit Dropout layers switched to training mode; the rest of the network remains in evaluation mode.

```text
MC_DROPOUT_PASSES = 20
```

### Step 12 — MCUE

MCUE uses the deterministic TTA distribution and stochastic MC samples.

```text
Aleatory
= expected normalized entropy

Epistemic
= entropy(MC mean) - mean(MC entropy)

Fusion
= normalized Jensen-Shannon divergence(TTA, MC mean)
```

```text
Composite
= 0.4 × Aleatory
+ 0.4 × Epistemic
+ 0.2 × Fusion
```

The review threshold uses the checkpoint `mcue_threshold` when available; otherwise the configuration fallback is `0.8054`.

## 8. Step 13 — Symptom NLP

The deployed singleton uses rule-based clinical NLP by default. The module contains an optional BioBERT transformer capability, but it is disabled in the current runtime configuration.

```text
Symptom Text
    ↓
Keyword Matching
    ↓
Negation Handling
    ↓
Duplicate / Overlap Suppression
    ↓
Weighted Risk Accumulation
    ↓
Symptom Risk Score
    ↓
Duration + Urgency
```

## 9. Step 14 — Demographic Risk

```text
Age Risk
    +
Fitzpatrick Skin-Type Risk
    +
Medical / Family-History Risk
    +
Sun-Exposure Risk
    ↓
Demographic Risk Score [0,1]
```

The implementation returns both the composite score and the contributing-factor breakdown. Gender is accepted as an input but does not receive a separate weight in the current scoring implementation.

## 10. Step 15 — CMCA Multimodal Fusion

**CMCA = Cross-Modal Confidence Aggregation.**

Image masses:

```text
Malignancy Mass
= P(bcc) + P(mel)

Clinical-Concern Mass
= P(akiec) + P(bcc) + P(mel)
```

CMCA combines:

```text
Image clinical-concern mass
Symptom risk
Demographic risk
```

Evidence-adaptive weights:

```text
image        = 0.25 + 0.75 × image confidence
symptoms     = 0.25 + 0.75 × symptom risk
demographics = 0.25 + 0.75 × demographic risk
```

Decision thresholds currently implemented:

```text
CMCA concern threshold      = 0.30
Malignancy-mass escalation  = 0.30
Malignant review floor      = 0.70
```

CMCA creates a broader clinical-concern/review signal. It does **not** replace the image-model predicted class.

## 11. Malignant vs Clinical Concern

```python
MALIGNANT_CLASSES = ['bcc', 'mel']
CLINICAL_CONCERN_CLASSES = ['akiec', 'bcc', 'mel']
```

| Class | Malignant | Clinical concern |
|---|---:|---:|
| `akiec` | No | Yes |
| `bcc` | Yes | Yes |
| `bkl` | No | No |
| `df` | No | No |
| `mel` | Yes | Yes |
| `nv` | No | No |
| `vasc` | No | No |

```text
Predicted class
    = image-model output

Malignant signal
    = predicted class ∈ {bcc, mel}

Clinical-concern signal
    = concern class OR multimodal/review escalation
```

## 12. Steps 16–17 — Explainability

### Step 16 — Grad-CAM

```text
Selected class
      ↓
Forward activations
      ↓
Backward gradients
      ↓
Channel weights
      ↓
Weighted feature map
      ↓
ReLU + normalization
      ↓
Heatmap overlay
```

Grad-CAM is generated from the final spatial backbone block for the selected class.

### Step 17 — Otsu + ABCD

```text
Image
  ↓
Otsu thresholding
  ↓
Morphological opening / closing
  ↓
Largest lesion contour
  ↓
Asymmetry
Border irregularity
Color variation
Diameter (pixels)
```

ABCD is a contextual/explainability output and is **not fed back into the classifier**.

## 13. Step 18 — Recommendation Layer

```text
Prediction
 +
Malignancy status
 +
Uncertainty / review state
 +
Symptom urgency
 +
Class knowledge
 ↓
Recommendation Engine
 ↓
Recommendation + urgency + follow-up
```

Knowledge is loaded from `backend/knowledge/`.

## 14. Steps 19–22 — Persistence and Clinical Workflow

### Step 19 — Diagnosis persistence

The diagnosis record stores prediction, confidence, uncertainty values, symptom risk, demographic risk, class probabilities, modality weights, ABCD features, and generated artifact paths.

### Step 20 — PDF report

ReportLab produces the PDF report using the decision, uncertainty, recommendations, class probabilities and available Grad-CAM output.

### Step 21 — Lesion tracking

Patient-owned lesions group serial diagnoses. Diagnosis-to-lesion assignment uses a conditional database update so concurrent stale sessions cannot both claim the same unassigned diagnosis.

### Step 22 — Doctor review

```text
Doctor Queue
   ↓
Claim Case
   ↓
Review
   ↓
confirmed / revised / dismissed
```

Only the doctor who claimed the case may submit that review.

---

# Part B — Complete Project Documentation

## 15. Project Architecture

DERMAXAI is structured into four logical layers:

### AI inference

EfficientNet-B3, CBAM, GeM, MLP, TTA, MC Dropout and MCUE.

### Multimodal reasoning

Symptom NLP, demographic risk and CMCA.

### Clinical workflow

Grad-CAM, ABCD, recommendations, PDF reporting, lesion tracking and doctor review.

### Application layer

FastAPI, SQLAlchemy, SQLite, JWT authentication, React/Vite frontend, Nginx and Docker Compose.

## 16. End-to-End Application Workflow

```text
Register / Login
      ↓
Patient profile
      ↓
Upload image + optional symptoms
      ↓
AI inference pipeline
      ↓
Decision + uncertainty + explanation + recommendation
      ↓
Diagnosis record
      ├── History
      ├── Lesion tracking
      ├── PDF report
      └── Doctor review when required
```

## 17. Main Application Capabilities

| Area | Capability |
|---|---|
| Authentication | Register, login, current-user, forgot-password, reset-password |
| Diagnosis | Dermoscopic image analysis with optional symptoms/profile data |
| Uncertainty | MC Dropout + MCUE |
| Explainability | Grad-CAM + ABCD context |
| Recommendations | Class-specific knowledge-base guidance |
| History | Patient diagnosis history |
| Lesions | Create lesions and attach diagnoses for longitudinal tracking |
| Doctor workflow | Queue, claim and review cases |
| Reports | Generate and retrieve PDF clinical reports |
| Administration | User management and aggregate diagnosis/review analytics |

## 18. Backend API Overview

The primary FastAPI endpoints include:

```text
GET  /api/health

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password

POST /api/diagnose
```

Additional feature routes cover diagnosis history, lesions, reports, doctor review, notifications and administrative analytics. Interactive API documentation is available from FastAPI at `/docs` when the backend is running.

## 19. Database Design

The SQLAlchemy model layer contains:

```text
users
  │
  ├── patients
  ├── diagnoses
  └── lesions
          │
          └── diagnoses

users (doctor)
  │
  └── doctor_reviews ─── diagnoses
```

### Main tables

**users** — credentials, role, activation state, token version and password-reset nonce hash.

**patients** — age, gender, skin type, medical history and sun exposure.

**diagnoses** — image path, predicted class, confidence, malignancy state, review state, uncertainty, risk values, class probabilities, modality weights, ABCD data and artifact paths.

**lesions** — patient-owned tracked lesions used to group serial diagnoses.

**doctor_reviews** — claim state, verdict, notes and review timestamps.

## 20. Database Migrations

Alembic is the schema authority for the production/runtime database.

Current migration chain:

```text
0001_initial_schema
        ↓
0002_lesion_tracking
        ↓
0003_token_version
```

`0002` adds patient-owned lesions and `diagnoses.lesion_id`.

`0003` adds `users.token_version` and SQLite security triggers that revoke token generations when passwords change or accounts are deactivated.

For a database that already contains the `0001`/`0002` schema but has no Alembic revision recorded, inspect the schema before stamping it. Do not blindly rerun the initial migration against existing tables.

## 21. Authentication and Security

The backend uses JWT access tokens and password hashing. Security-sensitive changes use token-version invalidation so previously issued access tokens can be rejected after password changes or account deactivation.

Password reset uses a hashed nonce bound to the reset token. The nonce is committed **before** the reset email is sent, and failed email delivery only clears the nonce generated by that request.

Auth endpoints are rate-limited with SlowAPI. Examples in the current implementation include:

```text
register       → 5/minute
login          → 10/minute
forgot-password → 3/minute
reset-password  → 5/minute
```

## 22. Project Structure

```text
DERMAXAI/
├── backend/
│   ├── ai/
│   │   ├── predictor.py
│   │   ├── uncertainty.py
│   │   ├── decision_engine.py
│   │   ├── biobert_engine.py
│   │   ├── text_negation.py
│   │   ├── risk_engine.py
│   │   ├── gradcam.py
│   │   ├── abcd_engine.py
│   │   └── recommendation_engine.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── model.py
│   │   └── preprocessing.py
│   ├── features/
│   │   └── routes.py
│   ├── reports/
│   │   └── report_generator.py
│   ├── knowledge/
│   ├── models/
│   │   └── best.pth
│   ├── alembic/
│   ├── tests/
│   ├── app.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

## 23. Technology Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Uvicorn |
| ORM / DB | SQLAlchemy + SQLite |
| Migrations | Alembic |
| Authentication | JWT + Passlib/bcrypt |
| Rate limiting | SlowAPI |
| Deep learning | PyTorch + timm |
| Vision model | EfficientNet-B3 + CBAM + GeM + MLP |
| Image processing | OpenCV + Pillow + Albumentations |
| NLP | Rule-based engine + optional Transformers/BioBERT |
| Explainability | Grad-CAM |
| Reports | ReportLab |
| Frontend | React + Vite + Tailwind CSS |
| Charts | Recharts |
| Runtime | Docker Compose |
| CI | GitHub Actions |

## 24. Runtime Configuration

Important backend settings include:

```text
MODEL_NAME              = efficientnet_b3
IMG_SIZE                = 300
DROPOUT                 = 0.3
NUM_CLASSES             = 7
TTA_VIEWS               = 8
MC_DROPOUT_PASSES       = 20
UNCERTAINTY_THETA       = 0.8054
```

Authentication/configuration variables include `SECRET_KEY`, `DATABASE_URL`, `MODEL_PATH`, `FRONTEND_URL`, CORS settings and SMTP/password-reset settings.

For non-debug deployments, `SECRET_KEY` must be explicitly configured.

## 25. Model Checkpoint

The runtime expects a trained checkpoint, normally at:

```text
backend/models/best.pth
```

The loader refuses to start with random weights unless the development-only environment flag is explicitly enabled:

```text
ALLOW_RANDOM_WEIGHTS=true
```

When a checkpoint provides class names, their order is validated against the configured seven-class order before serving predictions.

## 26. Local Development

### Backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
alembic upgrade head
uvicorn app:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### API documentation

Open:

```text
http://127.0.0.1:8000/docs
```

## 27. Docker Deployment

```bash
docker compose up --build
```

The current Compose design runs:

```text
Frontend container
    ↓
Nginx
    ↓
Backend container
    ↓
SQLite database + persistent /data volume
```

The backend mounts the trained model directory read-only inside the container. Backend health is checked through `/api/health`; the frontend waits for the backend healthcheck before startup.

## 28. Testing and CI

Backend tests are located under `backend/tests/`. Important regression areas include:

- authentication and password reset;
- token revocation;
- clinical-concern semantics;
- atomic lesion assignment;
- symptom negation and duplicate keyword handling;
- database/route smoke tests.

Frontend checks use the package scripts for `build` and `lint`.

GitHub Actions runs repository CI for syntax/test/build checks.

## 29. Important Runtime Data Contracts

The system intentionally keeps these fields separate:

```text
predicted_class
image_confidence
is_malignant
clinical_concern
requires_review
urgency_escalated
composite_uncertainty
cmca_clinical_concern_score
```

A higher-level CMCA concern score must not be represented as an image-model class prediction or as a calibrated malignancy probability.

## 30. Current Limitations and Scope

- This is a student research/prototype system, not a clinically validated diagnostic device.
- Model confidence, uncertainty and CMCA scores are decision-support signals, not guarantees of clinical safety.
- Symptom and demographic risk are rule-based contributions.
- ABCD features are contextual and are not classifier inputs.
- The application database does not store an independent clinical ground-truth label, so operational review statistics must not be presented as model accuracy.
- The current live symptom engine defaults to rule-based NLP; BioBERT is an optional capability.

## 31. Project Summary

DERMAXAI combines a deep image-classification pipeline with uncertainty estimation and multimodal clinical reasoning while preserving a clear separation between classification, malignancy evidence, clinical concern, and review escalation.

The central technical pipeline is:

```text
Input Validation
 → Quality Analysis
 → Preprocessing
 → TTA
 → EfficientNet-B3
 → CBAM
 → GeM
 → MLP
 → Mel Logit Adjustment
 → Softmax/TTA Mean
 → MC Dropout
 → MCUE
 → Symptom NLP
 → Demographic Risk
 → CMCA
 → Grad-CAM
 → ABCD
 → Recommendation
 → Database
 → PDF / Lesion Tracking / Doctor Review
```

Training uses:

```text
ACWF-FL → SAM → SWA
```

This README is intended to make both the **project as a complete software system** and the **algorithm used at every processing step** understandable from a single document.
