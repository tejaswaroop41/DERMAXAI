# DERMAXAI v6
### Multimodal AI-Powered Healthcare Diagnostic Assistant

> Final Year BE Project — Dr. AIT, Bengaluru | Course: 22CSP605 | 2025–26  
> Guide: Dr. Suresha D, Assoc. Prof., CSE Programme

DERMAXAI is a **multimodal dermatology screening and clinical-review support system**. The core pipeline starts with a dermoscopic image, extracts an image-model prediction and uncertainty information, analyzes optional symptoms and demographic risk factors, combines the resulting signals using CMCA, generates explainability outputs, and stores the case for reporting and optional doctor review.

The main purpose of this README is to make the implementation traceable: **which algorithm is used at which step, where it is implemented, what it receives, and what it produces.**

---

## 1. Algorithm-to-Pipeline Mapping

| Step | Algorithm / method | Implementation file | Input | Output |
|---|---|---|---|---|
| 1 | File validation + encoded-format verification | `backend/ai/predictor.py` | Uploaded file | Valid image payload |
| 2 | Laplacian variance + brightness + resolution checks | `backend/core/preprocessing.py` | RGB image | Quality measurements + warnings |
| 3 | Resize + ImageNet normalization | `backend/core/preprocessing.py` | RGB image | Model-ready image tensor |
| 4 | **TTA** — 8 deterministic full-image views | `backend/core/preprocessing.py` | Image | 8 transformed views |
| 5 | **EfficientNet-B3** feature extraction | `backend/core/model.py` | TTA tensor | Spatial feature maps |
| 6 | **CBAM** channel attention + spatial attention | `backend/core/model.py` | Feature maps | Attention-refined feature maps |
| 7 | **GeM** pooling | `backend/core/model.py` | Refined feature maps | Feature vector |
| 8 | LayerNorm + Linear + GELU + Dropout MLP | `backend/core/model.py` | Feature vector | 7 class logits |
| 9 | Mel-only logit adjustment | `backend/ai/predictor.py` | 7 logits | Adjusted logits |
| 10 | Softmax + TTA probability averaging | `backend/ai/predictor.py` | Adjusted logits | Class probabilities, predicted class, image confidence |
| 11 | **MC Dropout** | `backend/ai/predictor.py` | Image tensor | Stochastic probability samples |
| 12 | **MCUE** | `backend/ai/uncertainty.py` | TTA + MC distributions | Aleatory, epistemic, fusion, composite uncertainty |
| 13 | Rule-based clinical NLP + negation handling; optional BioBERT module | `backend/ai/biobert_engine.py` | Symptom text | Symptom risk, duration, urgency |
| 14 | Demographic risk rules | `backend/ai/risk_engine.py` | Age, skin type, history, sun exposure | Demographic risk score + breakdown |
| 15 | **CMCA** — Cross-Modal Confidence Aggregation | `backend/ai/decision_engine.py` | Image concern mass + symptom risk + demographic risk | Clinical-concern score + review/urgency signals |
| 16 | **Grad-CAM** | `backend/ai/gradcam.py` | Image + selected class | Visual explanation heatmap |
| 17 | Otsu segmentation + ABCD feature extraction | `backend/ai/abcd_engine.py` | Image | Asymmetry, border irregularity, color variation, diameter |
| 18 | Knowledge-base recommendation rules | `backend/ai/recommendation_engine.py` | Decision + uncertainty + symptoms | Recommendations + urgency + follow-up |
| 19 | SQLAlchemy + SQLite persistence | `backend/core/database.py` | Complete case | Stored diagnosis |
| 20 | ReportLab report generation | `backend/reports/report_generator.py` | Decision + uncertainty + recommendations + Grad-CAM | PDF report |
| 21 | Atomic lesion assignment | `backend/features/routes.py` | Diagnosis + lesion | Longitudinal lesion grouping |
| 22 | Doctor claim/review workflow | `backend/app.py`, `backend/features/routes.py` | Stored diagnosis | Doctor verdict + notes |

---

## 2. Complete System Flow

