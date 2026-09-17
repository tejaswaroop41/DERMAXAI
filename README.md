# DERMAXAI v6
### Multimodal AI-Powered Healthcare Diagnostic Assistant

> Final Year BE Project — Dr. AIT, Bengaluru | Course: 22CSP605 | 2025–26  
> Guide: Dr. Suresha D, Assoc. Prof., CSE Programme

DERMAXAI is a multimodal dermatology screening and clinical-review support system. It combines dermoscopic image classification with symptom analysis, demographic risk analysis, uncertainty estimation, explainable AI, clinical recommendations, lesion tracking, doctor review, and report generation.

This README deliberately contains **both** parts of the project documentation:

1. **Complete project documentation** — architecture, workflows, API, database, setup, Docker, security, testing, and limitations.
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
| 9 | Mel-only logit adjustment | `backend/ai/predictor.py` | Apply targeted `mel` adjustment before softmax |
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
                    ▼
              [2] Quality Checks
                    ▼
        [3] Resize + Normalization
                    ▼
               [4] TTA Views
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

These methods create the deployed checkpoint and are not rerun during a normal `/api/diagnose` request.

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

The predictor checks both the declared extension and actual image encoding.

```text
.jpg   .jpeg   .png   .bmp
```

### Step 2 — Image quality checks

The preprocessing layer uses Laplacian variance for blur, grayscale mean brightness for exposure, and minimum image dimension for resolution. Current thresholds are `<100` for blur variance, `<40`/`>220` for brightness, and `<100 px` for minimum dimension.

These checks create warnings; they do not alter classifier probabilities.

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

Each view is classified and the resulting probability vectors are averaged.

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

EfficientNet-B3 extracts spatial features. CBAM applies channel attention followed by spatial attention. GeM performs generalized mean pooling with a learnable exponent. The pooled vector is passed through the LayerNorm/GELU/Dropout MLP before the final seven-class layer.

Classes:

```text
akiec · bcc · bkl · df · mel · nv · vasc
```

## 6. Steps 9–10 — Prediction

```text
Model logits
    ↓
Mel-only logit adjustment
    ↓
Softmax per TTA view
    ↓
Average probability vectors
    ↓
Predicted class + image confidence
```

Current configuration:

```text
LOGIT_ADJUSTMENT_ENABLED = true
LOGIT_ADJUSTMENT_CLASS   = mel
LOGIT_ADJUSTMENT_TAU     = 0.3
MEL_LOG_PRIOR            = -2.1970
```

Only the `mel` logit is adjusted before softmax.

## 7. Steps 11–12 — MC Dropout and MCUE

```text
MC_DROPOUT_PASSES = 20
```

Only explicit Dropout layers are enabled during the stochastic pass; the rest of the network remains in evaluation mode.

MCUE computes:

```text
Aleatory = expected normalized entropy
Epistemic = entropy(MC mean) - mean(MC entropy)
Fusion = normalized Jensen-Shannon divergence(TTA, MC mean)
```

```text
Composite
= 0.4 × Aleatory
+ 0.4 × Epistemic
+ 0.2 × Fusion
```

The checkpoint `mcue_threshold` is used when present; the configuration fallback is `0.8054`.

## 8. Step 13 — Symptom NLP

The default runtime uses rule-based clinical NLP. The module includes an optional BioBERT path, but the current singleton is initialized with transformer mode disabled.

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

The implementation returns a composite score and factor breakdown. Gender is accepted but has no separate scoring weight in the current implementation.

## 10. Step 15 — CMCA

**CMCA = Cross-Modal Confidence Aggregation.**

```text
Malignancy Mass
= P(bcc) + P(mel)

Clinical-Concern Mass
= P(akiec) + P(bcc) + P(mel)
```

The CMCA inputs are the image clinical-concern mass, symptom risk, and demographic risk.

Evidence-adaptive weights are:

```text
image        = 0.25 + 0.75 × image confidence
symptoms     = 0.25 + 0.75 × symptom risk
demographics = 0.25 + 0.75 × demographic risk
```

Thresholds:

```text
CMCA concern threshold     = 0.30
Malignancy-mass escalation = 0.30
Malignant review floor     = 0.70
```

CMCA creates a clinical-concern/review signal. It does not overwrite `predicted_class`.

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

The image model remains responsible for the seven-class prediction. The application separately computes malignant status, clinical concern, uncertainty, and review escalation.

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

