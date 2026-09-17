# DERMAXAI v6
### Multimodal AI-Powered Healthcare Diagnostic Assistant

> Final Year BE Project — Dr. AIT, Bengaluru | Course: 22CSP605 | 2025–26  
> Guide: Dr. Suresha D, Assoc. Prof., CSE Programme

DERMAXAI is a **multimodal dermatology screening and clinical-review support system**. The core pipeline starts with a dermoscopic image, extracts an image-model prediction and uncertainty information, analyzes optional symptoms and demographic risk factors, combines the resulting signals using CMCA, generates explainability outputs, and stores the complete case for reporting and optional doctor review.

The most important design principle is that **each algorithm has a defined place in the pipeline**. Training algorithms are separated from inference algorithms, and explainability algorithms are not treated as classifier inputs.

---

## 1. Algorithm-to-Pipeline Mapping

The table below is the main technical map of DERMAXAI: **what algorithm is used, at which step, what it receives, and what it produces.**

| Pipeline step | Algorithm / method | Implementation | Input | Output |
|---|---|---|---|---|
| 1. Image intake | File validation + format verification | `backend/ai/predictor.py` | Uploaded image | Validated image payload |
| 2. Image quality | Laplacian variance, brightness and resolution checks | `backend/core/preprocessing.py` | RGB image | Quality score + warnings |
| 3. Preprocessing | Resize `300×300` + ImageNet normalization | `backend/core/preprocessing.py` | RGB image | Model-ready tensor |
| 4. Test-time augmentation | **TTA**: 8 deterministic full-image views | `backend/core/preprocessing.py` | Model-ready image | Multiple transformed tensors |
| 5. Feature extraction | **EfficientNet-B3** | `backend/core/model.py` | TTA tensors | Deep spatial feature maps |
| 6. Feature refinement | **CBAM** channel + spatial attention | `backend/core/model.py` | Feature maps | Attention-refined features |
| 7. Feature pooling | **GeM (Generalized Mean Pooling)** | `backend/core/model.py` | Refined feature maps | Global feature vector |
| 8. Classification | LayerNorm → Linear → GELU → Dropout MLP head | `backend/core/model.py` | Pooled feature vector | 7 class logits |
| 9. Calibration adjustment | Mel-only logit adjustment | `backend/ai/predictor.py` | 7 logits | Adjusted logits |
| 10. Primary prediction | Softmax + TTA probability averaging | `backend/ai/predictor.py` | Adjusted logits | Class probabilities + predicted class + image confidence |
| 11. Stochastic inference | **MC Dropout** | `backend/ai/predictor.py` | Image tensor | Multiple stochastic probability distributions |
| 12. Uncertainty | **MCUE** | `backend/ai/uncertainty.py` | TTA distribution + MC distributions | Aleatory, epistemic, fusion and composite uncertainty |
| 13. Symptom analysis | Rule-based clinical NLP + negation handling; optional BioBERT module | `backend/ai/biobert_engine.py` | Patient symptom text | Symptom risk + duration + urgency flag |
| 14. Demographic risk | Weighted risk rules using age, Fitzpatrick skin type, history and sun exposure | `backend/ai/risk_engine.py` | Patient/profile data | Demographic risk score + breakdown |
| 15. Multimodal fusion | **CMCA** (Cross-Modal Confidence Aggregation) | `backend/ai/decision_engine.py` | Image concern mass + symptom risk + demographic risk | Clinical-concern score and escalation signals |
| 16. Visual explanation | **Grad-CAM** | `backend/ai/gradcam.py` | Image + predicted class | Heatmap showing influential image regions |
| 17. Dermoscopic feature explanation | Otsu segmentation + ABCD feature extraction | `backend/ai/abcd_engine.py` | Image | Asymmetry, border irregularity, color variation, diameter |
| 18. Clinical guidance | Knowledge-base recommendation rules | `backend/ai/recommendation_engine.py` | Decision + uncertainty + symptoms | Recommendations, urgency and follow-up |
| 19. Persistence | SQLAlchemy + SQLite | `backend/core/database.py` | Complete case outputs | Diagnosis record |
| 20. Report generation | ReportLab | `backend/reports/report_generator.py` | Decision + uncertainty + recommendations + Grad-CAM | PDF report |
| 21. Longitudinal tracking | Lesion grouping + atomic diagnosis assignment | `backend/features/routes.py` | Existing diagnosis + lesion | Serial lesion history |
| 22. Clinical review | Doctor claim/review workflow | `backend/app.py` + `backend/features/routes.py` | Flagged/stored diagnosis | Doctor verdict and notes |

