# DERMAXAI v6
### Multimodal AI-Powered Healthcare Diagnostic Assistant

> Final Year BE Project — Dr. AIT, Bengaluru | Course: 22CSP605 | 2025–26  
> Guide: Dr. Suresha D, Assoc. Prof., CSE Programme

DERMAXAI is a multimodal dermatology screening and clinical-review support application that combines dermoscopic image analysis with symptom information, demographic risk factors, uncertainty estimation, explainable AI, clinical recommendations, lesion tracking, doctor review workflows, and PDF report generation.

The system is designed as a **screening and decision-support prototype**, not as a replacement for a dermatologist. The generated classification, concern signal, uncertainty metrics, explanations, recommendations, and reports are intended to support preliminary assessment and structured review.

---

## Table of Contents

- [Project Overview](#project-overview)
- [What DERMAXAI Does](#what-dermaxai-does)
- [End-to-End Workflow](#end-to-end-workflow)
- [Architecture Overview](#architecture-overview)
- [Clinical Class Semantics](#clinical-class-semantics)
- [Model Architecture](#model-architecture)
- [Novel Algorithms and Methods](#novel-algorithms-and-methods)
- [Multimodal Decision Logic](#multimodal-decision-logic)
- [Uncertainty Estimation](#uncertainty-estimation)
- [Explainable AI](#explainable-ai)
- [Symptom and Demographic Processing](#symptom-and-demographic-processing)
- [Clinical Recommendation Layer](#clinical-recommendation-layer)
- [PDF Report Generation](#pdf-report-generation)
- [User Roles and Application Workflows](#user-roles-and-application-workflows)
- [Frontend](#frontend)
- [Backend API](#backend-api)
- [Database Design](#database-design)
- [Database Migrations](#database-migrations)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Model Checkpoint](#model-checkpoint)
- [Configuration](#configuration)
- [Quick Start with Docker](#quick-start-with-docker)
- [Local Backend Development](#local-backend-development)
- [Local Frontend Development](#local-frontend-development)
- [Docker Architecture](#docker-architecture)
- [Authentication and Security](#authentication-and-security)
- [Testing and CI](#testing-and-ci)
- [Troubleshooting](#troubleshooting)
- [Expected Development Workflow](#expected-development-workflow)
- [Limitations and Scope](#limitations-and-scope)
- [Research and Academic Context](#research-and-academic-context)
- [License / Project Status](#license--project-status)

---

## Project Overview

DERMAXAI v6 is organized as a full-stack application with four major layers:

1. **AI inference layer** — EfficientNet-B3 based image classification with CBAM, GeM pooling, a LayerNorm/GELU/Dropout MLP head, TTA, and MC-dropout based uncertainty estimation.
2. **Multimodal reasoning layer** — symptom analysis, demographic risk assessment, and Cross-Modal Confidence Aggregation (CMCA).
3. **Clinical workflow layer** — recommendations, Grad-CAM explanations, reports, lesion history, doctor review, and administrative analytics.
4. **Application layer** — FastAPI backend, SQLite persistence, JWT authentication, React/Vite frontend, Nginx reverse proxy, Docker Compose, and GitHub Actions CI.

The application intentionally keeps the following concepts separate:

- the **image model's predicted class**;
- the **malignant class signal**;
- the broader **clinical-concern signal**;
- the **automated review requirement**;
- the **uncertainty score**; and
- the **multimodal CMCA concern score**.

That separation is important because a multimodal risk signal should not silently rewrite the image model's class prediction.

---

## What DERMAXAI Does

A typical patient workflow is:

```text
Create account / Login
        │
        ▼
Complete patient profile
        │
        ▼
Upload dermoscopic image
        │
        ├── Optional symptoms
        ├── Optional demographics/profile data
        └── Optional sun-exposure information
        │
        ▼
Image validation
        │
        ▼
TTA image inference
        │
        ├── Predicted class
        ├── Class probabilities
        └── Image confidence
        │
        ▼
MC-dropout sampling + MCUE
        │
        ├── Aleatory uncertainty
        ├── Epistemic uncertainty
        ├── Fusion uncertainty
        └── Composite uncertainty
        │
        ▼
Symptom analysis + demographic risk
        │
        ▼
CMCA multimodal concern analysis
        │
        ├── Malignancy mass
        ├── Clinical-concern mass
        ├── CMCA concern score
        ├── Review escalation
        └── Urgency escalation
        │
        ├───────────────┐
        ▼               ▼
   Grad-CAM      Recommendation engine
        │               │
        └───────┬───────┘
                ▼
        Persistent diagnosis record
                │
        ┌───────┴─────────────────────────┐
        ▼                                 ▼
 Patient history / lesions        PDF clinical report
        │
        ▼
 Optional doctor review workflow
```

---

## End-to-End Workflow

### 1. Authentication

The backend exposes registration, login, current-user, forgot-password, and reset-password endpoints. Patient self-registration is allowed through the public registration endpoint. Doctor accounts are intended to be provisioned through the admin workflow rather than selected by an arbitrary public registration request.

The frontend stores the access token locally and sends it as a Bearer token through the Axios API layer.

### 2. Patient profile

A patient profile can hold:

- age;
- gender;
- skin type;
- medical history; and
- sun exposure.

These values can be used by the demographic risk layer when a diagnosis is requested. Diagnosis-specific form values can override corresponding profile values when supplied.

### 3. Image intake

Before inference, the backend checks:

- the submitted filename/extension;
- the file size (10 MB maximum at the API boundary); and
- the actual encoded image format/content.

Supported image extensions are:

- `.jpg`
- `.jpeg`
- `.png`
- `.bmp`

The image is stored under a generated UUID-based filename before the AI pipeline runs.

### 4. Image inference

The predictor loads the trained checkpoint once at application startup and reuses the model singleton. Inference performs configured TTA views, averages the resulting class probabilities, selects the maximum-probability class, and reports the corresponding image confidence.

### 5. Uncertainty estimation

The predictor also performs stochastic MC-dropout passes. The uncertainty engine combines the stochastic distribution with the deterministic TTA distribution and produces normalized uncertainty components.

### 6. Multimodal reasoning

The system separately analyzes:

- image clinical-concern probability mass;
- symptom risk;
- demographic risk.

CMCA produces a clinical-concern score from these normalized signals. This score is explicitly **not** a calibrated probability of malignancy.

### 7. Explainability

Grad-CAM is generated for the predicted image class and stored so that the authenticated owner or a doctor can retrieve it.

### 8. Recommendations

The recommendation engine uses the decision, uncertainty, and symptom analysis to provide a structured recommendation payload containing class description, recommendation text, urgency level, and a suggested follow-up window.

### 9. Persistence and reporting

A diagnosis record stores the prediction, confidence, uncertainty values, symptom risk, demographic risk, class probabilities, modality weights, optional Grad-CAM path, optional report path, and ABCD feature extraction results.

A PDF report can then be generated from the same decision and evidence bundle.

### 10. Longitudinal lesion tracking

Patients can create named lesions and attach previously generated diagnoses to those lesions. This supports serial tracking of the same lesion over time.

Diagnosis attachment uses an atomic database update so that two concurrent requests cannot both claim an unassigned diagnosis for different lesions.

### 11. Doctor review

Doctors can view the review queue, claim cases, and submit one of the supported verdicts:

- `confirmed`
- `revised`
- `dismissed`

Only the doctor who claimed a case can submit its review. A uniqueness constraint on `doctor_reviews.diagnosis_id` prevents multiple active review records for the same diagnosis; an integrity-race is returned as a stable HTTP 409 response.

### 12. Administrative analytics

Administrators can view user management data and aggregate diagnosis/review metrics. The performance endpoint explicitly avoids presenting revision rate as model accuracy because ground-truth labels are not stored in the application database.

---

## Architecture Overview

```text
Dermoscopic Image
       │
       ▼
┌───────────────────────────────────────────────┐
│              IMAGE MODEL                      │
│                                               │
│  EfficientNet-B3 backbone                     │
│      │                                        │
│      ├── CBAM channel attention               │
│      ├── CBAM spatial attention               │
│      │                                        │
│      └── GeM pooling                          │
│               │                               │
│               ▼                               │
│  LayerNorm → Linear → GELU → Dropout          │
│      → LayerNorm → Linear → GELU → Dropout    │
│      → LayerNorm → Linear → 7 logits          │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
            TTA mean class probabilities
                       │
             ┌─────────┴─────────┐
             │                   │
             ▼                   ▼
       Primary result       MC-dropout samples
             │                   │
             │                   ▼
             │                MCUE
             │                   │
             └─────────┬─────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│              MULTIMODAL LAYER                │
│                                               │
│ Image clinical-concern mass ──────┐          │
│ Symptom risk ─────────────────────┼─► CMCA    │
│ Demographic risk ─────────────────┘          │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│                 DECISION                     │
│                                               │
│ Predicted class                              │
│ Image confidence                             │
│ Malignancy mass                              │
│ Clinical-concern mass                        │
│ CMCA clinical-concern score                  │
│ Clinical concern flag                        │
│ Review requirement                            │
│ Urgency escalation                            │
└───────────────┬──────────────────────────────┘
                │
       ┌────────┼───────────────┐
       ▼        ▼               ▼
   Grad-CAM Recommendations    ABCD
       │        │               │
       └────────┼───────────────┘
                ▼
        Database + PDF report
                │
        ┌───────┴────────┐
        ▼                ▼
  Patient workflow   Doctor workflow
```

---

## Clinical Class Semantics

The image model uses seven classes in this exact order:

```text
akiec · bcc · bkl · df · mel · nv · vasc
```

### Class definitions in the application

| Code | Application name | Presentation group |
|---|---|---|
| `akiec` | Actinic Keratoses / Intraepithelial Carcinoma | Clinical concern |
| `bcc` | Basal Cell Carcinoma | Malignant + clinical concern |
| `bkl` | Benign Keratosis | Non-malignant |
| `df` | Dermatofibroma | Non-malignant |
| `mel` | Melanoma | Malignant + clinical concern |
| `nv` | Melanocytic Nevi | Non-malignant |
| `vasc` | Vascular Lesions | Non-malignant |

The application maintains two explicit class lists:

```python
MALIGNANT_CLASSES = ['bcc', 'mel']
CLINICAL_CONCERN_CLASSES = ['akiec', 'bcc', 'mel']
```

### Why AKIEC is treated separately

`akiec` is kept inside the broader clinical-concern group rather than the binary malignant group used by the presentation layer. This avoids collapsing the dataset label and the application's broader review semantics into one flag.

Therefore:

```text
Predicted class      = image-model output
Malignant            = predicted class is bcc or mel
Clinical concern     = class is akiec/bcc/mel OR multimodal/review escalation
```

A case can therefore be clinically concerning without the UI or PDF describing it as simply malignant.

---

## Model Architecture

### EfficientNet-B3 backbone

The image classifier uses a `timm` EfficientNet-B3 backbone with feature extraction enabled. The runtime loads the backbone with `pretrained=False` and expects the complete trained checkpoint to contain compatible weights.

The application refuses to silently serve a partially loaded architecture. A checkpoint with missing/unexpected parameters is treated as an architecture mismatch.

### CBAM

CBAM (Convolutional Block Attention Module) is implemented as two sequential attention stages:

1. **Channel attention** — combines global average and global max pooled descriptors and passes them through a small MLP before applying a sigmoid gate.
2. **Spatial attention** — aggregates channel-wise average and maximum projections, concatenates them, and uses a convolutional gate to produce spatial attention.

The resulting operation can be summarized as:

```text
features
   │
   ▼
channel attention
   │
   ▼
spatial attention
   │
   ▼
refined features
```

### GeM pooling

The classifier uses Generalized Mean Pooling rather than a plain global average pool.

Conceptually, for a feature activation map `x` and learnable pooling parameter `p`:

```text
GeM(x) = ( mean( clamp(x, eps)^p ) )^(1/p)
```

The implementation learns `p` and uses a small epsilon to avoid invalid values.

### MLP classification head

The pooled feature vector is passed through three normalized/linear stages:

```text
LayerNorm
   ↓
Linear(feat_dim → 512)
   ↓
GELU
   ↓
Dropout(0.3)
   ↓
LayerNorm
   ↓
Linear(512 → 256)
   ↓
GELU
   ↓
Dropout(0.3)
   ↓
LayerNorm
   ↓
Linear(256 → 7)
```

### Checkpoint validation

The loader supports common checkpoint layouts such as:

- `model_state`
- `model_state_dict`
- a direct state dictionary

If the checkpoint explicitly contains `class_names`, the stored ordering must match the application's configured class order exactly.

The runtime also supports a development-only `ALLOW_RANDOM_WEIGHTS=true` path for CI/testing when a trained checkpoint is intentionally unavailable. Normal operation fails closed when trained weights cannot be found.

---

## Novel Algorithms and Methods

### ACWF-FL — Adaptive Class Weight Function + Focal Loss

The project training methodology documents an adaptive class-weighted focal-loss formulation using:

- effective-number based class weighting;
- focal loss with `γ = 2.0`;
- `β = 0.9999`; and
- an additional `1.5×` amplification for malignant-class loss.

This is a **training-time method**. The production inference service does not recalculate training loss.

### CMCA — Cross-Modal Confidence Aggregation

CMCA combines three normalized concern signals:

```text
1. image clinical-concern probability mass
2. symptom risk score
3. demographic risk score
```

The implementation uses evidence-adaptive modality weights with a non-zero baseline contribution for every modality.

The final value is a **clinical-concern score**, not a calibrated probability of malignancy.

### MCUE — Monte Carlo Uncertainty Estimation

MCUE combines:

- aleatory uncertainty;
- epistemic uncertainty; and
- disagreement between deterministic TTA inference and stochastic MC-dropout inference.

All reported components are normalized into `[0, 1]`.

### SAM — Sharpness-Aware Minimization

The project training methodology includes Sharpness-Aware Minimization as a training phase intended to seek flatter solutions and improve generalization.

### SWA — Stochastic Weight Averaging

The training methodology includes Stochastic Weight Averaging during the final phase to average weights over training epochs.

### TTA — Test-Time Augmentation

The runtime supports a configurable number of transformed image views. The default is `8`, with an allowed range of `1–8`.

TTA predictions are averaged at the probability level before selecting the primary class.

---

## Multimodal Decision Logic

The decision engine intentionally separates image classification from multimodal concern reasoning.

### Image confidence

`image_confidence` is the probability assigned to the selected image class after averaging configured TTA views.

It is not a fused confidence score derived from symptoms or demographics.

### Malignancy mass

The malignant probability mass is:

```text
malignancy_mass = P(bcc) + P(mel)
```

This quantity represents the total image-model probability assigned to the application's malignant classes.

### Clinical-concern mass

The clinical-concern mass is:

```text
clinical_concern_mass = P(akiec) + P(bcc) + P(mel)
```

### Adaptive modality weights

The decision engine calculates:

```text
image_weight       = 0.25 + 0.75 × image_confidence
symptom_weight     = 0.25 + 0.75 × symptom_score
demographic_weight = 0.25 + 0.75 × demographic_score
```

The weights are normalized and then applied to:

```text
image       → clinical_concern_mass
symptoms    → symptom_score
demographics→ demographic_score
```

The weighted result is the CMCA clinical-concern score.

### Review escalation

Automated review escalation is triggered when at least one of these conditions is true:

```text
symptom urgency flag
OR clinical_concern_mass >= 0.30
OR CMCA score >= 0.30
OR uncertainty requires review
OR malignant prediction has image confidence < 0.70
```

These thresholds are application decision thresholds; they should not be interpreted as medical diagnostic standards.

### Clinical concern flag

The API can report `clinical_concern` independently of `is_malignant`.

This prevents a case from being relabeled as malignant simply because symptoms, demographics, uncertainty, or multimodal evidence caused the case to require review.

---

## Uncertainty Estimation

MCUE is implemented in `backend/ai/uncertainty.py`.

### Predictive entropy

The engine normalizes the distribution and calculates entropy divided by `log(K)`, where `K` is the number of model classes:

```text
H_normalized = H(p) / log(K)
```

The resulting value is constrained to `[0, 1]`.

### Aleatory uncertainty

The mean entropy across stochastic MC-dropout samples is used as the aleatory component.

This represents uncertainty associated with the predictive distribution itself.

### Epistemic uncertainty

The engine uses normalized mutual information-style uncertainty:

```text
epistemic = predictive_entropy(mean_MC_distribution)
            - mean(expected_sample_entropy)
```

The result is clipped into `[0, 1]`.

### Fusion uncertainty

The deterministic TTA distribution and the mean MC-dropout distribution are compared with normalized Jensen-Shannon divergence.

### Composite uncertainty

The current transparent composition is:

```text
composite_uncertainty
    = 0.4 × aleatory
    + 0.4 × epistemic
    + 0.2 × fusion
```

The result is clipped into `[0, 1]`.

### Uncertainty review threshold

The runtime uses `0.8054` as the default uncertainty threshold unless the loaded checkpoint provides its own `mcue_threshold`.

```text
composite_uncertainty > theta_H
        ↓
requires_review = true
```

### Confidence labels

The UI-friendly uncertainty labels are derived from the composite uncertainty value:

| Composite uncertainty | Label |
|---|---|
| `< 0.20` | Very High |
| `0.20–<0.40` | High |
| `0.40–<0.60` | Moderate |
| `0.60–<0.80` | Low |
| `>= 0.80` | Very Low |

These labels describe **uncertainty**, not clinical disease severity.

---

## Explainable AI

### Grad-CAM

Grad-CAM is generated for the selected image class after the main prediction is calculated.

The generated image is stored under the configured heatmap directory and exposed through an authenticated API endpoint.

The frontend retrieves the heatmap as an authenticated blob rather than treating it as an unrestricted public asset.

The Grad-CAM visualization is intended to show which image regions influenced the model. It should not be interpreted as a clinically validated lesion segmentation mask.

---

## Symptom and Demographic Processing

### Symptom analysis

The runtime symptom engine is exposed through `backend/ai/biobert_engine.py`.

The application uses a rule-based/default symptom processing path and provides optional BioBERT/Transformer capability in the runtime dependencies.

The symptom engine returns a normalized `symptom_risk_score` plus an urgency signal used by CMCA.

### Demographic risk engine

The demographic risk layer is implemented in `backend/ai/risk_engine.py` and can consume:

- age;
- gender;
- skin type;
- medical history; and
- sun exposure.

When a diagnosis request omits a demographic value, the backend can fall back to the corresponding patient profile value.

Demographic risk contributes to **clinical concern reasoning** and does not replace the image classifier's class prediction.

---

## Clinical Recommendation Layer

Recommendations are generated after the decision and uncertainty stages.

The recommendation payload used by the API/report includes:

```text
class_description
recommendations[]
urgency_level
follow_up_days
```

The recommendation engine uses the image decision, uncertainty output, and symptom analysis.

The report generator also includes a fixed screening disclaimer stating that DERMAXAI is an AI screening tool and does not constitute a medical diagnosis.

---

## PDF Report Generation

Reports are generated using ReportLab.

A generated report can contain:

- DERMAXAI report header;
- generation timestamp;
- patient information;
- diagnosis result;
- predicted class and class code;
- diagnostic confidence;
- malignant probability mass;
- clinical-concern probability mass;
- normalized predictive entropy;
- composite uncertainty and confidence label;
- clinical classification;
- review status;
- urgency level;
- modality contribution table;
- complete class-probability distribution;
- Grad-CAM visualization when available;
- class description;
- recommendation list; and
- suggested follow-up window.

### Report presentation categories

The PDF uses three explicit presentation categories:

```text
MALIGNANT
CLINICAL CONCERN
NON-MALIGNANT
```

The distinction is intentional and mirrors the backend decision contract.

---

## User Roles and Application Workflows

DERMAXAI currently has three application roles:

```text
patient
    │
    ├── dashboard
    ├── diagnose
    ├── history
    ├── lesions
    └── profile

 doctor
    │
    ├── dashboard access
    └── doctor review queue

 admin
    │
    └── admin workspace
```

### Patient

Patients can:

- register and log in;
- maintain their profile;
- submit diagnostic cases;
- inspect history;
- view clinical-concern/review state;
- access Grad-CAM explanations;
- download authenticated reports;
- create and edit tracked lesions;
- attach unassigned diagnoses to lesions; and
- view completed doctor-review notifications.

### Doctor

Doctors can:

- access the doctor queue;
- inspect diagnosis data;
- claim cases;
- view Grad-CAM and reports when available; and
- submit supported review verdicts.

### Admin

Administrators can:

- list users;
- inspect aggregate system statistics;
- inspect aggregate performance/workflow metrics;
- promote eligible users to doctor; and
- deactivate/reactivate users.

Public registration cannot directly create a doctor account.

---

## Frontend

The frontend is a React 18 application built with Vite and styled with TailwindCSS.

### Frontend technologies

- React 18
- React Router 6
- Vite 5
- TailwindCSS 3
- Axios
- Recharts
- React Dropzone
- React Hot Toast
- Framer Motion
- React Hook Form
- Lucide React
- React Spinners
- ESLint

### Frontend route map

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page |
| `/login` | Public | Login |
| `/register` | Public | Patient registration |
| `/forgot-password` | Public | Request password reset |
| `/reset-password` | Public | Complete password reset |
| `/dashboard` | Patient / Doctor | Authenticated dashboard |
| `/diagnose` | Patient | Run multimodal diagnosis |
| `/history` | Patient | Diagnosis history |
| `/lesions` | Patient | Lesion tracking |
| `/profile` | Patient | Patient profile |
| `/doctor` | Doctor | Doctor review workspace |
| `/admin` | Admin | Administration workspace |

### Frontend API integration

The Axios client defaults to:

```text
VITE_API_URL || /api
```

The Docker production-style frontend therefore talks to the backend through the Nginx `/api` reverse proxy.

Authenticated requests automatically include:

```http
Authorization: Bearer <token>
```

Authenticated PDF and Grad-CAM retrieval uses blob requests so the browser can access protected binary resources without exposing them as public static files.

---

## Backend API

The backend is a FastAPI application started from `backend/app.py`.

### Core endpoints

#### Health and root

```http
GET /
GET /api/health
```

`/api/health` reports runtime status, configured model name, dataset label, device, model-loaded state, and the major AI pipeline components.

#### Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
```

Rate limits currently configured by the backend:

| Endpoint | Limit |
|---|---|
| Register | 5 requests/minute |
| Login | 10 requests/minute |
| Forgot password | 3 requests/minute |
| Reset password | 5 requests/minute |

#### Diagnosis

```http
POST /api/diagnose
GET  /api/diagnose/history
GET  /api/diagnose/summary
GET  /api/diagnose/unassigned
GET  /api/diagnose/notifications
POST /api/diagnose/notifications/mark-seen
GET  /api/diagnose/{diagnosis_id}/gradcam
```

#### Reports

```http
GET /api/reports/{diagnosis_id}
```

#### Patient profile

```http
GET /api/patients/profile
PUT /api/patients/profile
PATCH /api/patients/profile
```

The additive feature router provides the PATCH form and preserves explicit `null` values when the client intentionally clears a field.

#### Lesion tracking

```http
POST   /api/lesions
GET    /api/lesions
GET    /api/lesions/{lesion_id}
PATCH  /api/lesions/{lesion_id}
DELETE /api/lesions/{lesion_id}
POST   /api/lesions/{lesion_id}/diagnoses/{diagnosis_id}
```

#### Doctor workflow

```http
GET  /api/doctor/queue
POST /api/doctor/diagnoses/{diagnosis_id}/claim
POST /api/doctor/diagnoses/{diagnosis_id}/review
```

#### Admin workflow

```http
GET  /api/admin/users
POST /api/admin/users/{user_id}/promote-doctor
POST /api/admin/users/{user_id}/deactivate
POST /api/admin/users/{user_id}/reactivate
GET  /api/admin/stats
GET  /api/admin/performance
```

### Diagnosis request fields

`POST /api/diagnose` accepts multipart form data.

| Field | Type | Required | Description |
|---|---|---:|---|
| `image` | file | Yes | JPG/JPEG/PNG/BMP image |
| `symptoms` | string | No | Free-text symptom description |
| `age` | integer | No | Diagnosis-specific age override |
| `gender` | string | No | Diagnosis-specific gender override |
| `skin_type` | string | No | Diagnosis-specific skin-type override |
| `sun_exposure` | string | No | Diagnosis-specific sun-exposure value |

### Diagnosis response structure

The successful diagnosis response can contain:

```json
{
  "diagnosis_id": 123,
  "decision": {
    "predicted_class": "mel",
    "class_name": "Melanoma",
    "fused_confidence": 0.91,
    "image_confidence": 0.91,
    "malignancy_mass": 0.94,
    "clinical_concern_mass": 0.97,
    "cmca_clinical_concern_score": 0.80,
    "is_malignant": true,
    "clinical_concern": true,
    "requires_review": true,
    "urgency_escalated": true,
    "modality_weights": {
      "image": 0.55,
      "symptoms": 0.25,
      "demographics": 0.20
    }
  },
  "uncertainty": {
    "aleatory_uncertainty": 0.12,
    "epistemic_uncertainty": 0.08,
    "fusion_uncertainty": 0.05,
    "composite_uncertainty": 0.10,
    "normalized_entropy": 0.14,
    "requires_review": false
  },
  "symptom_analysis": {},
  "demographic_risk": {},
  "recommendation": {},
  "image_quality": {},
  "abcd_features": {},
  "gradcam_url": "/api/diagnose/123/gradcam",
  "report_url": "/api/reports/123"
}
```

The numeric values above are **illustrative structure only**, not reference results. Runtime values depend on the submitted case and loaded model checkpoint.

---

## Database Design

The runtime database is SQLite.

### `users`

Stores authentication and account state.

Important fields include:

- `id`
- `email`
- `name`
- `hashed_password`
- `role`
- `created_at`
- `is_active`
- `token_version`
- `password_reset_nonce_hash`

Emails are normalized to lowercase/trimmed form through the custom SQLAlchemy `NormalizedEmail` type and application validators.

### `patients`

One patient profile is linked to one user through `user_id`.

Stored fields include:

- age;
- gender;
- skin type;
- medical history;
- sun exposure; and
- creation timestamp.

The `user_id` invariant is enforced uniquely.

### `diagnoses`

Stores each diagnostic run.

Important fields include:

- owner/user ID;
- patient ID;
- optional lesion ID;
- source image path;
- symptoms;
- predicted class;
- fused/image confidence;
- malignancy flag;
- review and urgency flags;
- uncertainty components;
- symptom and demographic risk scores;
- Grad-CAM path;
- PDF report path;
- class probability JSON;
- modality-weight JSON;
- ABCD feature JSON; and
- creation timestamp.

### `lesions`

Stores patient-owned tracked lesions:

- name;
- body site;
- notes;
- timestamps; and
- owning user.

### `doctor_reviews`

Stores the review workflow state:

- diagnosis ID;
- doctor ID;
- status;
- verdict;
- notes;
- claimed timestamp;
- reviewed timestamp; and
- whether the patient has viewed the completed review.

The diagnosis ID is unique in this table.

---

## Database Migrations

Alembic is the schema authority for the production/Docker startup path.

Current migration chain:

```text
0001_initial_schema
        │
        ▼
0002_lesion_tracking
        │
        ▼
0003_token_version
```

### Migration 0001

Creates the initial:

- users;
- patients;
- diagnoses; and
- doctor_reviews tables.

### Migration 0002

Adds lesion tracking:

- `lesions` table;
- `diagnoses.lesion_id`;
- lesion indexes; and
- the diagnosis-to-lesion foreign key.

### Migration 0003

Adds:

- `users.token_version`; and
- SQLite triggers that increment the token version when a password change or user deactivation revokes previously issued JWT access tokens.

### Docker migration behavior

The backend container entrypoint runs:

```bash
python -m alembic upgrade head
```

before Uvicorn starts.

This means the container attempts to bring the persistent SQLite database to the latest repository migration automatically.

### Existing local database that predates migration tracking

If a manually created local database already contains tables but has an empty Alembic revision, do not blindly run `alembic upgrade head` first.

First inspect the schema and determine the last migration it actually matches. For example, a database containing `lesions` and `diagnoses.lesion_id` but lacking `users.token_version` corresponds to the `0002` schema and can be stamped to `0002_lesion_tracking` before upgrading to head.

Example recovery flow:

```powershell
# from backend/
Copy-Item .\dermaxai.db .\dermaxai_backup_before_migration.db
alembic stamp 0002_lesion_tracking
alembic upgrade head
alembic current
```

Only use a stamp value that matches the actual existing schema. Stamping is metadata; it does not perform the missing schema changes.

---

## Project Structure

```text
DERMAXAI/
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── backend/
│   ├── app.py                         # FastAPI application + auth + diagnosis workflow
│   ├── entrypoint.sh                  # Alembic upgrade + Uvicorn startup
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 0001_initial_schema.py
│   │       ├── 0002_lesion_tracking.py
│   │       └── 0003_token_version.py
│   │
│   ├── ai/
│   │   ├── predictor.py               # TTA inference + MC-dropout samples
│   │   ├── model.py / core/model.py    # Runtime model architecture
│   │   ├── uncertainty.py              # MCUE
│   │   ├── gradcam.py                  # Grad-CAM generation
│   │   ├── biobert_engine.py           # Symptom analysis
│   │   ├── risk_engine.py              # Demographic risk
│   │   ├── decision_engine.py          # CMCA + concern/review logic
│   │   ├── recommendation_engine.py    # Recommendations
│   │   └── abcd_engine.py              # ABCD feature extraction
│   │
│   ├── core/
│   │   ├── config.py                  # Centralized settings
│   │   ├── database.py                # SQLAlchemy models + DB bootstrap
│   │   ├── model.py                   # EfficientNet-B3 + CBAM + GeM + MLP
│   │   ├── preprocessing.py           # Image loading + TTA transforms
│   │   └── auth.py                    # JWT + password/reset-token logic
│   │
│   ├── features/
│   │   └── routes.py                  # Lesion + analytics routes
│   │
│   ├── reports/
│   │   └── report_generator.py        # ReportLab PDF generation
│   │
│   ├── utils/
│   │   ├── email.py
│   │   ├── logger.py
│   │   └── validators.py
│   │
│   ├── knowledge/                     # Per-class clinical knowledge JSON files
│   ├── models/                        # Trained best.pth checkpoint
│   ├── uploads/                       # Runtime image uploads
│   ├── heatmaps/                      # Runtime Grad-CAM images
│   ├── generated_reports/             # Runtime PDF reports
│   └── tests/
│       ├── ...                        # Backend regression tests
│       └── smoke_test.py              # End-to-end auth/diagnose/review smoke test
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf.template
│   ├── package.json
│   ├── package-lock.json
│   ├── src/
│   │   ├── App.jsx                    # Routes + auth context
│   │   ├── lib/api.js                 # Axios API client
│   │   └── pages/
│   │       ├── Landing.jsx
│   │       ├── Login.jsx
│   │       ├── Register.jsx
│   │       ├── ForgotPassword.jsx
│   │       ├── ResetPassword.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Diagnose.jsx
│   │       ├── History.jsx
│   │       ├── Lesions.jsx
│   │       ├── Profile.jsx
│   │       ├── Doctor.jsx
│   │       └── Admin.jsx
│   └── tests/
│       └── ui_contract.test.mjs       # Frontend API/UI contract checks
│
├── docker-compose.yml
├── .env.example
└── README.md
```

> Note: the repository contains both `backend/core/model.py` and model-related import paths used by the backend. Use the actual import locations in code when navigating the implementation rather than relying only on the abbreviated tree above.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Image model | EfficientNet-B3 / timm | Dermoscopic image classification |
| Attention | CBAM | Channel + spatial feature refinement |
| Pooling | GeM | Learnable generalized mean pooling |
| Classification head | LayerNorm + Linear + GELU + Dropout MLP | 7-class classification |
| Training loss | ACWF-FL | Imbalance-aware focal-loss methodology |
| Optimizer | SAM + AdamW | Training optimization methodology |
| Weight averaging | SWA | Final training stabilization methodology |
| Inference augmentation | TTA | Multi-view prediction averaging |
| Uncertainty | MC-dropout + entropy + MI + JS divergence | MCUE |
| XAI | Grad-CAM | Visual model explanation |
| NLP | Rule-based engine + optional Transformers/BioBERT | Symptom analysis |
| Risk | Custom demographic risk engine | Additional concern signal |
| Multimodal reasoning | CMCA | Clinical-concern aggregation |
| Backend | FastAPI + Uvicorn | REST API and application server |
| ORM | SQLAlchemy | Database access |
| Database | SQLite | Local/persistent application storage |
| Migrations | Alembic | Schema versioning |
| Authentication | JWT + bcrypt | Session/authentication security |
| Rate limiting | SlowAPI | Auth endpoint rate limiting |
| Reports | ReportLab | PDF report generation |
| Frontend | React + Vite | Web client |
| Styling | TailwindCSS | Frontend UI styling |
| Reverse proxy | Nginx | Static frontend + `/api` proxy |
| Packaging | Docker Compose | Reproducible local stack |
| CI | GitHub Actions | Backend/frontend/Docker validation |

---

## Model Checkpoint

The runtime expects a trained checkpoint at:

```text
backend/models/best.pth
```

When running with Docker Compose, this directory is mounted read-only into the backend container as:

```text
/data/models
```

with the default runtime path:

```text
/data/models/best.pth
```

### Important checkpoint rules

The checkpoint must match:

```text
Model: EfficientNet-B3
Classes: 7
Class order:
  akiec
  bcc
  bkl
  df
  mel
  nv
  vasc
```

A checkpoint that cannot be fully loaded is rejected rather than being served with missing parameters.

For actual diagnosis runs, use the trained checkpoint. `ALLOW_RANDOM_WEIGHTS=true` exists only for development/CI scenarios in which deterministic model behavior is not being evaluated.

---

## Configuration

Copy the environment template:

```bash
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

### Core environment variables

| Variable | Default / Example | Purpose |
|---|---|---|
| `SECRET_KEY` | required outside debug | JWT signing secret |
| `DEBUG` | `false` | Enables debug-oriented API docs/routes |
| `ALLOW_RANDOM_WEIGHTS` | `false` | Development/CI-only random-weight fallback |
| `MODEL_PATH` | `/data/models/best.pth` in Docker | Model checkpoint path |
| `DATABASE_URL` | `sqlite:////data/dermaxai.db` in Docker | SQLite database location |
| `UPLOADS_DIR` | `/data/uploads` | Uploaded image storage |
| `HEATMAPS_DIR` | `/data/heatmaps` | Grad-CAM storage |
| `REPORTS_DIR` | `/data/generated_reports` | PDF storage |
| `CORS_ORIGINS` | localhost frontend/API origins | Allowed web origins |
| `FRONTEND_URL` | `http://localhost:5173` | Password reset link origin |
| `PASSWORD_RESET_TOKEN_MINUTES` | `30` | Reset token lifetime |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | empty | SMTP username |
| `SMTP_PASSWORD` | empty | SMTP password/app password |
| `SMTP_FROM` | same as SMTP user | Sender address |
| `SMTP_STARTTLS` | `true` | SMTP STARTTLS setting |
| `TTA_VIEWS` | `8` | Number of inference views, range 1–8 |
| `MC_DROPOUT_PASSES` | `20` | Stochastic uncertainty passes, range 1–64 |

### Secret handling

Do not commit `.env` or real credentials. Use `.env.example` as the public configuration template.

For Gmail SMTP, use an App Password rather than a normal account password when the account configuration requires it.

### API documentation in debug mode

When `DEBUG=true`, FastAPI exposes:

```text
http://localhost:8000/docs
http://localhost:8000/redoc
http://localhost:8000/openapi.json
```

In non-debug mode these API documentation endpoints are disabled by application configuration.

---

## Quick Start with Docker

### Prerequisites

Install:

- Git
- Docker Desktop with Docker Compose support

### 1. Clone the repository

```bash
git clone https://github.com/tejaswaroop41/DERMAXAI.git
cd DERMAXAI
```

### 2. Place the trained checkpoint

Copy the trained checkpoint to:

```text
backend/models/best.pth
```

### 3. Create `.env`

```bash
cp .env.example .env
```

Replace the example secret with a long random value.

### 4. Build and start

```bash
docker compose up --build
```

### 5. Open the application

Frontend:

```text
http://localhost:5173
```

Backend health:

```text
http://localhost:8000/api/health
```

FastAPI docs when `DEBUG=true`:

```text
http://localhost:8000/docs
```

### 6. Stop the stack

```bash
docker compose down
```

To stop and also remove the Compose-managed persistent volume:

```bash
docker compose down -v
```

Use the `-v` form carefully because it removes the Docker volume that stores the SQLite database and generated runtime data.

---

## Local Backend Development

The backend can also be started directly for development/testing.

### 1. Create and activate the virtual environment

Windows PowerShell example:

```powershell
cd D:\DERMAXAI\DERMAXAI\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
python -m pip install -r requirements.txt
```

### 3. Configure local `.env`

The backend loads:

```text
backend/.env
```

A local development database can use a path such as:

```text
DATABASE_URL=sqlite:///D:/DERMAXAI/DERMAXAI/backend/dermaxai.db
```

Use a path appropriate for the current machine.

### 4. Run migrations

For a fresh database:

```powershell
alembic upgrade head
```

### 5. Start the backend

```powershell
uvicorn app:app --reload --port 8000
```

### 6. Verify health

```text
http://127.0.0.1:8000/api/health
```

### Model loading behavior

At application startup the lifespan handler:

1. initializes the development/test schema path when appropriate;
2. loads the trained predictor model;
3. constructs the uncertainty engine; and
4. constructs the Grad-CAM engine.

A successful startup log contains a model-loaded message followed by the predictor device.

---

## Local Frontend Development

The frontend can be run independently when working on UI code.

### Install dependencies

```bash
cd frontend
npm ci
```

### Development server

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Preview build

```bash
npm run preview
```

For local frontend development, `VITE_API_URL` can be used to control the Axios base URL. Without an explicit value, the frontend uses `/api`.

---

## Docker Architecture

The Compose file defines two services.

### Backend container

The backend service:

- builds from `backend/Dockerfile`;
- runs Python 3.11;
- exposes port `8000`;
- mounts `backend/models` read-only into `/data/models`;
- persists runtime data in the `backend_data` volume;
- runs an HTTP healthcheck against `/api/health`; and
- executes Alembic migrations before Uvicorn through `entrypoint.sh`.

Persistent data includes:

```text
/data/dermaxai.db
/data/uploads
/data/heatmaps
/data/generated_reports
```

### Frontend container

The frontend service:

- builds the Vite application;
- serves the static output from Nginx;
- listens on container port `80`;
- is published on host port `5173`; and
- proxies `/api/*` to the backend service.

The Compose dependency waits for the backend healthcheck before starting the frontend service.

### Network flow

```text
Browser
  │
  │ http://localhost:5173
  ▼
Nginx frontend container
  │
  │ /api/*
  ▼
FastAPI backend container
  │
  ├── SQLite volume
  ├── model checkpoint mount
  ├── uploads volume
  ├── heatmaps volume
  └── report volume
```

---

## Authentication and Security

### Password hashing

Passwords are hashed using bcrypt through the backend authentication layer.

### JWT access tokens

The backend issues JWT access tokens containing the user identity and role. A per-user `token_version` is also enforced by the authentication layer so that security-sensitive account changes can invalidate older tokens.

### Token-version invalidation

The database migration creates triggers for:

- password changes; and
- account deactivation.

These changes increment `token_version`, allowing the server to reject previously issued tokens after the account state changes.

### Password reset flow

The password reset design uses a per-request random nonce:

```text
reset request
    │
    ▼
random nonce
    │
    ├── hash stored in users.password_reset_nonce_hash
    └── nonce embedded in reset JWT
            │
            ▼
        email sent
```

The nonce is committed to the database before the reset email is delivered. If delivery fails, cleanup is scoped so that an older failed request does not accidentally erase a newer reset nonce created concurrently.

The forgot-password endpoint intentionally returns a generic response regardless of whether the requested email is registered.

### Rate limiting

SlowAPI is wired into the FastAPI application and currently rate-limits authentication operations, including login and password-reset endpoints.

### Access control

The backend verifies resource ownership before serving protected diagnosis assets such as:

- Grad-CAM images; and
- PDF reports.

Patients can access their own diagnosis data. Doctors use dedicated protected endpoints for review operations. Admin endpoints require administrator authorization.

### File validation

The diagnosis upload path validates both the submitted extension and the actual image encoding before inference.

---

## Testing and CI

The repository includes backend, frontend, and Docker validation in GitHub Actions.

### CI pipeline

The workflow is triggered on:

```text
push to main
pull request to main
```

### Backend checks

The CI backend job performs:

1. dependency installation;
2. Python 3.11 setup;
3. syntax compilation of backend Python files;
4. backend regression tests;
5. auth → diagnose → doctor-review smoke testing.

The backend CI environment uses SQLite and a CI secret. The smoke test enables random weights so the workflow does not depend on a large trained checkpoint being available in the CI runner.

### Frontend checks

The frontend job performs:

```bash
npm ci
node --test tests/ui_contract.test.mjs
npm run build
npm run lint -- --max-warnings=0
```

### Docker integration checks

The Docker job:

1. builds both images;
2. starts the Compose stack;
3. waits for backend health;
4. checks the frontend `/healthz` endpoint;
5. checks the frontend → backend `/api/health` proxy; and
6. tears the stack down.

### Local backend tests

From `backend/`:

```powershell
python -m pytest -q tests
```

### Local smoke test

From `backend/`:

```powershell
$env:ALLOW_RANDOM_WEIGHTS="true"
python tests/smoke_test.py
```

Use random weights only for smoke/infrastructure validation. It is not a meaningful model-quality test.

### Local frontend contract tests

From `frontend/`:

```bash
node --test tests/ui_contract.test.mjs
```

---

## Troubleshooting

### `sqlite3.OperationalError: no such column: users.token_version`

This normally means the code has moved ahead of the local SQLite schema.

Check the migration state:

```powershell
alembic current
```

If the command prints no revision and the database already contains application tables, inspect the schema before running migrations. A database that already contains `lesions` and `diagnoses.lesion_id` but lacks `users.token_version` is structurally aligned with the `0002` migration and can be stamped to that revision before upgrading to head.

Do not delete the database automatically when it contains data you need.

### `table users already exists` during `alembic upgrade head`

This happens when Alembic believes the database is fresh (`revision` is empty) while the tables were already created by an older/manual bootstrap path.

The safe recovery is:

```text
1. Back up the SQLite file.
2. Inspect the existing tables/columns.
3. Identify the last migration actually represented by the database.
4. Stamp only that migration.
5. Run `alembic upgrade head`.
```

### Model checkpoint not found

If startup fails with a missing-checkpoint message, verify:

```text
backend/models/best.pth
```

exists for local development, or that the Docker volume mount and `MODEL_PATH` point to the correct location.

For CI-only startup without real weights:

```text
ALLOW_RANDOM_WEIGHTS=true
```

### Port 8000 already in use

Start Uvicorn on another port, for example:

```powershell
uvicorn app:app --reload --port 8001
```

If the frontend is configured to use a direct backend URL, update that configuration accordingly. In the Docker setup, the documented backend port is `8000`.

### Frontend cannot reach the API

For Docker, verify:

```text
http://localhost:5173/healthz
http://localhost:5173/api/health
```

Then inspect:

```bash
docker compose ps
docker compose logs backend
docker compose logs frontend
```

### Login returns HTTP 401

Check that:

- the user exists;
- the email is correctly normalized;
- the password is correct; and
- the account is active.

If login returns HTTP 500 with a database-column error, fix the schema/migration state first; it is not a normal invalid-credentials response.

### Password reset email is not delivered

Verify:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
SMTP_STARTTLS
```

For Gmail, use an App Password where required.

The forgot-password endpoint intentionally returns the same generic message even when delivery fails or the account does not exist.

### Grad-CAM or report returns 404

The diagnosis must have a stored generated asset and the authenticated caller must be allowed to view the diagnosis. A report/Grad-CAM request can also return 404 when the generated artifact does not exist on disk.

### Two doctors try to claim the same case

The application uses a unique review record per diagnosis and translates the database integrity race into:

```http
409 Conflict
Diagnosis already claimed by another doctor
```

### Two users try to attach the same diagnosis to different lesions

Diagnosis attachment uses a conditional database update that only claims rows whose `lesion_id` is still `NULL`. The first successful claimant wins; subsequent conflicting requests receive a conflict response.

---

## Expected Development Workflow

For repository work, the recommended workflow is:

```text
main
  │
  ├── feature branch / fix branch / docs branch
  │
  ▼
Make focused changes
  │
  ▼
Run local tests
  │
  ▼
Open Pull Request
  │
  ▼
GitHub Actions CI
  │
  ▼
Review / merge
  │
  ▼
Pull updated main locally
  │
  ▼
Run integration testing again
```

Keep bug fixes, documentation updates, and larger architectural changes in separate focused commits/PRs where practical.

---

## Limitations and Scope

DERMAXAI should be understood within the following boundaries:

### 1. Screening prototype

The application is intended for preliminary screening and clinical-review support. It does not provide a definitive medical diagnosis.

### 2. Model prediction scope

The image classifier produces one of the configured seven HAM10000 classes. Real-world images that fall outside the training distribution can behave differently from benchmark data.

### 3. Dataset dependence

The current application is aligned to the ISIC 2018 / HAM10000 seven-class taxonomy used by the project.

### 4. Uncertainty is not a guarantee

MCUE provides numerical uncertainty estimates based on the implemented stochastic and deterministic distributions. A low uncertainty value is not a guarantee of correctness, and a high uncertainty value is not itself a diagnosis.

### 5. CMCA is not calibrated malignancy probability

The CMCA score is explicitly a clinical-concern score. It should not be presented as a percentage probability of cancer or malignancy.

### 6. Grad-CAM is an explanation aid

Grad-CAM highlights influential regions for the model prediction but is not a validated clinical segmentation or localization system.

### 7. Clinical recommendations require human review

Recommendation text and follow-up windows are generated programmatically and must be interpreted by qualified clinical professionals.

### 8. SQLite is the current application database

The current repository is structured around SQLite and Docker persistent volumes. No cloud database configuration is required by the documented setup.

### 9. Production deployment hardening

The repository is primarily organized for local Docker demonstration, development, testing, and academic evaluation. Additional infrastructure would be required for a production healthcare deployment, including operational monitoring, data-governance controls, backups, secret management, and environment-specific security validation.

---

## Research and Academic Context

DERMAXAI is built around the project's multimodal and uncertainty-aware dermatology research direction.

The core research ideas represented in the implementation are:

- EfficientNet-B3 backbone;
- CBAM channel/spatial attention;
- GeM pooling;
- LayerNorm/GELU/Dropout MLP head;
- adaptive class-weighted focal loss methodology;
- SAM training methodology;
- SWA training methodology;
- test-time augmentation;
- Monte Carlo uncertainty estimation;
- multimodal clinical-concern aggregation;
- Grad-CAM explanation;
- symptom-aware reasoning;
- demographic risk reasoning; and
- longitudinal lesion tracking.

The repository separates **training-time techniques** from **runtime inference and workflow components**. The deployed FastAPI service is responsible for inference, uncertainty estimation, multimodal decision support, persistence, reporting, and user workflows; training-specific loss/optimizer techniques are represented in the trained checkpoint methodology rather than recomputed during inference.

For academic writing, benchmark metrics should be taken from the project's validated experimental records/notebooks rather than inferred from live application statistics. The admin performance endpoint itself does not claim model accuracy because its database does not store ground-truth labels.

---

## Project Status

The repository currently contains:

- a FastAPI multimodal inference backend;
- React/Vite frontend;
- JWT authentication;
- password reset flow;
- SQLite persistence;
- Alembic migrations;
- lesion tracking;
- doctor review workflow;
- Grad-CAM explanations;
- MCUE uncertainty estimates;
- CMCA concern aggregation;
- PDF report generation;
- Docker Compose deployment for local use; and
- GitHub Actions CI covering backend, frontend, and Docker integration.

The project is under active development and should be treated as an academic/research prototype rather than a certified clinical device.

---

## License / Project Status

This repository is a student/final-year academic project by the project team at Dr. Ambedkar Institute of Technology.

Refer to the repository for the current source code, issue history, pull requests, model artifacts, and project documentation.
