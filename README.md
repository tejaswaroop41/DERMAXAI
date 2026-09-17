# DERMAXAI v6
### Multimodal AI-Powered Healthcare Diagnostic Assistant

> Final Year BE Project — Dr. AIT, Bengaluru | Course: 22CSP605 | 2025–26  
> Guide: Dr. Suresha D, Assoc. Prof., CSE Programme

DERMAXAI is a multimodal dermatology screening and clinical-review support system. This README is organized around one question: **which algorithm is used at which step of the DERMAXAI pipeline?**

## 1. Algorithm-to-Pipeline Mapping

| Step | Algorithm / method | Implementation file | Purpose |
|---|---|---|---|
| 1 | Image/file validation | `backend/ai/predictor.py` | Verify extension and actual encoded image |
| 2 | Laplacian variance + brightness + resolution checks | `backend/core/preprocessing.py` | Flag low-quality input |
| 3 | Resize + ImageNet normalization | `backend/core/preprocessing.py` | Prepare the 300×300 model input |
| 4 | **TTA** — 8 deterministic full-image views | `backend/core/preprocessing.py` | Improve inference robustness through view averaging |
| 5 | **EfficientNet-B3** | `backend/core/model.py` | Extract deep image features |
| 6 | **CBAM** | `backend/core/model.py` | Refine features with channel and spatial attention |
| 7 | **GeM** | `backend/core/model.py` | Convert feature maps into a feature vector |
| 8 | LayerNorm/GELU/Dropout MLP | `backend/core/model.py` | Produce 7-class logits |
| 9 | Mel-only logit adjustment | `backend/ai/predictor.py` | Apply the configured targeted mel adjustment |
| 10 | Softmax + TTA probability averaging | `backend/ai/predictor.py` | Produce class probabilities, class and confidence |
| 11 | **MC Dropout** | `backend/ai/predictor.py` | Generate stochastic predictions |
| 12 | **MCUE** | `backend/ai/uncertainty.py` | Estimate aleatory, epistemic, fusion and composite uncertainty |
| 13 | Rule-based clinical NLP + negation; optional BioBERT | `backend/ai/biobert_engine.py` | Convert symptom text into risk/urgency information |
| 14 | Demographic risk rules | `backend/ai/risk_engine.py` | Compute risk from patient/profile factors |
| 15 | **CMCA** | `backend/ai/decision_engine.py` | Combine image concern, symptom risk and demographic risk |
| 16 | **Grad-CAM** | `backend/ai/gradcam.py` | Explain image regions that influenced the selected class |
| 17 | Otsu segmentation + ABCD features | `backend/ai/abcd_engine.py` | Generate additional contextual lesion measurements |
| 18 | Knowledge-base recommendation rules | `backend/ai/recommendation_engine.py` | Produce recommendations, urgency and follow-up |
| 19 | SQLAlchemy + SQLite | `backend/core/database.py` | Persist the diagnostic case |
| 20 | ReportLab | `backend/reports/report_generator.py` | Generate the PDF report |
| 21 | Atomic diagnosis assignment | `backend/features/routes.py` | Attach diagnosis safely to a tracked lesion |
| 22 | Doctor review workflow | `backend/app.py`, `backend/features/routes.py` | Queue, claim and review cases |

## 2. Complete System Flow

