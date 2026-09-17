# DERMAXAI v6
### Multimodal AI-Powered Healthcare Diagnostic Assistant

> Final Year BE Project — Dr. AIT, Bengaluru | Course: 22CSP605 | 2025–26  
> Guide: Dr. Suresha D, Assoc. Prof., CSE Programme

DERMAXAI is a multimodal dermatology screening and clinical-review support system. This README is intentionally focused on **which algorithm is used at which step** of the system and where that algorithm is implemented.

## Algorithm-to-Pipeline Mapping

| Step | Algorithm / method | Implementation | Purpose |
|---|---|---|---|
| 1 | Image/file validation | `backend/ai/predictor.py` | Validate extension and actual image encoding |
| 2 | Laplacian variance + brightness + resolution checks | `backend/core/preprocessing.py` | Flag low-quality images |
| 3 | Resize + ImageNet normalization | `backend/core/preprocessing.py` | Prepare model input at 300×300 |
| 4 | **TTA** | `backend/core/preprocessing.py` | Generate 8 deterministic full-image views |
| 5 | **EfficientNet-B3** | `backend/core/model.py` | Extract spatial image features |
| 6 | **CBAM** | `backend/core/model.py` | Apply channel and spatial attention |
| 7 | **GeM** | `backend/core/model.py` | Pool feature maps into a feature vector |
| 8 | LayerNorm/GELU/Dropout MLP | `backend/core/model.py` | Produce logits for 7 classes |
| 9 | Mel-only logit adjustment | `backend/ai/predictor.py` | Apply targeted adjustment before softmax |
| 10 | Softmax + TTA probability averaging | `backend/ai/predictor.py` | Produce probabilities, predicted class and image confidence |
| 11 | **MC Dropout** | `backend/ai/predictor.py` | Generate stochastic probability samples |
| 12 | **MCUE** | `backend/ai/uncertainty.py` | Calculate aleatory, epistemic, fusion and composite uncertainty |
| 13 | Rule-based clinical NLP + negation; optional BioBERT | `backend/ai/biobert_engine.py` | Convert symptoms to risk, duration and urgency information |
| 14 | Demographic risk rules | `backend/ai/risk_engine.py` | Compute risk contribution from patient factors |
| 15 | **CMCA** | `backend/ai/decision_engine.py` | Combine image concern, symptom risk and demographic risk |
| 16 | **Grad-CAM** | `backend/ai/gradcam.py` | Explain image regions influencing the selected class |
| 17 | Otsu segmentation + ABCD features | `backend/ai/abcd_engine.py` | Produce additional lesion-context measurements |
| 18 | Knowledge-base recommendation rules | `backend/ai/recommendation_engine.py` | Generate recommendations, urgency and follow-up |
| 19 | SQLAlchemy + SQLite | `backend/core/database.py` | Persist the diagnosis and derived outputs |
| 20 | ReportLab | `backend/reports/report_generator.py` | Generate the clinical PDF report |
| 21 | Atomic DB update | `backend/features/routes.py` | Attach diagnoses safely to tracked lesions |
| 22 | Doctor review workflow | `backend/app.py`, `backend/features/routes.py` | Queue, claim and review cases |

## Complete End-to-End Flow

```text
Dermoscopic image + optional symptoms + patient profile
                         │
                         ▼
                1. File validation
                         ↓
                2. Quality checks
                         ↓
             3. Resize + normalization
                         ↓
                 4. TTA (8 views)
                         ↓
        ┌─────────────────────────────────┐
        │ 5. EfficientNet-B3              │
        │            ↓                    │
        │ 6. CBAM                        │
        │            ↓                    │
        │ 7. GeM                         │
        │            ↓                    │
        │ 8. LayerNorm/GELU/Dropout MLP  │
        │            ↓                    │
        │ 9. Mel-only logit adjustment   │
        │            ↓                    │
        │ 10. Softmax + TTA mean         │
        └───────────────┬─────────────────┘
                        │
                 Class + confidence
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
       11. MC Dropout        TTA distribution
              │                   │
              └─────────┬─────────┘
                        ▼
                    12. MCUE
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
      image concern   13. NLP     14. demographic
          mass         risk           risk
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                    15. CMCA
                        │
              Clinical-concern decision
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
      16. Grad-CAM  17. ABCD   18. Recommendation
           │            │            │
           └────────────┼────────────┘
                        ▼
                  19. Database
                    │        │
                    ▼        ▼
              20. PDF      21. Lesion tracking
                                  │
                                  ▼
                          22. Doctor review
```

## Training Algorithms

These methods are used to train the checkpoint that the deployed application loads.