```text
                    INPUT
          Dermoscopic image + optional
          symptoms + patient profile
                       │
                       ▼
             ┌────────────────────┐
             │ 1. File validation │
             └─────────┬──────────┘
                       ▼
             ┌────────────────────┐
             │ 2. Image quality   │
             │    checks           │
             └─────────┬──────────┘
                       ▼
             ┌────────────────────┐
             │ 3. Resize +        │
             │    normalization   │
             └─────────┬──────────┘
                       ▼
             ┌────────────────────┐
             │ 4. TTA              │
             │ 8 deterministic     │
             │ image views         │
             └─────────┬──────────┘
                       ▼
      ┌───────────────────────────────────────┐
      │           IMAGE CLASSIFIER            │
      │                                       │
      │ 5. EfficientNet-B3                    │
      │          ↓                            │
      │ 6. CBAM                               │
      │          ↓                            │
      │ 7. GeM pooling                        │
      │          ↓                            │
      │ 8. LayerNorm/GELU/Dropout MLP         │
      │          ↓                            │
      │ 9. Mel-only logit adjustment          │
      │          ↓                            │
      │ 10. Softmax + TTA averaging            │
      └──────────────────┬────────────────────┘
                         │
                Predicted class
                + image confidence
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       11. MC Dropout          TTA distribution
              │                     │
              └──────────┬──────────┘
                         ▼
                    12. MCUE
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       Image           13. NLP        14. Demographic
   concern mass        symptom risk       risk
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                    15. CMCA
                         │
           Clinical-concern decision
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         16. Grad-CAM  17. ABCD  18. Recommendation
              │          │          │
              └──────────┼──────────┘
                         ▼
                  19. Diagnosis DB
                         │
                ┌────────┴─────────┐
                ▼                  ▼
          20. PDF report     21. Lesion tracking
                                      │
                                      ▼
                              22. Doctor review
```

---

## 3. Training vs Inference

### Training-time algorithms

These algorithms are used to **produce the trained model checkpoint**.

| Algorithm | Stage | Role |
|---|---|---|
| **ACWF-FL** | Training loss | Effective-number class weighting + focal loss (`β=0.9999`, `γ=2.0`) with `1.5×` malignant-class loss amplification |
| **SAM** | Training phase 2 | Sharpness-Aware Minimization |
| **SWA** | Training phase 3 | Stochastic Weight Averaging |

Conceptually:

```text
Dataset
   ↓
EfficientNet-B3 + CBAM + GeM + MLP
   ↓
ACWF-FL training
   ↓
SAM phase
   ↓
SWA phase
   ↓
Trained checkpoint (best.pth)
```

These methods are **not rerun inside `/api/diagnose`**.

### Inference-time algorithms

```text
TTA
   ↓
EfficientNet-B3 + CBAM + GeM + MLP
   ↓
Mel-only logit adjustment
   ↓
Softmax / prediction
   ↓
MC Dropout
   ↓
MCUE
   ↓
Symptom NLP + Demographic Risk
   ↓
CMCA
   ↓
Grad-CAM + ABCD + Recommendations
```

---

## 4. Image Preprocessing and TTA

Images are resized to **300×300** and normalized using:

```text
Mean = [0.485, 0.456, 0.406]
Std  = [0.229, 0.224, 0.225]
```

The default TTA configuration is `8` views. It uses full-image transformations rather than spatial crops:

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

The class-probability vectors from the configured views are averaged before selecting the primary class.

---

## 5. Image Classification Model

The classifier is implemented in `backend/core/model.py` as:

```text
EfficientNet-B3
      ↓
CBAM
      ↓
GeM pooling
      ↓
LayerNorm
      ↓
Linear → 512
      ↓
GELU
      ↓
Dropout(0.3)
      ↓
LayerNorm
      ↓
Linear → 256
      ↓
GELU
      ↓
Dropout(0.3)
      ↓
LayerNorm
      ↓
Linear → 7
```

### EfficientNet-B3

EfficientNet-B3 is the convolutional backbone used to extract high-level spatial features from the dermoscopic image.

### CBAM

CBAM is applied after the backbone feature map and contains:

```text
Channel Attention
      ↓
Spatial Attention
```

Channel attention uses global average and global maximum pooled descriptors with an MLP and sigmoid gate.

Spatial attention uses channel-wise average and maximum projections followed by a convolutional attention gate.

### GeM pooling

Generalized Mean Pooling converts the refined spatial feature map into a compact feature vector.

```text
GeM(x) = ( mean(clamp(x, eps)^p) )^(1/p)
```

The pooling parameter `p` is learnable in the implementation.

### MLP head

The pooled vector is passed through a three-stage LayerNorm/Linear/GELU/Dropout head and finally produces logits for the seven HAM10000 classes:

```text
akiec · bcc · bkl · df · mel · nv · vasc
```

---

## 6. Mel Logit Adjustment

Before softmax, DERMAXAI optionally applies a targeted adjustment to the `mel` logit only.

Current configuration:

```text
LOGIT_ADJUSTMENT_ENABLED = true
LOGIT_ADJUSTMENT_CLASS   = mel
LOGIT_ADJUSTMENT_TAU     = 0.3
MEL_LOG_PRIOR            = -2.1970
```

