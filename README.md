# DERMAXAI v6
### Multimodal AI-Powered Healthcare Diagnostic Assistant

> Final Year BE Project — Dr. AIT, Bengaluru | Course: 22CSP605 | 2025–26  
> Guide: Dr. Suresha D, Assoc. Prof., CSE Programme

DERMAXAI is a multimodal dermatology screening and clinical-review support system. This README focuses on one question: **which algorithm or method is used at which step of the DERMAXAI pipeline?**

---

## 1. Algorithm-to-Pipeline Mapping

| Step | Algorithm / Method | Implementation | Purpose |
|---|---|---|---|
| 1 | Image/file validation | `backend/ai/predictor.py` | Verify supported extension and actual image encoding |
| 2 | Laplacian variance + brightness + resolution checks | `backend/core/preprocessing.py` | Flag blurry, badly exposed, or very small input |
| 3 | Resize + ImageNet normalization | `backend/core/preprocessing.py` | Prepare the 300×300 model input |
| 4 | **TTA** — 8 deterministic full-image views | `backend/core/preprocessing.py` | Generate multiple inference views |
| 5 | **EfficientNet-B3** | `backend/core/model.py` | Extract deep spatial image features |
| 6 | **CBAM** | `backend/core/model.py` | Refine features with channel + spatial attention |
| 7 | **GeM** pooling | `backend/core/model.py` | Convert spatial feature maps into a feature vector |
| 8 | LayerNorm + Linear + GELU + Dropout MLP | `backend/core/model.py` | Produce 7-class logits |
| 9 | Mel-only logit adjustment | `backend/ai/predictor.py` | Apply the configured targeted adjustment before softmax |
| 10 | Softmax + TTA probability averaging | `backend/ai/predictor.py` | Produce class probabilities, predicted class, and image confidence |
| 11 | **MC Dropout** | `backend/ai/predictor.py` | Generate stochastic prediction samples |
| 12 | **MCUE** | `backend/ai/uncertainty.py` | Estimate aleatory, epistemic, fusion, and composite uncertainty |
| 13 | Rule-based clinical NLP + negation handling; optional BioBERT | `backend/ai/biobert_engine.py` | Convert symptom text into risk, duration, and urgency information |
| 14 | Demographic risk rules | `backend/ai/risk_engine.py` | Compute risk from age, skin type, history, and sun exposure |
| 15 | **CMCA** | `backend/ai/decision_engine.py` | Combine image concern, symptom risk, and demographic risk |
| 16 | **Grad-CAM** | `backend/ai/gradcam.py` | Explain which image regions influenced the selected class |
| 17 | Otsu segmentation + ABCD feature extraction | `backend/ai/abcd_engine.py` | Generate asymmetry, border, color, and diameter context |
| 18 | Knowledge-base recommendation rules | `backend/ai/recommendation_engine.py` | Generate recommendation, urgency, and follow-up guidance |
| 19 | SQLAlchemy + SQLite | `backend/core/database.py` | Persist the diagnosis and derived outputs |
| 20 | ReportLab | `backend/reports/report_generator.py` | Generate the PDF clinical report |
| 21 | Atomic conditional database update | `backend/features/routes.py` | Attach a diagnosis safely to a tracked lesion |
| 22 | Doctor review workflow | `backend/app.py`, `backend/features/routes.py` | Queue, claim, and review cases |

---

## 2. Complete Runtime Pipeline

```text
Dermoscopic Image + Symptoms + Patient Profile
                    │
                    ▼
              [1] Validation
                    │
                    ▼
              [2] Quality Check
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
        │ [9] Mel logit adjustment  │
        │          ↓                │
        │ [10] Softmax + TTA mean   │
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
              [19] Diagnosis DB
                │            │
                ▼            ▼
          [20] PDF      [21] Lesion tracking
                               │
                               ▼
                         [22] Doctor review
```

---

## 3. Training-Time Algorithms

These methods are used while producing the trained checkpoint. They are **not rerun during a normal `/api/diagnose` request**.

| Method | Training Stage | Role |
|---|---|---|
| **ACWF-FL** | Loss function | Effective-number class weighting + focal loss; `β=0.9999`, `γ=2.0`, with `1.5×` malignant-class loss amplification |
| **SAM** | Training Phase 2 | Sharpness-Aware Minimization |
| **SWA** | Training Phase 3 | Stochastic Weight Averaging |

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