---

## 2. End-to-End Algorithmic Flow

```text
PATIENT IMAGE + OPTIONAL SYMPTOMS + OPTIONAL PROFILE DATA
                         │
                         ▼
                [1] INPUT VALIDATION
                         │
                         ▼
                [2] IMAGE QUALITY CHECK
                         │
                         ▼
                [3] RESIZE + NORMALIZE
                         │
                         ▼
              [4] TTA — 8 IMAGE VIEWS
                         │
                         ▼
          ┌──────────────────────────────┐
          │ [5] EfficientNet-B3          │
          │ [6] CBAM                     │
          │ [7] GeM pooling              │
          │ [8] LayerNorm/GELU/Dropout   │
          │     MLP classification head  │
          └──────────────┬───────────────┘
                         │
                         ▼
                [9] MEL LOGIT ADJUSTMENT
                         │
                         ▼
              [10] SOFTMAX + TTA AVERAGE
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
      PRIMARY PREDICTION       [11] MC DROPOUT
      class + confidence             │
              │                      ▼
              │                  [12] MCUE
              │                      │
              └──────────┬───────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   IMAGE CONCERN     [13] SYMPTOM    [14] DEMOGRAPHIC
       MASS             NLP              RISK
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                  [15] CMCA FUSION
                         │
                         ▼
              CLINICAL-CONCERN DECISION
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     [16] Grad-CAM   [17] ABCD      [18] RECOMMENDATION
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                [19] DATABASE RECORD
                         │
                ┌────────┴────────┐
                ▼                 ▼
         [20] PDF REPORT    [21] LESION TRACKING
                                   │
                                   ▼
                           [22] DOCTOR REVIEW
```

---

## 3. Training-Time Algorithms vs Inference-Time Algorithms

This distinction is important when describing DERMAXAI in a viva, paper, presentation, or documentation.

### Training-time methods

| Method | Where it is used | Purpose |
|---|---|---|
| **ACWF-FL** | Model training | Addresses class imbalance using effective-number weighting and focal loss; malignant classes receive additional `1.5×` loss amplification |
| **SAM** | Training phase 2 | Sharpness-Aware Minimization for optimization toward flatter solutions |
| **SWA** | Training phase 3 | Stochastic Weight Averaging over late training checkpoints |

These methods affect the **trained model weights**. They are not recalculated during normal API inference.

### Inference-time methods

| Method | Where it is used | Purpose |
|---|---|---|
| **TTA** | Before/around image prediction | Runs multiple deterministic transformed views and averages their class probabilities |
| **MC Dropout** | After primary model setup | Produces stochastic predictive samples |
| **MCUE** | Uncertainty stage | Quantifies predictive uncertainty and TTA/MC disagreement |
| **Clinical NLP** | Symptom stage | Converts free-text symptoms into a normalized risk contribution |
| **Demographic Risk Engine** | Profile stage | Converts patient risk factors into a normalized risk contribution |
| **CMCA** | Multimodal decision stage | Combines the three concern signals without changing the image-model class |
| **Grad-CAM** | Explainability stage | Shows image regions that influenced the selected class |
| **ABCD extraction** | Explainability stage | Computes additional dermoscopic measurements for context |

---

## 4. Step-by-Step Technical Details

### Step 1 — Input validation

Before AI inference, the backend verifies the uploaded image extension and then verifies the actual encoded image content. Supported extensions are:

```text
.jpg
.jpeg
.png
.bmp
```

The API accepts files up to **10 MB**. The stored runtime filename is generated from a UUID rather than trusting the original filename.

### Step 2 — Image quality checks

`validate_image_quality()` performs lightweight quality assessment using:

- **Laplacian variance** for blur detection (`< 100` is flagged as blurry);
- grayscale mean brightness (`< 40` too dark, `> 220` too bright); and
- minimum image dimension (`< 100 px` is flagged as low resolution).

These checks produce warnings. They do not modify the classifier's prediction.

### Step 3 — Preprocessing

Images are resized to:

```text
300 × 300
```

and normalized using:

```text
Mean = [0.485, 0.456, 0.406]
Std  = [0.229, 0.224, 0.225]
```