| Algorithm | Training stage | What it does |
|---|---|---|
| **ACWF-FL** | Loss function | Effective-number class weighting + focal loss (`β=0.9999`, `γ=2.0`) with `1.5×` malignant-class loss amplification |
| **SAM** | Phase 2 | Sharpness-Aware Minimization |
| **SWA** | Phase 3 | Stochastic Weight Averaging |

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

ACWF-FL, SAM and SWA are **training-time methods**; they are not rerun during normal inference.

## Inference Algorithms

```text
TTA
 ↓
EfficientNet-B3
 ↓
CBAM
 ↓
GeM
 ↓
MLP Head
 ↓
Mel-only logit adjustment
 ↓
Softmax + TTA averaging
 ↓
MC Dropout
 ↓
MCUE
 ↓
Symptom NLP + Demographic Risk
 ↓
CMCA
 ↓
Grad-CAM + ABCD + Recommendation
```

## Steps 1–4: Input, Quality and TTA

Images are resized to **300×300** and normalized with:

```text
Mean = [0.485, 0.456, 0.406]
Std  = [0.229, 0.224, 0.225]
```

The default TTA views are:

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

Quality checking uses Laplacian variance for blur, grayscale mean brightness for exposure, and minimum image dimension for resolution. These checks create warnings and do not change the model prediction.

## Steps 5–8: Image Classifier

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

GeM is implemented as a learnable generalized mean:

```text
GeM(x) = ( mean(clamp(x, eps)^p) )^(1/p)
```

The seven classes are:

```text
akiec · bcc · bkl · df · mel · nv · vasc
```

## Steps 9–10: Logit Adjustment and Prediction

Current mel-only adjustment configuration:

```text
LOGIT_ADJUSTMENT_ENABLED = true
LOGIT_ADJUSTMENT_CLASS   = mel
LOGIT_ADJUSTMENT_TAU     = 0.3
MEL_LOG_PRIOR            = -2.1970
```

Only the `mel` logit is modified. Softmax probabilities from the TTA views are then averaged. The largest probability determines `predicted_class`; that probability is the `image confidence`.

## Steps 11–12: MC Dropout and MCUE

MC Dropout performs repeated stochastic passes with only explicit dropout layers in training mode while the rest of the model remains in evaluation mode.

```text
MC_DROPOUT_PASSES = 20
```

MCUE calculates:

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

Composite uncertainty:

```text
0.4 × aleatory
+ 0.4 × epistemic
+ 0.2 × fusion
```

The review threshold is the checkpoint's `mcue_threshold` when available; otherwise the configured fallback is `0.8054`.

## Step 13: Symptom NLP

The default live engine uses **rule-based clinical NLP**. The optional BioBERT transformer path exists in the module but is disabled in the current singleton.

```text
Symptom text
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

## Step 14: Demographic Risk

```text
Age risk
+ Fitzpatrick skin-type risk
+ Medical/family-history risk
+ Sun-exposure risk
        ↓
Demographic risk score [0,1]
```

The current implementation accepts gender but does not apply a separate gender weight.

## Step 15: CMCA

**CMCA = Cross-Modal Confidence Aggregation.**

The image probability distribution is summarized as:

```text
Malignancy mass
= P(bcc) + P(mel)

Clinical-concern mass
= P(akiec) + P(bcc) + P(mel)
```

CMCA then combines:

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

CMCA does **not** overwrite the image-model `predicted_class`; it adds the broader clinical-concern/review signal.

## Clinical Class Semantics

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

## Steps 16–17: Explainability

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

ABCD is a context/explainability layer. Its outputs are **not fed into the classifier**.

## Step 18: Recommendation Engine

```text
Predicted class
+ malignancy status
+ uncertainty/review state
+ symptom urgency
+ class knowledge
        ↓
Recommendation Engine
        ↓
Recommendations + urgency + follow-up
```

Class-specific knowledge is stored under `backend/knowledge/`.

## Steps 19–22: Storage and Clinical Workflow

The diagnosis record persists the prediction, confidence, uncertainty, symptom risk, demographic risk, class probabilities, modality weights, ABCD features and generated artifact paths.

```text
Diagnosis record
      ↓
ReportLab PDF report

Diagnosis record
      ↓
Tracked lesion
      ↓
Doctor queue
      ↓
Claim → Review → confirmed / revised / dismissed
```

Lesion assignment uses a conditional database update to avoid concurrent double-claiming of an unassigned diagnosis.

## Main Algorithm Files

```text
backend/
├── core/
│   ├── preprocessing.py       # preprocessing + TTA + quality checks
│   └── model.py               # EfficientNet-B3 + CBAM + GeM + MLP
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
├── reports/
│   └── report_generator.py
├── features/
│   └── routes.py
└── alembic/
```

## Run Locally

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

## Limitations

DERMAXAI is a student research/prototype screening and decision-support system. It is not a substitute for dermatologist assessment, clinical examination, or histopathological confirmation.