### Training vs runtime

```text
ACWF-FL / SAM / SWA       → training time
TTA / MC Dropout / MCUE   → inference time
NLP / Demographic Risk    → clinical-input processing
CMCA                      → multimodal decision stage
Grad-CAM / ABCD            → explainability/context
```

---

## 4. Steps 1–4: Input Processing and TTA

### Step 1 — Image validation

The predictor validates both the submitted extension and the actual encoded image content.

Supported formats:

```text
.jpg   .jpeg   .png   .bmp
```

### Step 2 — Image quality checks

The preprocessing module uses:

- **Laplacian variance** for blur detection (`< 100` is flagged)
- grayscale mean brightness (`< 40` too dark, `> 220` too bright)
- minimum image dimension (`< 100 px` is flagged)

These checks generate warnings and do not alter the classifier output.

### Step 3 — Preprocessing

```text
Resize → 300 × 300
Normalize → ImageNet mean/std
```

```text
Mean = [0.485, 0.456, 0.406]
Std  = [0.229, 0.224, 0.225]
```

### Step 4 — TTA

The default runtime uses eight full-image deterministic views:

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

Each view is passed through the classifier and the resulting probability vectors are averaged.

---

## 5. Steps 5–8: Image Classification

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

The CNN backbone extracts spatial feature maps from the dermoscopic image.

### Step 6 — CBAM

CBAM sequentially applies:

```text
Feature Maps → Channel Attention → Spatial Attention → Refined Features
```

### Step 7 — GeM

Generalized Mean Pooling converts the refined feature maps into a vector:

```text
GeM(x) = ( mean(clamp(x, eps)^p) )^(1/p)
```

The pooling parameter `p` is learnable.

### Step 8 — MLP head

The pooled vector is transformed by LayerNorm, Linear, GELU and Dropout blocks before the final seven-class layer.

Classes:

```text
akiec · bcc · bkl · df · mel · nv · vasc
```

---

## 6. Steps 9–10: Logit Adjustment and Primary Prediction

### Step 9 — Mel-only logit adjustment

Before softmax, the predictor can apply a targeted adjustment to the `mel` logit.

```text
LOGIT_ADJUSTMENT_ENABLED = true
LOGIT_ADJUSTMENT_CLASS   = mel
LOGIT_ADJUSTMENT_TAU     = 0.3
MEL_LOG_PRIOR            = -2.1970
```

Only the `mel` logit is modified.

### Step 10 — Softmax + TTA averaging

For each TTA view:

```text
Model logits → Mel adjustment → Softmax → class probabilities
```

The TTA probability vectors are averaged. The highest-probability class becomes `predicted_class`; its probability is the image confidence.

---

## 7. Steps 11–12: MC Dropout and MCUE

### Step 11 — MC Dropout

The predictor performs repeated stochastic forward passes with only explicit Dropout layers enabled. Other modules remain in evaluation mode.

```text
MC_DROPOUT_PASSES = 20
```

### Step 12 — MCUE

MCUE combines the deterministic TTA distribution with the stochastic MC distribution.

```text
Aleatory
= expected normalized entropy

Epistemic
= entropy(MC mean) - mean(MC entropy)

Fusion
= normalized Jensen-Shannon divergence(TTA, MC mean)
```

Composite uncertainty:

```text
Composite
= 0.4 × Aleatory
+ 0.4 × Epistemic
+ 0.2 × Fusion
```

The uncertainty-review threshold uses `mcue_threshold` from the checkpoint when available; otherwise the configured fallback is `0.8054`.

---

## 8. Step 13: Symptom NLP

The current live implementation is **rule-based clinical NLP**. An optional BioBERT transformer path exists in the module, but transformer mode is disabled in the current singleton configuration.

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

---

## 9. Step 14: Demographic Risk

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

The score is capped at `1.0` and returned with a breakdown of contributing factors. The current implementation accepts gender but does not apply a separate gender weight.

---

## 10. Step 15: CMCA Multimodal Fusion

**CMCA = Cross-Modal Confidence Aggregation.** It is applied after the independent image, symptom, and demographic signals exist.

Image-derived masses:

```text
Malignancy Mass
= P(bcc) + P(mel)

Clinical-Concern Mass
= P(akiec) + P(bcc) + P(mel)
```