The same normalization convention is used by the inference preprocessing pipeline.

### Step 4 — TTA

DERMAXAI uses **full-image Test-Time Augmentation**, not spatial crops. The configured default is `8` views:

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

Each view is passed through the classifier and its probability vector is collected. The primary prediction uses the mean probability across the configured views.

### Step 5 — EfficientNet-B3

The backbone is:

```text
EfficientNet-B3
```

implemented through `timm` with feature extraction enabled. The live service loads the trained checkpoint rather than training the network during inference.

### Step 6 — CBAM

CBAM is applied to the final spatial feature map and contains two sequential attention operations:

```text
Feature map
    ↓
Channel Attention
    ↓
Spatial Attention
    ↓
Refined feature map
```

**Channel attention** uses global average pooling and global max pooling followed by a shared MLP and sigmoid gating.

**Spatial attention** uses channel-wise average and maximum projections, concatenates them, and applies a convolutional attention gate.

### Step 7 — GeM pooling

The refined feature map is converted into a feature vector using **Generalized Mean Pooling (GeM)**.

The implementation learns the pooling parameter `p` and uses:

```text
GeM(x) = ( mean(clamp(x, eps)^p) )^(1/p)
```

This replaces a simple global average pooling operation.

### Step 8 — Classification head

The pooled feature vector enters a three-stage normalized MLP:

```text
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

The seven output classes are:

```text
akiec · bcc · bkl · df · mel · nv · vasc
```

### Step 9 — Mel-only logit adjustment

Before softmax, DERMAXAI can apply a **surgical logit adjustment only to the `mel` class**.

Current configuration:

```text
LOGIT_ADJUSTMENT_ENABLED = true
LOGIT_ADJUSTMENT_CLASS   = mel
LOGIT_ADJUSTMENT_TAU     = 0.3
MEL_LOG_PRIOR            = -2.1970
```

The adjustment is applied to the mel logit only; other class logits are untouched.

### Step 10 — Primary image prediction

The adjusted logits are passed through softmax for each TTA view. The vectors are averaged and the maximum-probability class becomes:

```text
predicted_class
```

The probability of that class is returned as:

```text
image confidence
```

The image model remains the sole source of the class prediction.

### Step 11 — MC Dropout

A second stochastic inference path is used for uncertainty estimation.

The model is returned to evaluation mode, but only explicit dropout layers are switched to training mode. This preserves batch-normalization behavior while introducing stochasticity across repeated passes.

The default number of passes is:

```text
MC_DROPOUT_PASSES = 20
```

### Step 12 — MCUE uncertainty estimation

MCUE combines the deterministic TTA distribution with MC-dropout samples.

#### Aleatory uncertainty

The expected predictive entropy of the stochastic samples is used as the aleatory component.

For a probability vector `p`:

```text
H(p) = -Σ p_i log(p_i)
```

DERMAXAI normalizes entropy by `log(K)` where `K = 7` classes:

```text
normalized entropy = H(p) / log(7)
```

#### Epistemic uncertainty

The implementation uses the normalized mutual-information/BALD form:

```text
epistemic = H(mean(MC samples)) - mean(H(each MC sample))
```

The value is clipped to `[0, 1]`.

#### Fusion uncertainty

The difference between deterministic TTA inference and stochastic MC inference is measured using normalized **Jensen-Shannon divergence**.

#### Composite uncertainty

The current fixed composition is:

```text
composite =
    0.4 × aleatory
  + 0.4 × epistemic
  + 0.2 × fusion