ABCD values are contextual/explainability outputs and are not classifier inputs.

## 13. Step 18 — Recommendation Engine

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

Class-specific knowledge is stored under `backend/knowledge/`.

## 14. Steps 19–22 — Persistence and Clinical Workflow

### Step 19 — Diagnosis persistence

The application persists prediction, confidence, uncertainty, symptom risk, demographic risk, class probabilities, modality weights, ABCD features, and generated artifact paths.

### Step 20 — PDF report

ReportLab generates the report using the decision, uncertainty, recommendations, class probabilities and available Grad-CAM result.

### Step 21 — Lesion tracking

Patient-owned lesions group serial diagnoses. Assignment uses a conditional database update so concurrent requests cannot both claim the same unassigned diagnosis.

### Step 22 — Doctor review

```text
Doctor Queue → Claim → Review → confirmed / revised / dismissed
```

Only the doctor who claimed the case can submit its review.

---

# Part B — Complete Project Documentation

## 15. What DERMAXAI Does

A normal patient workflow is:

```text
Register / Login
      ↓
Patient Profile
      ↓
Upload Dermoscopic Image
      ↓
Optional Symptoms + Profile Data
      ↓
AI Diagnostic Pipeline
      ↓
Prediction + Uncertainty + Clinical Concern
      ↓
Explainability + Recommendation
      ↓
Diagnosis Record
      ├── History
      ├── Lesion Tracking
      ├── PDF Report
      └── Doctor Review when escalated
```

## 16. System Architecture

### AI inference layer

EfficientNet-B3, CBAM, GeM, MLP, TTA, MC Dropout and MCUE.

### Multimodal reasoning layer

Rule-based symptom NLP, demographic risk engine and CMCA.

### Clinical workflow layer

Grad-CAM, ABCD context, knowledge-base recommendations, ReportLab reports, lesion tracking and doctor review.

### Application layer

FastAPI, SQLAlchemy, SQLite, JWT authentication, React/Vite, Tailwind CSS, Nginx, Docker Compose and GitHub Actions.

## 17. Main Capabilities

| Area | Capability |
|---|---|
| Authentication | Register, login, current-user, password reset |
| Diagnosis | Image analysis with optional symptoms/profile data |
| Uncertainty | MC Dropout + MCUE |
| Explainability | Grad-CAM + ABCD context |
| Recommendations | Class-specific knowledge-base guidance |
| History | Patient diagnosis history |
| Lesions | Longitudinal lesion tracking |
| Doctor workflow | Queue, claim and review |
| Reports | PDF generation and retrieval |
| Administration | User and aggregate diagnosis/review analytics |

## 18. Backend API Overview

Core endpoints include:

```text
GET  /api/health

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password

POST /api/diagnose
```

Additional routes cover history, lesions, reports, doctor review, notifications and administrative analytics. FastAPI interactive documentation is available at `/docs` when the server is running.

## 19. Diagnosis Request Data Flow

The `/api/diagnose` endpoint:

1. validates the uploaded extension;
2. reads the uploaded bytes and enforces the 10 MB limit;
3. stores the image under a generated UUID filename;
4. executes the predictor;
5. computes symptom risk;
6. loads diagnosis-time patient/profile information;
7. computes demographic risk;
8. computes MCUE;
9. fuses the signals with CMCA;
10. generates Grad-CAM when possible;
11. generates recommendations;
12. extracts ABCD features when possible;
13. persists the diagnosis record; and
14. generates a PDF report when possible.

## 20. Database Design

```text
users
  ├── patients
  ├── diagnoses
  └── lesions
          └── diagnoses

users (doctor)
  └── doctor_reviews ─── diagnoses
```

### `users`

Credentials, role, activation state, token version and password-reset nonce hash.

### `patients`

Age, gender, skin type, medical history and sun exposure.

### `diagnoses`

Image path, predicted class, confidence, malignancy state, review state, urgency, uncertainty values, risk values, class probabilities, modality weights, ABCD data and generated artifact paths.

### `lesions`

Patient-owned tracked lesions for grouping serial diagnoses.

### `doctor_reviews`

Case claim state, doctor, verdict, notes and review timestamps.

## 21. Alembic Migration Chain

Alembic is the schema authority for the runtime database.

```text
0001_initial_schema
        ↓
0002_lesion_tracking
        ↓
0003_token_version
```