No other class logit is modified by this adjustment.

---

## 7. MC Dropout and MCUE

After the primary image prediction, the predictor performs stochastic MC-dropout passes. Only explicit dropout layers are switched to training mode; the remaining model stays in evaluation mode.

Default:

```text
MC_DROPOUT_PASSES = 20
```

MCUE then combines the TTA distribution and MC-dropout distributions.

### Aleatory uncertainty

The expected normalized entropy of the stochastic MC samples:

```text
H(p) = -Σ pᵢ log(pᵢ)

normalized entropy = H(p) / log(7)
```

### Epistemic uncertainty

The implementation uses the normalized mutual-information/BALD form:

```text
epistemic = H(mean(MC samples))
             - mean(H(each MC sample))
```

### Fusion uncertainty

The deterministic TTA distribution and the mean MC distribution are compared using normalized **Jensen-Shannon divergence**.

### Composite uncertainty

```text
composite =
    0.4 × aleatory
  + 0.4 × epistemic
  + 0.2 × fusion
```

All components are constrained to `[0,1]`.

The review threshold is taken from the checkpoint's `mcue_threshold` when available, otherwise the configured value is:

```text
0.8054
```

Confidence labels:

```text
< 0.20  → Very High
< 0.40  → High
< 0.60  → Moderate
< 0.80  → Low
≥ 0.80  → Very Low
```

---

## 8. Symptom Analysis

The default live implementation is lightweight **rule-based clinical NLP**. The module contains an optional BioBERT transformer path, but the current singleton is initialized with transformer mode disabled.

The rule engine:

```text
Free-text symptoms
      ↓
Keyword matching
      ↓
Negation handling
      ↓
Duplicate/overlap suppression
      ↓
Risk-weight accumulation
      ↓
Symptom risk score [0,1]
```

Clinical terms include bleeding, ulceration, rapid growth, irregularity, color changes, asymmetry, itching, pain, crusting and oozing.

The engine also extracts duration from day/week/month/year expressions and can set an urgency flag when risk keywords are present with unknown or short onset duration.

Repeated occurrences of the same keyword are counted once.

---

## 9. Demographic Risk Engine

The demographic module is a rule-based risk contribution layer.

```text
Age
  +
Fitzpatrick skin type
  +
Medical/family history
  +
Sun exposure
  ↓
Demographic risk score
```

The result is capped at `1.0` and returned with a factor-by-factor breakdown.

The current implementation accepts `gender` but does not apply a separate gender weight in the scoring formula.

---

## 10. CMCA — Multimodal Decision Layer

CMCA is used **after** the independent image, symptom, and demographic calculations.

The image model produces two useful probability aggregates:

```text
Malignancy mass
    = P(bcc) + P(mel)

Clinical-concern mass
    = P(akiec) + P(bcc) + P(mel)
```

The three CMCA inputs are:

```text
Image clinical-concern mass
Symptom risk score
Demographic risk score
```

Evidence-adaptive weights are calculated as:

```text
image       = 0.25 + 0.75 × image confidence
symptoms    = 0.25 + 0.75 × symptom risk
demographics= 0.25 + 0.75 × demographic risk
```

The CMCA score is the weighted average of the three normalized signals.

Current escalation values:

```text
CMCA concern threshold         = 0.30
Malignancy-mass escalation     = 0.30
Malignant review confidence    = 0.70
```

### Important distinction

CMCA **does not change the image-model predicted class**.

For example, a case can have:

```text
Predicted class = nv
Clinical concern = true
```

because multimodal risk, uncertainty, or urgency can trigger review without converting the image prediction into `bcc` or `mel`.

---

## 11. Clinical Class Semantics

The application keeps the following sets separate:

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

Therefore:

```text
Predicted class
    = image classifier output

Malignant
    = predicted class is bcc or mel

Clinical concern
    = concern class OR CMCA/review escalation
```

---

## 12. Explainability Algorithms

### Grad-CAM

Grad-CAM is generated for the selected image class using the final spatial backbone block.

```text
Forward pass
   ↓
Feature activations
   ↓
Backward pass for target class
   ↓
Feature-channel gradient weights
   ↓
Weighted activation map
   ↓
ReLU + normalization
   ↓
Heatmap overlay
```

The heatmap is intended to show which image regions influenced the selected class score.

### ABCD feature extraction

The ABCD module is a **parallel explainability/context algorithm**, not a classifier input.

```text
Image
  ↓
Otsu thresholding
  ↓
Morphological open/close
  ↓
Largest lesion contour
  ↓
├─ Asymmetry
├─ Border irregularity
├─ Color variation
└─ Diameter (pixels)
```