```

The score is clipped to `[0, 1]`.

The review threshold comes from the checkpoint's `mcue_threshold` when present; otherwise the application uses:

```text
0.8054
```

Confidence labels are derived from the composite uncertainty:

```text
< 0.20  → Very High
< 0.40  → High
< 0.60  → Moderate
< 0.80  → Low
≥ 0.80  → Very Low
```

### Step 13 — Symptom NLP

The default live symptom engine is **lightweight rule-based NLP**. The optional BioBERT transformer path exists in the module but is not enabled by default.

The default engine detects clinical terms such as:

```text
bleeding, ulcer, rapid growth, irregular border,
color change, asymmetric, itching, pain, crusting,
oozing, new mole, darkening
```

Each matched keyword contributes a predefined weight, and the final symptom risk score is capped at `1.0`.

The implementation also includes:

- negation handling;
- duplicate keyword suppression;
- overlap suppression for phrases such as `painful` vs `pain`; and
- duration extraction using day/week/month/year patterns.

An urgency flag is raised when risk keywords are present and the onset is either unknown or approximately under `30` days.

### Step 14 — Demographic Risk Engine

The demographic risk score is built from four components:

```text
Age risk
+ Fitzpatrick skin-type risk
+ Medical/family-history risk
+ Sun-exposure risk
```

The final score is capped at `1.0`.

The current implementation uses rule-based weights. Examples include higher contributions for older age groups, fairer Fitzpatrick skin types, relevant skin-cancer history, blistering sunburn, tanning-bed exposure, and similar recorded risk factors.

The `gender` field is accepted by the API, but the current `RiskEngine` does not apply a separate gender weight.

### Step 15 — CMCA multimodal fusion

**CMCA (Cross-Modal Confidence Aggregation)** is the main multimodal reasoning step.

Three signals are used:

```text
1. Image clinical-concern probability mass
2. Symptom risk score
3. Demographic risk score
```

The class probabilities are grouped into two related but separate concepts:

```text
Malignancy mass = P(bcc) + P(mel)

Clinical-concern mass =
    P(akiec) + P(bcc) + P(mel)
```

The modality weights are evidence-adaptive:

```text
image weight        = 0.25 + 0.75 × image confidence
symptom weight      = 0.25 + 0.75 × symptom risk

demographic weight  = 0.25 + 0.75 × demographic risk
```

The CMCA score is the weighted average of the three normalized concern signals.

**Important:** CMCA produces a **clinical-concern score**, not a calibrated probability of malignancy, and it does not overwrite the image-model class prediction.

Current escalation rules include:

```text
CMCA concern threshold          = 0.30
Malignancy-mass escalation      = 0.30
Malignant low-confidence floor  = 0.70
```

A case can therefore require clinical review even when the image model's predicted class itself is not malignant.

### Step 16 — Grad-CAM

Grad-CAM is generated specifically for the selected image class.

The implementation targets the final spatial block of the EfficientNet-B3 backbone and uses forward and backward hooks to obtain:

```text
activations + gradients
```

The Grad-CAM weighting is based on the mean gradient per feature channel, followed by weighted activation aggregation and ReLU.

The output is rendered as a heatmap overlay so the user or doctor can see which regions contributed to the selected prediction.

### Step 17 — ABCD feature extraction

The ABCD module is an **explainability/context layer**, not another classifier.

The implementation performs:

```text
Otsu thresholding
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

The features are computed as follows:

- **Asymmetry:** average mirror difference between horizontal and vertical flips of the lesion mask.
- **Border irregularity:** `1 - compactness`, where compactness is based on `4πA / P²`.
- **Color variation:** normalized mean channel standard deviation inside the lesion.
- **Diameter:** diameter of the contour's minimum enclosing circle.

These values are stored and displayed for context. **They are never fed back into the classifier.**

### Step 18 — Recommendation engine

Recommendations are generated from the predicted class and the current decision state. The engine loads per-class information from:

```text
backend/knowledge/<class>.json
```

It then adds dynamic guidance based on:

- review requirement;
- malignant status;
- symptom urgency.

The resulting output includes:

```text
class description
recommendation list
urgency level
suggested follow-up window
```

### Step 19 — Diagnosis persistence

The diagnosis record stores the model and multimodal outputs needed for later history, review and reporting, including:

```text
predicted class
image confidence
malignancy signal
review requirement
urgency escalation
uncertainty components
symptom risk

demographic risk
class probabilities
modality weights
ABCD features
Grad-CAM path
PDF report path
```

### Step 20 — PDF report

ReportLab is used to create the clinical report.

The report contains the predicted class, image confidence, malignancy mass, clinical-concern mass, uncertainty measures, modality contributions, class probability distribution, Grad-CAM explanation, recommendations, and a medical-use disclaimer.

The report uses three presentation categories:

```text
MALIGNANT
CLINICAL CONCERN
NON-MALIGNANT
```

The presentation category is intentionally kept separate from the raw model class and from the uncertainty score.

### Step 21 — Lesion tracking

Patients can create a named lesion and attach previous diagnoses to it.

The diagnosis-to-lesion claim uses a conditional database update so that two concurrent requests cannot both successfully claim the same unassigned diagnosis for different lesions.

