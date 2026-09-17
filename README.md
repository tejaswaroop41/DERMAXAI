# DERMAXAI v6
### Multimodal AI-Powered Healthcare Diagnostic Assistant

> Final Year BE Project — Dr. AIT, Bengaluru | Course: 22CSP605 | 2025–26  
> Guide: Dr. Suresha D, Assoc. Prof., CSE Programme

DERMAXAI is a **multimodal dermatology screening and clinical-review support system**. The system uses a dermoscopic image as the primary diagnostic input and adds uncertainty estimation, symptom analysis, demographic risk analysis, explainability, recommendations, lesion tracking, and doctor review.

This README is organized around one question: **which algorithm is used at which step of the DERMAXAI pipeline?**

---

## 1. Algorithm-to-Pipeline Mapping

| Step | Algorithm / method | Implementation file | Input | Output |
|---|---|---|---|---|
| 1 | File validation + encoded-format verification | `backend/ai/predictor.py` | Uploaded image | Valid image payload |
| 2 | Laplacian variance + brightness + resolution checks | `backend/core/preprocessing.py` | RGB image | Quality measurements + warnings |
| 3 | Resize + ImageNet normalization | `backend/core/preprocessing.py` | RGB image | Model-ready tensor |
| 4 | **TTA** — 8 deterministic full-image views | `backend/core/preprocessing.py` | Image | Transformed image views |
| 5 | **EfficientNet-B3** | `backend/core/model.py` | Image tensor | Spatial feature maps |
| 6 | **CBAM** channel + spatial attention | `backend/core/model.py` | Feature maps | Refined feature maps |
| 7 | **GeM** pooling | `backend/core/model.py` | Refined feature maps | Feature vector |
| 8 | LayerNorm + Linear + GELU + Dropout MLP | `backend/core/model.py` | Feature vector | 7 class logits |
| 9 | Mel-only logit adjustment | `backend/ai/predictor.py` | Class logits | Adjusted logits |
| 10 | Softmax + TTA probability averaging | `backend/ai/predictor.py` | Adjusted logits | Class probabilities + predicted class + confidence |
| 11 | **MC Dropout** | `backend/ai/predictor.py` | Image tensor | Stochastic probability samples |
| 12 | **MCUE** | `backend/ai/uncertainty.py` | TTA + MC distributions | Aleatory, epistemic, fusion, composite uncertainty |
| 13 | Rule-based clinical NLP + negation handling; optional BioBERT module | `backend/ai/biobert_engine.py` | Symptom text | Symptom risk + duration + urgency |
| 14 | Demographic risk rules | `backend/ai/risk_engine.py` | Age, skin type, history, sun exposure | Demographic risk score + breakdown |
| 15 | **CMCA** — Cross-Modal Confidence Aggregation | `backend/ai/decision_engine.py` | Image concern mass + symptom risk + demographic risk | Clinical-concern score + escalation flags |
| 16 | **Grad-CAM** | `backend/ai/gradcam.py` | Image + selected class | Visual heatmap |
| 17 | Otsu segmentation + ABCD feature extraction | `backend/ai/abcd_engine.py` | Image | Asymmetry, border irregularity, color variation, diameter |
| 18 | Knowledge-base recommendation rules | `backend/ai/recommendation_engine.py` | Final decision + uncertainty + symptoms | Recommendations + urgency + follow-up |
| 19 | SQLAlchemy + SQLite | `backend/core/database.py` | Diagnostic outputs | Persistent diagnosis record |
| 20 | ReportLab | `backend/reports/report_generator.py` | Diagnostic outputs + explanation | PDF report |
| 21 | Atomic diagnosis-to-lesion assignment | `backend/features/routes.py` | Diagnosis + lesion | Longitudinal lesion tracking |
| 22 | Doctor claim/review workflow | `backend/app.py`, `backend/features/routes.py` | Stored diagnosis | Doctor verdict + notes |

---

## 2. Complete Algorithmic Flow