```text
Image + Symptoms + Patient Profile
              │
              ▼
      1. Image validation
              ▼
      2. Quality checks
              ▼
   3. Resize + normalization
              ▼
          4. TTA
              ▼
   ┌─────────────────────────┐
   │ 5. EfficientNet-B3      │
   │          ↓              │
   │ 6. CBAM                 │
   │          ↓              │
   │ 7. GeM                  │
   │          ↓              │
   │ 8. MLP Head             │
   │          ↓              │
   │ 9. Mel logit adjustment │
   │          ↓              │
   │ 10. Softmax + TTA mean  │
   └────────────┬────────────┘
                │
         Class + confidence
                │
       ┌────────┴────────┐
       ▼                 ▼
11. MC Dropout      TTA distribution
       │                 │
       └────────┬────────┘
                ▼
             12. MCUE
                │
       ┌────────┼────────┐
       ▼        ▼        ▼
 Image concern  13. NLP  14. Demographic
       │        risk     risk
       └────────┼────────┘
                ▼
             15. CMCA
                │
                ▼
       Clinical concern /
        review decision
          │      │      │
          ▼      ▼      ▼
      16.Grad 17.ABCD 18.Recommendation
          │      │      │
          └──────┼──────┘
                 ▼
          19. Database record
            │           │
            ▼           ▼
      20. PDF report 21. Lesion tracking
                            │
                            ▼
                     22. Doctor review
```

## 3. Training vs Inference

### Training-time methods

| Method | Stage | Purpose |
|---|---|---|
| **ACWF-FL** | Training loss | Effective-number class weighting + focal loss (`β=0.9999`, `γ=2.0`) and `1.5×` malignant-class loss amplification |
| **SAM** | Training phase 2 | Sharpness-Aware Minimization |
| **SWA** | Training phase 3 | Stochastic Weight Averaging |

```text
Dataset → EfficientNet-B3 + CBAM + GeM + MLP
        → ACWF-FL → SAM → SWA → trained checkpoint
```

These training methods are not rerun during a normal `/api/diagnose` request.

### Inference-time methods

```text
TTA
 ↓
EfficientNet-B3 → CBAM → GeM → MLP
 ↓
Mel-only logit adjustment
 ↓
Softmax + TTA averaging
 ↓
MC Dropout → MCUE
 ↓
Symptom NLP + Demographic Risk
 ↓
CMCA
 ↓
Grad-CAM + ABCD + Recommendation
```

## 4. Steps 1–4: Input, Quality and TTA

Images are resized to **300×300** and normalized using:

```text
Mean = [0.485, 0.456, 0.406]
Std  = [0.229, 0.224, 0.225]
```

The default 8 TTA views are:

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

Quality checks use Laplacian variance for blur, grayscale mean brightness for exposure, and minimum image dimension for resolution. These checks produce warnings and do not change the classifier output.

## 5. Steps 5–8: Image Classifier

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
Linear → 512 → GELU → Dropout(0.3)
      ↓
LayerNorm
      ↓
Linear → 256 → GELU → Dropout(0.3)
      ↓
LayerNorm
      ↓
Linear → 7 classes
```

GeM is a learnable generalized mean:

```text
GeM(x) = ( mean(clamp(x, eps)^p) )^(1/p)
```

Seven output classes:

```text
akiec · bcc · bkl · df · mel · nv · vasc
```

## 6. Steps 9–10: Logit Adjustment and Primary Prediction

The predictor can apply a mel-only logit adjustment before softmax:

```text
LOGIT_ADJUSTMENT_ENABLED = true
LOGIT_ADJUSTMENT_CLASS   = mel
LOGIT_ADJUSTMENT_TAU     = 0.3
MEL_LOG_PRIOR            = -2.1970
```

Only the `mel` logit is changed. Softmax probabilities are then averaged across TTA views. The highest probability is the `predicted_class`; that probability is the `image confidence`.

## 7. Steps 11–12: MC Dropout and MCUE

MC Dropout performs repeated stochastic passes with explicit dropout layers in training mode while the rest of the network remains in evaluation mode.

Default:

```text
MC_DROPOUT_PASSES = 20
```

MCUE combines the TTA distribution and MC distributions:

```text
Aleatory
= expected normalized entropy

Epistemic
= predictive entropy of the MC mean
  - expected MC entropy

Fusion
= normalized Jensen-Shannon divergence
  between TTA and MC distributions