This supports longitudinal tracking of the same lesion across multiple evaluations.

### Step 22 — Doctor review

Doctors can:

```text
View queue
   ↓
Claim diagnosis
   ↓
Review case
   ↓
Submit verdict
```

Supported verdicts are:

```text
confirmed
revised
dismissed
```

Only the doctor who claimed a case can submit its review.

---

## 5. Clinical Class Semantics

The model has seven image classes:

| Code | Full name in application | Malignant group | Clinical-concern group |
|---|---|---:|---:|
| `akiec` | Actinic Keratoses / Intraepithelial Carcinoma | No | Yes |
| `bcc` | Basal Cell Carcinoma | Yes | Yes |
| `bkl` | Benign Keratosis | No | No |
| `df` | Dermatofibroma | No | No |
| `mel` | Melanoma | Yes | Yes |
| `nv` | Melanocytic Nevi | No | No |
| `vasc` | Vascular Lesions | No | No |

Current configuration:

```python
MALIGNANT_CLASSES = ['bcc', 'mel']
CLINICAL_CONCERN_CLASSES = ['akiec', 'bcc', 'mel']
```

Therefore:

```text
predicted_class
    = image-model class prediction

is_malignant
    = predicted_class ∈ {bcc, mel}

clinical_concern
    = predicted_class ∈ {akiec, bcc, mel}
      OR CMCA/review escalation
```

This prevents multimodal concern evidence from silently relabeling a non-malignant image prediction as malignant.

---

## 6. Training Methodology

The training pipeline documented for DERMAXAI-NOVA uses the following sequence:

```text
ISIC 2018 / HAM10000
        │
        ▼
EfficientNet-B3 backbone
        │
        ▼
CBAM attention
        │
        ▼
GeM pooling
        │
        ▼
LayerNorm/GELU/Dropout MLP head
        │
        ▼
ACWF-FL loss
        │
        ▼
Phase 1 training
        │
        ▼
Phase 2: SAM optimization
        │
        ▼
Phase 3: SWA averaging
        │
        ▼
Trained checkpoint
        │
        ▼
Production inference with TTA + MCUE
```

The dataset classes are:

```text
akiec, bcc, bkl, df, mel, nv, vasc
```

The loss methodology is documented with:

```text
β = 0.9999
γ = 2.0
malignant-loss amplification = 1.5×
```

The deployed service does not retrain the network; it loads the trained checkpoint and executes the inference pipeline described above.

---

## 7. Project Structure — Algorithm Files

```text
DERMAXAI/
├── backend/
│   ├── app.py
│   ├── core/
│   │   ├── config.py
│   │   ├── preprocessing.py      # resize, normalize, TTA, quality checks
│   │   ├── model.py              # EfficientNet-B3, CBAM, GeM, MLP
│   │   ├── database.py
│   │   └── auth.py
│   │
│   ├── ai/
│   │   ├── predictor.py          # image inference, TTA, MC Dropout
│   │   ├── uncertainty.py        # MCUE
│   │   ├── decision_engine.py    # CMCA
│   │   ├── biobert_engine.py     # symptom NLP / optional BioBERT
│   │   ├── text_negation.py      # negation handling
│   │   ├── risk_engine.py        # demographic risk
│   │   ├── gradcam.py             # Grad-CAM
│   │   ├── abcd_engine.py         # ABCD explainability
│   │   └── recommendation_engine.py
│   │
│   ├── reports/
│   │   └── report_generator.py
│   │
│   ├── features/
│   │   └── routes.py             # lesions, analytics, assignment
│   │
│   ├── knowledge/                # class-specific recommendation data
│   ├── models/                    # trained best.pth checkpoint
│   └── alembic/                   # schema migrations
│
├── frontend/                     # React + Vite + TailwindCSS
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 8. Technology Stack

| Layer | Technology |
|---|---|
| Image model | EfficientNet-B3 |
| Attention | CBAM |
| Pooling | GeM |
| Classification head | LayerNorm + Linear + GELU + Dropout MLP |
| Training loss | ACWF-FL |
| Training optimizer | SAM + AdamW |
| Weight averaging | SWA |
| Inference augmentation | TTA |
| Uncertainty | MC Dropout + MCUE |
| Symptom processing | Rule-based NLP; optional BioBERT module |
| Multimodal fusion | CMCA |
| Explainability | Grad-CAM + ABCD features |
| Backend | FastAPI + SQLAlchemy |
| Database | SQLite |
| Authentication | JWT |
| Reports | ReportLab |
| Frontend | React + Vite + TailwindCSS |
| Deployment | Docker Compose + Nginx |
| CI | GitHub Actions |

---

## 9. Quick Start

### Docker

```bash
git clone https://github.com/tejaswaroop41/DERMAXAI.git
cd DERMAXAI