```text
Dermoscopic image + optional symptoms + patient profile
                         │
                         ▼
                [1] File validation
                         │
                         ▼
                [2] Quality checks
                         │
                         ▼
             [3] Resize + normalization
                         │
                         ▼
                 [4] TTA views
                         │
                         ▼
┌─────────────────────────────────────────────┐
│              IMAGE CLASSIFIER               │
│                                             │
│ [5] EfficientNet-B3                         │
│          ↓                                  │
│ [6] CBAM                                    │
│          ↓                                  │
│ [7] GeM pooling                             │
│          ↓                                  │
│ [8] LayerNorm/GELU/Dropout MLP              │
│          ↓                                  │
│ [9] Mel-only logit adjustment               │
│          ↓                                  │
│ [10] Softmax + TTA averaging                │
└──────────────────────┬──────────────────────┘
                       │
             Predicted class + confidence
                       │
              ┌────────┴────────┐
              ▼                 ▼
     [11] MC Dropout       TTA distribution
              │                 │
              └────────┬────────┘
                       ▼
                   [12] MCUE
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Image concern [13] Symptom [14] Demographic
         mass          NLP risk       risk
          │            │            │
          └────────────┼────────────┘
                       ▼
                  [15] CMCA
                       │
              Clinical-concern decision
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     [16] Grad-CAM  [17] ABCD   [18] Recommendation
          │            │            │
          └────────────┼────────────┘
                       ▼
                [19] Diagnosis record
                       │
                ┌──────┴───────┐
                ▼              ▼
          [20] PDF report  [21] Lesion tracking
                                  │
                                  ▼
                          [22] Doctor review
```

---

## 3. Training-Time Algorithms vs Inference-Time Algorithms

### Training-time

These methods are used to train the checkpoint that the application later loads.

| Method | Stage | Purpose |
|---|---|---|
| **ACWF-FL** | Training loss | Effective-number class weighting + focal loss; `β=0.9999`, `γ=2.0`, with `1.5×` malignant-class loss amplification |
| **SAM** | Training phase 2 | Sharpness-Aware Minimization |
| **SWA** | Training phase 3 | Stochastic Weight Averaging |

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

These methods are **not rerun during `/api/diagnose`**.

### Inference-time

```text
TTA
 ↓
EfficientNet-B3
 ↓
CBAM
 ↓
GeM
 ↓
MLP
 ↓
Mel-only logit adjustment
 ↓
Softmax + TTA averaging
 ↓
MC Dropout + MCUE
 ↓
Symptom NLP + Demographic Risk
 ↓
CMCA
 ↓
Grad-CAM + ABCD + Recommendations
```

---

## 4. Step 1–4: Image Intake, Quality and TTA

Images are resized to **300×300** and normalized with:

```text
Mean = [0.485, 0.456, 0.406]
Std  = [0.229, 0.224, 0.225]
```

The default TTA configuration is 8 full-image views:

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

Quality checks flag blurry images using Laplacian variance, very dark/bright images using grayscale mean brightness, and very small images using the minimum image dimension. These checks generate warnings and do not change the classifier output.

---

## 5. Step 5–8: Image Classification Model

The deployed classifier is:

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
Linear → 7 classes
```

CBAM contains sequential **channel attention** and **spatial attention**. GeM is a learnable generalized-mean pooling operation.

The seven classes are:

```text
akiec · bcc · bkl · df · mel · nv · vasc
```

---

## 6. Step 9–10: Logit Adjustment and Primary Prediction

Before softmax, the predictor can apply a targeted mel-only logit adjustment:

```text
LOGIT_ADJUSTMENT_ENABLED = true
LOGIT_ADJUSTMENT_CLASS   = mel
LOGIT_ADJUSTMENT_TAU     = 0.3
MEL_LOG_PRIOR            = -2.1970
```

Only the `mel` logit is adjusted. Softmax probabilities are then averaged across the configured TTA views. The highest-probability class becomes `predicted_class`, and its probability becomes `image confidence`.

---

## 7. Step 11–12: MC Dropout and MCUE

The predictor performs stochastic forward passes using only explicit dropout layers in training mode while the rest of the network remains in evaluation mode.

Default:

```text
MC_DROPOUT_PASSES = 20
```

MCUE computes:

```text
Aleatory uncertainty
= expected normalized entropy

Epistemic uncertainty
= predictive entropy of MC mean
  - expected MC entropy

Fusion uncertainty
= normalized Jensen-Shannon divergence
  between TTA and MC distributions
```

The current composite score is:

```text
composite =
    0.4 × aleatory
  + 0.4 × epistemic
  + 0.2 × fusion
```

The fallback uncertainty-review threshold is `0.8054` when a checkpoint-specific `mcue_threshold` is not provided.

---

## 8. Step 13: Symptom NLP

The default live implementation is **rule-based clinical NLP**. An optional BioBERT transformer path exists in the module but is disabled in the current singleton configuration.

```text
Free-text symptoms
      ↓
Keyword matching
      ↓