CMCA inputs:

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

Current escalation values:

```text
CMCA concern threshold      = 0.30
Malignancy-mass escalation  = 0.30
Malignant review floor      = 0.70
```

CMCA creates a clinical-concern/review signal. It does **not** overwrite the image-model `predicted_class`.

---

## 11. Malignant vs Clinical Concern

```python
MALIGNANT_CLASSES = ['bcc', 'mel']
CLINICAL_CONCERN_CLASSES = ['akiec', 'bcc', 'mel']
```

| Class | Malignant signal | Clinical-concern signal |
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

Malignant
    = predicted class is bcc or mel

Clinical concern
    = concern class OR multimodal/review escalation
```

---

## 12. Steps 16–17: Explainability

### Step 16 — Grad-CAM

```text
Selected class
      ↓
Forward activations
      ↓
Backward gradients
      ↓
Gradient-based channel weights
      ↓
Weighted activation map
      ↓
ReLU + normalization
      ↓
Heatmap overlay
```

Grad-CAM uses the final spatial backbone block to visualize regions that influenced the selected class score.

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
├── Asymmetry
├── Border irregularity
├── Color variation
└── Diameter (pixels)
```

ABCD features are **context/explainability outputs only**. They are not classifier inputs.

---

## 13. Step 18: Recommendation Engine

```text
Predicted class
   +
Malignancy status
   +
Uncertainty / review state
   +
Symptom urgency
   +
Class knowledge base
   ↓
Recommendation Engine
   ↓
Recommendations + Urgency + Follow-up
```

Class-specific knowledge is stored under `backend/knowledge/<class>.json`.

---

## 14. Steps 19–22: Storage and Clinical Workflow

### Step 19 — Diagnosis persistence

SQLAlchemy + SQLite persist the prediction, confidence, uncertainty components, symptom risk, demographic risk, class probabilities, modality weights, ABCD features, and generated artifact paths.

### Step 20 — PDF report

ReportLab generates the clinical PDF from the decision, uncertainty, class probabilities, Grad-CAM output, and recommendations.

### Step 21 — Lesion tracking

Patients can create named lesions and attach previous diagnoses. Diagnosis assignment uses a **conditional database update** so concurrent requests cannot both claim the same unassigned diagnosis.

### Step 22 — Doctor review

```text
Doctor Queue → Claim → Review → confirmed / revised / dismissed
```

Only the doctor who claimed the case can submit the review.

---

## 15. Algorithm-to-Code Reference

```text
backend/
├── core/
│   ├── preprocessing.py        # quality checks + preprocessing + TTA
│   └── model.py                # EfficientNet-B3 + CBAM + GeM + MLP
│
├── ai/
│   ├── predictor.py            # inference + TTA + MC Dropout
│   ├── uncertainty.py          # MCUE
│   ├── decision_engine.py      # CMCA
│   ├── biobert_engine.py       # symptom NLP / optional BioBERT
│   ├── text_negation.py        # negation handling
│   ├── risk_engine.py          # demographic risk
│   ├── gradcam.py              # Grad-CAM
│   ├── abcd_engine.py          # Otsu + ABCD
│   └── recommendation_engine.py
│
├── reports/
│   └── report_generator.py     # ReportLab PDF
├── features/
│   └── routes.py               # lesion tracking + analytics
└── alembic/                    # database migrations
```

---

## 16. Runtime Configuration

```text
MODEL_NAME = efficientnet_b3
IMG_SIZE = 300
DROPOUT = 0.3
NUM_CLASSES = 7
TTA_VIEWS = 8
MC_DROPOUT_PASSES = 20
UNCERTAINTY_THETA = 0.8054
```

The production runtime expects the trained checkpoint at:

```text
backend/models/best.pth
```

---

## 17. Run Locally

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

### Docker

```bash
docker compose up --build
```

---

## 18. Scope

DERMAXAI is a student research/prototype screening and decision-support system. It is not a substitute for dermatologist assessment, clinical examination, or histopathological confirmation.

- CMCA is a clinical-concern score, not a calibrated malignancy probability.
- MCUE values are uncertainty indicators, not guarantees of clinical safety.
- Symptom and demographic modules provide rule-based risk contributions.
- ABCD features are contextual outputs and are not classifier inputs.