# Place the trained checkpoint here:
# backend/models/best.pth

cp .env.example .env
# Set SECRET_KEY in .env

docker compose up --build
```

Services:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
Docs:     http://localhost:8000/docs   (when DEBUG=true)
```

The Docker backend starts with the Alembic migration step before Uvicorn. This keeps the production schema under migration control.

### Local backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
alembic upgrade head
uvicorn app:app --reload --port 8000
```

### Local frontend

```powershell
cd frontend
npm install
npm run dev
```

---

## 10. Database Migrations

The current migration chain is:

```text
0001_initial_schema
        ↓
0002_lesion_tracking
        ↓
0003_token_version
```

The application schema includes users, patients, diagnoses, doctor reviews, and lesions.

For an existing local SQLite database created before the migration history was established, inspect the schema before stamping it. For example:

```powershell
python -c "from sqlalchemy import inspect; from core.database import engine; i=inspect(engine); print(i.get_table_names()); print([c['name'] for c in i.get_columns('users')])"
```

Do not blindly run `alembic upgrade head` against an old manually-created database that already contains tables but has an empty `alembic_version` table. Establish the correct baseline first, then apply only the missing revisions.

---

## 11. Configuration Relevant to the Algorithms

Important settings in `backend/core/config.py` include:

```text
MODEL_NAME = efficientnet_b3
IMG_SIZE = 300
DROPOUT = 0.3
NUM_CLASSES = 7

TTA_VIEWS = 8
MC_DROPOUT_PASSES = 20
UNCERTAINTY_THETA = 0.8054

LOGIT_ADJUSTMENT_ENABLED = true
LOGIT_ADJUSTMENT_CLASS = mel
LOGIT_ADJUSTMENT_TAU = 0.3
MEL_LOG_PRIOR = -2.1970

MALIGNANT_CLASSES = [bcc, mel]
CLINICAL_CONCERN_CLASSES = [akiec, bcc, mel]
```

The runtime also validates checkpoint class ordering when `class_names` are present in the checkpoint.

---

## 12. Important Implementation Boundaries

### What changes the class prediction?

```text
EfficientNet-B3
      + CBAM
      + GeM
      + MLP head
      + mel-only logit adjustment
      + TTA probability averaging
```

### What measures uncertainty?

```text
MC Dropout
      + TTA distribution
      + entropy
      + mutual information
      + Jensen-Shannon divergence
      → MCUE
```

### What contributes to clinical concern?

```text
Image clinical-concern mass
      + symptom risk
      + demographic risk
      → CMCA
```

### What explains the prediction?

```text
Grad-CAM
ABCD feature extraction
```

ABCD features are **not classifier inputs**.

### What recommends next steps?

```text
Predicted class
+ malignancy status
+ uncertainty/review state
+ symptom urgency
+ knowledge-base content
→ Recommendation Engine
```

---

## 13. Scope and Limitations

DERMAXAI is a **student research/prototype system for preliminary screening and clinical-review support**. It is not a replacement for a dermatologist or for histopathological confirmation.

Important limitations include:

- class predictions depend on the trained checkpoint and dataset characteristics;
- uncertainty scores are model uncertainty indicators, not guarantees of clinical safety;
- CMCA is a clinical-concern aggregation score, not a calibrated malignancy probability;
- demographic and symptom scores are rule-based contributions rather than independently validated clinical risk calculators;
- ABCD measurements are image-derived context and are not physical measurements unless an appropriate scale is available; and
- the system should not be interpreted as providing a definitive medical diagnosis.

---

## 14. Project Identity

**DERMAXAI v6**  
Multimodal AI-Powered Healthcare Diagnostic Assistant  
Dr. Ambedkar Institute of Technology, Bengaluru  
B.E./B.Tech CSE Final Year Project

For the research methodology, the associated training work is documented as:

**DERMAXAI-NOVA: A Clinically Grounded, Uncertainty-Aware Deep Learning Framework for Skin Lesion Triage**