Negation handling
      ↓
Duplicate/overlap suppression
      ↓
Weighted risk accumulation
      ↓
Symptom risk score
```

The engine also extracts duration from day/week/month/year expressions and can produce an urgency flag from relevant short/unknown-onset symptom patterns.

---

## 9. Step 14: Demographic Risk

The current rule-based demographic risk engine uses:

```text
Age
+ Fitzpatrick skin type
+ Medical/family history
+ Sun exposure
        ↓
Demographic risk score [0,1]
```

The score is capped at `1.0` and returned with a factor breakdown. The API accepts gender, but the current scoring implementation does not apply a separate gender weight.

---

## 10. Step 15: CMCA Multimodal Fusion

**CMCA (Cross-Modal Confidence Aggregation)** is applied after image, symptom and demographic signals are available.

```text
Malignancy mass
    = P(bcc) + P(mel)

Clinical-concern mass
    = P(akiec) + P(bcc) + P(mel)
```

CMCA uses:

```text
Image clinical-concern mass
Symptom risk score
Demographic risk score
```

with evidence-adaptive weights:

```text
image        = 0.25 + 0.75 × image confidence
symptoms     = 0.25 + 0.75 × symptom risk
demographics = 0.25 + 0.75 × demographic risk
```

Current escalation values:

```text
CMCA concern threshold        = 0.30
Malignancy-mass escalation    = 0.30
Malignant review confidence   = 0.70
```

CMCA produces a **clinical-concern signal** and does not overwrite the image-model predicted class.

---

## 11. Clinical Class Semantics

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

Thus:

```text
predicted_class
    = image-model output

is_malignant
    = predicted class is bcc or mel

clinical_concern
    = concern class OR multimodal/review escalation
```

---

## 12. Step 16–17: Explainability

### Grad-CAM

```text
Forward pass
   ↓
Target-layer activations
   ↓
Backward pass for selected class
   ↓
Gradient-based channel weights
   ↓
Weighted activation map
   ↓
ReLU + normalization
   ↓
Heatmap overlay
```

### ABCD

```text
Image
  ↓
Otsu thresholding
  ↓
Morphological open/close
  ↓
Largest lesion contour
  ↓
├── Asymmetry
├── Border irregularity
├── Color variation
└── Diameter in pixels
```

ABCD features are an **explainability/context output** and are never fed into the classifier.

---

## 13. Step 18: Recommendation Engine

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

Class-specific knowledge is stored in `backend/knowledge/<class>.json`.

---

## 14. Step 19–22: Storage, Reporting and Workflow

The diagnosis record persists prediction, confidence, uncertainty components, symptom risk, demographic risk, class probabilities, modality weights, ABCD features and generated artifact paths.

ReportLab generates the PDF report. Patients can attach diagnoses to named lesions, and the attachment is protected with a conditional database update for concurrent requests.

Doctor workflow:

```text
Queue → Claim → Review → confirmed / revised / dismissed
```

---

## 15. Key Algorithm Files

```text
backend/
├── core/
│   ├── preprocessing.py       # preprocessing + TTA + quality checks
│   └── model.py               # EfficientNet-B3 + CBAM + GeM + MLP
│
├── ai/
│   ├── predictor.py           # prediction + TTA + MC Dropout
│   ├── uncertainty.py         # MCUE
│   ├── decision_engine.py     # CMCA
│   ├── biobert_engine.py      # symptom NLP / optional BioBERT
│   ├── text_negation.py
│   ├── risk_engine.py         # demographic risk
│   ├── gradcam.py             # Grad-CAM
│   ├── abcd_engine.py         # ABCD features
│   └── recommendation_engine.py
│
├── reports/
│   └── report_generator.py
├── features/
│   └── routes.py
└── alembic/
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

The runtime also validates checkpoint class ordering when class names are included in the saved checkpoint.

---

## 17. Running Locally

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

Place the trained checkpoint at:

```text
backend/models/best.pth
```

---

## 18. Limitations

DERMAXAI is a **student research/prototype screening and decision-support system**. It is not a substitute for dermatologist assessment, clinical examination, or histopathological confirmation.

Keep these distinctions explicit when presenting the project:

- CMCA is a clinical-concern score, not a calibrated malignancy probability.
- MCUE values are uncertainty indicators, not guarantees of clinical safety.
- Symptom and demographic modules provide rule-based risk contributions.
- ABCD features provide context and are not classifier inputs.
- Model behavior depends on the trained checkpoint and its training data.