The four values are derived using image geometry/statistics and are stored for context. They are **never fed into EfficientNet-B3**.

---

## 13. Recommendation and Report Layer

Recommendations are generated after the final decision state is known.

```text
Predicted class
+ malignancy status
+ uncertainty/review state
+ symptom urgency
+ class knowledge base
        ↓
Recommendation Engine
        ↓
Recommendations + urgency + follow-up
```

Per-class knowledge is loaded from:

```text
backend/knowledge/<class>.json
```

The PDF report is then generated using ReportLab and can contain:

```text
Predicted class
Image confidence
Malignancy mass
Clinical-concern mass
Uncertainty values
Modality contributions
Class probabilities
Grad-CAM
Recommendations
```

---

## 14. Database and Workflow Algorithms

### Diagnosis persistence

Each diagnosis stores the outputs required for history, reports, and later review, including class probabilities, uncertainty components, symptom risk, demographic risk, modality weights, ABCD features and generated artifact paths.

### Lesion tracking

A diagnosis can be attached to a patient-owned lesion for longitudinal tracking. The attachment uses a **single conditional database update** so two concurrent requests cannot both successfully claim the same unassigned diagnosis for different lesions.

### Doctor review

```text
Diagnosis queue
      ↓
Claim case
      ↓
Review
      ↓
confirmed / revised / dismissed
```

Only the claiming doctor can submit the final review.

---

## 15. Model Checkpoint

Place the trained checkpoint at:

```text
backend/models/best.pth
```

The loader accepts common checkpoint layouts such as:

```text
model_state
model_state_dict
direct state dictionary
```

When `class_names` are included in the checkpoint, their order must exactly match:

```text
akiec, bcc, bkl, df, mel, nv, vasc
```

The runtime refuses to serve a partially loaded architecture.

`ALLOW_RANDOM_WEIGHTS=true` exists only for development/CI scenarios where a real trained checkpoint is intentionally unavailable.

---

## 16. Project Structure

```text
DERMAXAI/
├── backend/
│   ├── app.py
│   ├── core/
│   │   ├── preprocessing.py      # resize, normalize, TTA, quality checks
│   │   ├── model.py              # EfficientNet-B3, CBAM, GeM, MLP
│   │   ├── database.py
│   │   └── auth.py
│   ├── ai/
│   │   ├── predictor.py          # TTA + prediction + MC Dropout
│   │   ├── uncertainty.py        # MCUE
│   │   ├── decision_engine.py    # CMCA
│   │   ├── biobert_engine.py     # symptom NLP / optional BioBERT
│   │   ├── text_negation.py
│   │   ├── risk_engine.py
│   │   ├── gradcam.py
│   │   ├── abcd_engine.py
│   │   └── recommendation_engine.py
│   ├── reports/
│   │   └── report_generator.py
│   ├── features/
│   │   └── routes.py
│   ├── knowledge/
│   ├── models/
│   └── alembic/
├── frontend/
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 17. Technology Stack

| Layer | Technology |
|---|---|
| Deep learning | PyTorch + timm |
| Backbone | EfficientNet-B3 |
| Attention | CBAM |
| Pooling | GeM |
| Classification head | LayerNorm + GELU + Dropout MLP |
| Training loss | ACWF-FL |
| Optimizer | SAM + AdamW |
| Weight averaging | SWA |
| Inference augmentation | TTA |
| Uncertainty | MC Dropout + MCUE |
| Symptom analysis | Rule-based NLP + optional BioBERT |
| Multimodal fusion | CMCA |
| Explainability | Grad-CAM + ABCD |
| Backend | FastAPI + SQLAlchemy |
| Database | SQLite |
| Frontend | React + Vite + TailwindCSS |
| Reporting | ReportLab |
| Deployment | Docker Compose + Nginx |
| CI | GitHub Actions |

---

## 18. Local Run

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
git clone https://github.com/tejaswaroop41/DERMAXAI.git
cd DERMAXAI
cp .env.example .env
docker compose up --build
```

Place `best.pth` under `backend/models/` before running the normal application. Docker startup executes the Alembic migration before starting Uvicorn.

---

## 19. Limitations

DERMAXAI is a **student research/prototype screening and decision-support system**. Its outputs are not a substitute for clinical examination, dermatologist assessment, or histopathological confirmation.

In particular:

- CMCA is a concern score, not a calibrated malignancy probability.
- MCUE uncertainty values are model uncertainty indicators, not guarantees of safety.
- Symptom and demographic scores are rule-based contributions.
- ABCD features are contextual image measurements and are not classifier inputs.
- Model behavior depends on the trained checkpoint and its training data.