`0002` creates patient-owned lesions and adds `diagnoses.lesion_id`.

`0003` adds `users.token_version` and SQLite security triggers for password-change and deactivation token revocation.

For an existing SQLite database whose tables already exist but Alembic has no current revision, inspect the schema first and stamp the correct existing revision before upgrading. Do not rerun the initial migration against an existing database.

## 22. Authentication and Security

The backend uses JWT access tokens with a per-user token version. Password hashing uses PassLib/bcrypt.

Password reset uses a hashed nonce associated with the reset token. The nonce is committed before email delivery, and failed delivery only removes the matching nonce for that request.

Current authentication rate limits include:

```text
register        → 5/minute
login           → 10/minute
forgot-password → 3/minute
reset-password  → 5/minute
```

## 23. Project Structure

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

## 24. Technology Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Uvicorn |
| ORM / DB | SQLAlchemy + SQLite |
| Migrations | Alembic |
| Authentication | JWT + PassLib/bcrypt |
| Rate limiting | SlowAPI |
| Deep learning | PyTorch + timm |
| Vision | EfficientNet-B3 + CBAM + GeM + MLP |
| Image processing | OpenCV + Pillow + Albumentations |
| NLP | Rule-based engine + optional Transformers/BioBERT |
| Explainability | Grad-CAM |
| Reports | ReportLab |
| Frontend | React + Vite + Tailwind CSS |
| Runtime | Docker Compose |
| CI | GitHub Actions |

## 25. Runtime Configuration

```text
MODEL_NAME        = efficientnet_b3
IMG_SIZE          = 300
DROPOUT           = 0.3
NUM_CLASSES       = 7
TTA_VIEWS         = 8
MC_DROPOUT_PASSES = 20
UNCERTAINTY_THETA = 0.8054
```

Environment configuration also covers `SECRET_KEY`, `DATABASE_URL`, `MODEL_PATH`, CORS origins, frontend URL and SMTP/password-reset settings.

Non-debug deployments require an explicit `SECRET_KEY`.

## 26. Model Checkpoint

The expected checkpoint is:

```text
backend/models/best.pth
```

The loader refuses to silently serve random weights. The development-only escape hatch is:

```text
ALLOW_RANDOM_WEIGHTS=true
```

When present, checkpoint `class_names` are checked against the configured seven-class order before the model is served.

## 27. Local Development

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

```text
http://127.0.0.1:8000/docs
```

## 28. Docker

```bash
docker compose up --build
```

The deployment consists of:

```text
Frontend container
    ↓
Nginx
    ↓
Backend container
    ↓
Persistent /data volume
    ├── SQLite DB
    ├── uploads
    ├── heatmaps
    └── generated reports
```

The trained model directory is mounted read-only into the backend container. The backend healthcheck uses `/api/health`, and the frontend waits for backend health before starting.

## 29. Testing and CI

Backend tests live in `backend/tests/`. Regression coverage includes authentication, password reset ordering, token revocation, clinical-concern semantics, atomic lesion assignment, symptom negation/keyword handling, and route/database smoke checks.

Frontend quality checks use:

```text
npm run build
npm run lint
```

GitHub Actions performs automated repository checks.

## 30. Data and Decision Contracts

The application keeps these fields separate:

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

The CMCA score is a clinical-concern/risk score, not a calibrated malignancy probability. Operational doctor-review statistics are not model-accuracy measurements because the application does not store an independent clinical ground-truth label.

## 31. Limitations and Academic Scope

- DERMAXAI is a student research/prototype system and is not presented as a clinically validated diagnostic device.
- Confidence and uncertainty outputs are decision-support signals, not guarantees.
- Symptom and demographic modules are rule-based risk contributions.
- ABCD is contextual and is not a classifier input.
- The default live NLP path is rule-based; BioBERT is optional.
- Clinical interpretation remains subject to professional review and, where appropriate, definitive clinical/histopathological evaluation.

## 32. Project Summary

DERMAXAI integrates a deep image-classification pipeline, uncertainty estimation, multimodal clinical reasoning, explainability, recommendations, longitudinal lesion tracking and doctor review into a single application.

The core AI sequence is:

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

The training sequence is:

```text
ACWF-FL → SAM → SWA
```

This document intentionally keeps **both** the high-level software/project documentation and the detailed algorithm-at-each-step explanation so the repository can be understood from the system level as well as from the AI/research level.