```

Composite uncertainty:

```text
0.4 × aleatory
+ 0.4 × epistemic
+ 0.2 × fusion
```

The review threshold uses the checkpoint value `mcue_threshold` when present; otherwise it falls back to `0.8054`.

## 8. Step 13: Symptom NLP

The current live implementation is **rule-based clinical NLP**. The module contains an optional BioBERT transformer path, but transformer mode is disabled in the current singleton.

```text
Free-text symptoms
      ↓
Keyword matching
      ↓
Negation handling
      ↓
Duplicate/overlap suppression
      ↓
Weighted symptom risk
      ↓
Duration + urgency information
```

## 9. Step 14: Demographic Risk

```text
Age risk
+ Fitzpatrick skin-type risk
+ Medical/family-history risk
+ Sun-exposure risk
        ↓
Demographic risk score [0,1]
```

The current scoring implementation accepts gender but does not apply a separate gender weight.

## 10. Step 15: CMCA

**CMCA = Cross-Modal Confidence Aggregation.** It is applied after image, symptom and demographic signals are available.

```text
Malignancy mass
= P(bcc) + P(mel)

Clinical-concern mass
= P(akiec) + P(bcc) + P(mel)
```

CMCA combines:

```text
Image clinical-concern mass
Symptom risk
Demographic risk
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

CMCA creates a clinical-concern/review signal and **does not overwrite the image-model predicted class**.

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

Thus:

```text
Predicted class = image-model output
Malignant       = bcc or mel prediction
Clinical concern = concern class OR multimodal/review escalation
```

## 12. Steps 16–17: Explainability

### Grad-CAM

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

### ABCD

```text
Image
 ↓
Otsu segmentation
 ↓
Morphological opening/closing
 ↓
Largest lesion contour
 ↓
Asymmetry
Border irregularity
Color variation
Diameter in pixels
```

ABCD is an explainability/context layer and is **not fed into the classifier**.

## 13. Step 18: Recommendations

```text
Prediction
+ malignancy status
+ uncertainty/review state
+ symptom urgency
+ class knowledge
        ↓
Recommendation Engine
        ↓
Recommendations + urgency + follow-up
```

Class-specific knowledge is stored in `backend/knowledge/`.

## 14. Steps 19–22: Storage and Workflow

The diagnosis record stores the main prediction and multimodal outputs needed for history, reports and review. ReportLab generates the PDF. Patients can attach diagnoses to named lesions, with a conditional database update protecting concurrent assignment.

```text
Doctor queue → Claim → Review → confirmed / revised / dismissed
```

## 15. Main Algorithm Files

```text
backend/
├── core/
│   ├── preprocessing.py       # resize, normalize, TTA, quality checks
│   └── model.py               # EfficientNet-B3, CBAM, GeM, MLP
├── ai/
│   ├── predictor.py           # prediction, TTA, MC Dropout
│   ├── uncertainty.py         # MCUE
│   ├── decision_engine.py     # CMCA
│   ├── biobert_engine.py      # symptom NLP / optional BioBERT
│   ├── risk_engine.py         # demographic risk
│   ├── gradcam.py             # Grad-CAM
│   ├── abcd_engine.py         # ABCD features
│   └── recommendation_engine.py
├── reports/
│   └── report_generator.py
├── features/
│   └── routes.py
└── alembic/
```

## 16. Local Run

```powershell
cd backend
.\venv\Scripts\Activate.ps1
alembic upgrade head
uvicorn app:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Docker:

```bash
docker compose up --build
```

Place the trained checkpoint at:

```text
backend/models/best.pth
```

## 17. Limitations

DERMAXAI is a student research/prototype screening and decision-support system. It is not a substitute for dermatologist assessment, clinical examination, or histopathological confirmation.

- CMCA is a clinical-concern score, not a calibrated malignancy probability.
- MCUE values are uncertainty indicators, not guarantees of clinical safety.
- Symptom and demographic modules provide rule-based risk contributions.
- ABCD features are contextual outputs and are not classifier inputs.
