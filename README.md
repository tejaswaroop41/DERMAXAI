# DERMAXAI v6
### Multimodal AI-Powered Healthcare Diagnostic Assistant

> Final Year BE Project — Dr. AIT, Bengaluru | Course: 22CSP605 | 2025–26
> Guide: Dr. Suresha D, Assoc. Prof., CSE Programme

---

## Architecture Overview

```
Dermoscopic Image
       │
       ▼
┌─────────────────────────────────────┐
│  EfficientNet-B3 Backbone           │
│  + LayerNorm MLP Head               │
│  + ACWF-FL Loss (Training)          │
│  + SAM Optimizer (Phase 2)          │
│  + SWA (Phase 3)                    │
│  + TTA augmentation ensemble        │
└────────────────┬────────────────────┘
                 │ Image Prediction + Confidence
                 ▼
┌────────────────────────────────────────────────────────┐
│                CMCA Fusion Engine                       │
│  Confidence-weighted clinical-concern aggregation       │
│                                                        │
│  Image malignancy mass ──┐                            │
│  Symptom risk ───────────┼──► Clinical concern score   │
│  Demographic risk ───────┘                            │
│                                                        │
│  Classification label remains image-model-derived       │
└────────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  Outputs                                               │
│  • Predicted class + image confidence                  │
│  • CMCA clinical concern score                          │
│  • MCUE uncertainty score (θ_H deferral)               │
│  • Grad-CAM heatmap (XAI)                              │
│  • Clinical recommendations (knowledge base)           │
│  • PDF clinical report (ReportLab)                     │
└────────────────────────────────────────────────────────┘
```

## Novel Algorithms

| Algorithm | Description |
|-----------|-------------|
| **ACWF-FL** | Adaptive Class Weight Function + Focal Loss. Effective-number weighting + 1.5× malignancy amplification + focal γ=2.0 |
| **CMCA**    | Cross-Modal Confidence Aggregation. Confidence-weighted aggregation of image malignancy mass, symptom risk, and demographic risk into a separate clinical-concern score; it does not relabel the image class. |
| **MCUE**    | Monte Carlo Uncertainty Estimation. Aleatory uncertainty from expected MC entropy + epistemic uncertainty from mutual information + TTA/MC disagreement. |
| **SAM**     | Sharpness-Aware Minimization. Finds flat minima → better generalization |
| **SWA**     | Stochastic Weight Averaging. Averages weights over final epochs for stable, calibrated predictions |
| **TTA**     | Augmentation ensemble at inference time |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| ML Model | EfficientNet-B3 + LayerNorm MLP Head |
| Loss | ACWF-FL (β=0.9999, γ=2.0) |
| Optimizer | SAM + AdamW + SWA |
| Dataset | ISIC 2018 (10,015 images, 7 classes) |
| Backend | FastAPI + SQLAlchemy + JWT |
| XAI | Grad-CAM |
| Reports | ReportLab PDF |
| Frontend | React 18 + Vite + TailwindCSS |
| Runtime | Docker Compose |

## Project Structure

```
DERMAXAI/
├── backend/
│   ├── app.py                    ← FastAPI main app (full pipeline)
│   ├── core/
│   │   ├── config.py             ← Centralized settings
│   │   ├── preprocessing.py      ← TTA transforms + image validation
│   │   ├── model.py              ← DERMAXAI classifier architecture
│   │   ├── database.py           ← SQLAlchemy models
│   │   └── auth.py               ← JWT auth + bcrypt
│   ├── ai/
│   │   ├── predictor.py          ← TTA inference engine
│   │   ├── uncertainty.py        ← MCUE (aleatory+epistemic+disagreement)
│   │   ├── gradcam.py            ← Grad-CAM heatmap generation
│   │   ├── biobert_engine.py     ← Symptom NLP (rule-based + optional BioBERT)
│   │   ├── risk_engine.py        ← Demographic risk scoring
│   │   ├── decision_engine.py    ← CMCA clinical-concern fusion
│   │   └── recommendation_engine.py ← Clinical recommendations
│   ├── knowledge/                ← Per-class clinical JSON files
│   ├── reports/                  ← PDF report generator
│   ├── utils/                    ← Logging + validation helpers
│   ├── models/                   ← Place best.pth here
│   ├── uploads/                  ← Uploaded images
│   ├── heatmaps/                 ← Generated Grad-CAM images
│   ├── generated_reports/        ← Generated PDF reports
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── Dockerfile               ← Static frontend image
│   ├── nginx.conf.template      ← SPA + /api reverse proxy
│   └── src/
├── docker-compose.yml           ← Local Docker Compose stack
├── .env.example                 ← Local Docker environment template
└── README.md
```

## Quick Start (Local Docker)

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/dermaxai.git
cd dermaxai

# 2. Copy trained model weights from Colab
cp /path/to/best.pth backend/models/best.pth

# 3. Create local environment file
cp .env.example .env
# set a non-default SECRET_KEY for local development

# 4. Run the Docker stack
docker compose up --build
```

App: http://localhost:5173  
API: http://localhost:8000  
Docs: http://localhost:8000/docs when `DEBUG=true`

## Docker Notes

- `backend` runs FastAPI/Uvicorn on port `8000`.
- `frontend` builds the Vite app and serves it from Nginx on port `5173`.
- Nginx proxies `/api/*` requests to the backend service.
- SQLite, uploads, Grad-CAM heatmaps, and generated reports are stored in the persistent Docker `backend_data` volume.
- The project is intended to be run and demonstrated locally with Docker Compose; no cloud deployment configuration is required.
