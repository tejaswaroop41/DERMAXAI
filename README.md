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
             │    checks          │
             └─────────┬──────────┘
                       ▼
             ┌────────────────────┐
             │ 3. Resize +        │
             │    normalization   │
             └─────────┬──────────┘
                       ▼
             ┌────────────────────┐
             │ 4. TTA             │
             │ 8 deterministic    │
             │ image views        │
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

The pooled vector is passed through a three-stage LayerNorm/Linear/GELU/Dropout head and finally produces logits for:

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

After the primary image prediction, the predictor performs stochastic MC-dropout passes. Only explicit dropout layers are switched to training mode.

Default:

```text
MC_DROPOUT_PASSES = 20
```

MCUE combines the TTA distribution and MC-dropout distributions.

### Aleatory uncertainty

```text
H(p) = -Σ pᵢ log(pᵢ)

normalized entropy = H(p) / log(7)
```

### Epistemic uncertainty

```text
epistemic = H(mean(MC samples))
             - mean(H(each MC sample))
```

### Fusion uncertainty

The TTA distribution and mean MC distribution are compared with normalized **Jensen-Shannon divergence**.

### Composite uncertainty

```text
composite =
    0.4 × aleatory
  + 0.4 × epistemic
  + 0.2 × fusion
```

The review threshold uses `mcue_threshold` from the checkpoint when present; otherwise the configured fallback is `0.8054`.

Confidence labels are:

```text
< 0.20  → Very High
< 0.40  → High
< 0.60  → Moderate
< 0.80  → Low
≥ 0.80  → Very Low
```

---

## 8. Symptom Analysis

The default live implementation is **rule-based clinical NLP**. The module also contains an optional BioBERT transformer path, but the current runtime singleton has transformer mode disabled.

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
Symptom risk score [0,1]
```

The engine also extracts durations from day/week/month/year expressions and can set an urgency flag when risk keywords are present with unknown or short onset duration.

---

## 9. Demographic Risk Engine

The current risk engine combines:

```text
Age risk
+ Fitzpatrick skin-type risk
+ Medical/family-history risk
+ Sun-exposure risk
        ↓
Demographic risk score
```

The result is capped at `1.0` and returned with a factor breakdown.

The API accepts `gender`, but the current scoring implementation does not apply a separate gender weight.

---

## 10. CMCA — Multimodal Decision Layer

CMCA is used **after** image, symptom, and demographic calculations.

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

Evidence-adaptive weights are:

```text
image        = 0.25 + 0.75 × image confidence
symptoms     = 0.25 + 0.75 × symptom risk
demographics = 0.25 + 0.75 × demographic risk
```

The CMCA score is the weighted average of the three normalized concern signals.

Current escalation values:

```text
CMCA concern threshold        = 0.30
Malignancy-mass escalation    = 0.30
Malignant review confidence   = 0.70
```

CMCA **does not change the image-model predicted class**. A case can therefore be predicted as a non-malignant class while still being flagged for clinical concern or review.

---

## 11. Clinical Class Semantics

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

---

## 12. Explainability Algorithms

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

The implementation uses the final spatial backbone block to produce the visual explanation.

### ABCD feature extraction

```text
Image
  ↓
Otsu thresholding
  ↓
Morphological opening/closing
  ↓
Largest lesion contour
  ↓
├─ Asymmetry
├─ Border irregularity
├─ Color variation
└─ Diameter (pixels)
```

The ABCD module is a **parallel explainability/context layer**. Its outputs are stored and displayed, but they are **never fed into EfficientNet-B3**.

---

## 13. Recommendation and Report Layer

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

Class-specific knowledge is stored under:

```text
backend/knowledge/<class>.json
```

Reports are generated with ReportLab and can include prediction, confidence, malignancy mass, clinical-concern mass, uncertainty, modality contribution, class probabilities, Grad-CAM, recommendations, and a medical-use disclaimer.

---

## 14. Database and Workflow

The diagnosis record stores the main model and multimodal outputs required for history, reports, and later review.

Lesion tracking groups diagnoses over time. Diagnosis assignment uses a conditional database update so concurrent requests cannot both claim the same unassigned diagnosis.

Doctor workflow:

```text
Queue → Claim → Review → confirmed / revised / dismissed
```

---

## 15. Model Checkpoint

Place the trained model at:

```text
backend/models/best.pth
```

The loader supports common checkpoint layouts such as `model_state`, `model_state_dict`, or a direct state dictionary. When `class_names` are present, their order must exactly match:

```text
akiec, bcc, bkl, df, mel, nv, vasc
```

Normal operation refuses missing or partially incompatible trained weights. `ALLOW_RANDOM_WEIGHTS=true` is reserved for development/CI scenarios.

---

## 16. Local Run

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

The Docker backend applies Alembic migrations before Uvicorn starts.

---

## 17. Technology Stack

| Component | Technology |
|---|---|
| Deep learning | PyTorch + timm |
| CNN backbone | EfficientNet-B3 |
| Attention | CBAM |
| Pooling | GeM |
| Classifier head | LayerNorm + GELU + Dropout MLP |
| Training loss | ACWF-FL |
| Training optimization | SAM + AdamW |
| Weight averaging | SWA |
| Inference augmentation | TTA |
| Uncertainty | MC Dropout + MCUE |
| Symptom processing | Rule-based NLP + optional BioBERT |
| Multimodal fusion | CMCA |
| Explainability | Grad-CAM + ABCD |
| Backend | FastAPI + SQLAlchemy |
| Database | SQLite |
| Frontend | React + Vite + TailwindCSS |
| Reports | ReportLab |
| Deployment | Docker Compose + Nginx |
| CI | GitHub Actions |

---

## 18. Limitations

DERMAXAI is a **student research/prototype screening and decision-support system**. It is not a substitute for clinical examination, dermatologist assessment, or histopathological confirmation.

The following should be kept explicit when presenting the system:

- CMCA is a clinical-concern score, not a calibrated malignancy probability.
- MCUE values are uncertainty indicators, not guarantees of clinical safety.
- Symptom and demographic scores are rule-based contributions.
- ABCD measurements are contextual image features and are not classifier inputs.
- Model behavior depends on the trained checkpoint and its training data.
