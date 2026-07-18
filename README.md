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
│  EfficientNetV2-S Backbone          │
│  + SE (Squeeze-Excitation)          │
│  + CBAM (Channel + Spatial Attn)    │
│  + ACWF-FL Loss (Training)          │
│  + SAM Optimizer (Phase 2)          │
│  + SWA (Phase 3)                    │
│  + 8-Crop TTA (Inference)           │
└────────────────┬────────────────────┘
                 │ Image Prediction + Confidence
                 ▼
┌────────────────────────────────────────────────────────┐
│                CMCA Fusion Engine                       │
│  w_m = c_m / Σc_k  (confidence-weighted)               │
│                                                        │
│  Image Modality ──────┐                               │
│  Symptom NLP ─────────┼──► Fused Decision              │
│  Demographic Risk ────┘     + MCUE Uncertainty         │
└────────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  Outputs                                               │
│  • Predicted class + fused confidence                  │
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
| **CMCA**    | Cross-Modal Confidence Aggregation. Dynamic per-prediction confidence-weighted fusion of image, NLP, and demographic modalities |
| **MCUE**    | Multimodal Calibrated Uncertainty Estimation. Aleatory (entropy) + epistemic (MC-Dropout) + fusion disagreement |
| **SAM**     | Sharpness-Aware Minimization. Finds flat minima → better generalization |
| **SWA**     | Stochastic Weight Averaging. Averages weights over final epochs for stable, calibrated predictions |
| **TTA**     | 8-crop Test-Time Augmentation ensemble at inference |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| ML Model | EfficientNetV2-S + SE + CBAM |
| Loss | ACWF-FL (β=0.9999, γ=2.0) |
| Optimizer | SAM + AdamW + SWA |
| Dataset | ISIC 2018 (10,015 images, 7 classes) |
| Backend | FastAPI + SQLAlchemy + JWT |
| XAI | Grad-CAM (CBAM hook) |
| Reports | ReportLab PDF |
| Frontend | React 18 + Vite + TailwindCSS |
| Deployment | Railway.app / Docker |

## Project Structure

```
DERMAXAI/
├── backend/
│   ├── app.py                    ← FastAPI main app (full pipeline)
│   ├── core/
│   │   ├── config.py             ← Centralized settings
│   │   ├── preprocessing.py      ← TTA transforms + image validation
│   │   ├── model.py              ← DERMAXAIv6 architecture (SE+CBAM)
│   │   ├── database.py           ← SQLAlchemy models
│   │   └── auth.py               ← JWT auth + bcrypt
│   ├── ai/
│   │   ├── predictor.py          ← 8-crop TTA inference engine
│   │   ├── uncertainty.py        ← MCUE (aleatory+epistemic+fusion)
│   │   ├── gradcam.py            ← Grad-CAM heatmap generation
│   │   ├── biobert_engine.py     ← Symptom NLP (rule-based + BioBERT)
│   │   ├── risk_engine.py        ← Demographic risk scoring
│   │   ├── decision_engine.py    ← CMCA multimodal fusion
│   │   └── recommendation_engine.py ← Clinical recommendations
│   ├── knowledge/                ← Per-class clinical JSON files
│   │   ├── mel.json, bcc.json, akiec.json
│   │   ├── bkl.json, nv.json, df.json, vasc.json
│   ├── reports/
│   │   └── report_generator.py   ← ReportLab PDF with Grad-CAM
│   ├── utils/
│   │   ├── logger.py
│   │   └── validators.py
│   ├── models/                   ← Place best.pth here
│   ├── uploads/                  ← Uploaded images
│   ├── heatmaps/                 ← Generated Grad-CAM images
│   ├── generated_reports/        ← Generated PDF reports
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── Dockerfile               ← Production static frontend image
│   ├── nginx.conf               ← SPA + /api reverse proxy config
│   └── src/
│       ├── pages/                ← Landing, Login, Register, Dashboard,
│       │                            Diagnose, History, Profile, Admin
│       ├── components/layout/    ← Glassmorphism sidebar
│       └── lib/api.js            ← Axios API client
├── docker-compose.yml           ← Docker Compose stack
├── .env.example                 ← Docker/local environment template
├── railway.toml
└── README.md
```

## Quick Start (Local)

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/dermaxai.git
cd dermaxai

# 2. Copy trained model weights from Colab
cp /path/to/best.pth backend/models/best.pth

# 3. Create local environment file
cp .env.example .env
# edit SECRET_KEY if this is not just a local demo

# 4. Keep the trained weights at backend/models/best.pth
# Docker Compose mounts backend/models read-only at /data/models.

# 5. Run the production-style Docker stack
docker compose up --build

# App  → http://localhost:5173
# API  → http://localhost:8000
# Docs → http://localhost:8000/docs
```

## Docker Notes

The default Docker Compose stack is production-style:

- `backend` runs FastAPI/Uvicorn on port `8000`.
- `frontend` builds the Vite app into static files and serves them from Nginx on port `5173`.
- Nginx proxies `/api/*` requests to the backend service, so the frontend can use `VITE_API_URL=/api`.
- Persistent backend runtime data is stored in the `backend_data` Docker volume under `/data`.
- Local model weights are mounted read-only from `backend/models` to `/data/models`.

Important runtime paths can be configured from `.env`:

| Variable | Default in Docker | Purpose |
|----------|-------------------|---------|
| `MODEL_PATH` | `/data/models/best.pth` | Trained PyTorch checkpoint mounted from `backend/models/best.pth` |
| `DATABASE_URL` | `sqlite:////data/dermaxai.db` | Database connection string |
| `UPLOADS_DIR` | `/data/uploads` | Uploaded diagnosis images |
| `HEATMAPS_DIR` | `/data/heatmaps` | Generated Grad-CAM images |
| `REPORTS_DIR` | `/data/generated_reports` | Generated PDFs |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8000` | Allowed browser origins |

## Manual Setup (without Docker)

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Optional: use variables from ../.env or export them in your shell
uvicorn app:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Deploy to Railway

1. Push to GitHub
2. New project on railway.app → Deploy from GitHub repo
3. Set environment variables:
   - `SECRET_KEY` — strong random string
   - `MODEL_PATH` — `models/best.pth`
4. Upload `best.pth` as a Railway volume or use a CDN URL

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Model status + algorithm list |
| POST | /api/auth/register | Create user + patient profile |
| POST | /api/auth/login | Get JWT token |
| GET | /api/auth/me | Current user info |
| POST | /api/diagnose | **Full pipeline** — TTA → NLP → Risk → MCUE → CMCA → Grad-CAM → PDF |
| GET | /api/diagnose/history | User's diagnosis history |
| GET | /api/diagnose/{id}/gradcam | Grad-CAM heatmap image |
| GET | /api/reports/{id} | Download PDF report |
| GET/PUT | /api/patients/profile | Patient profile |
| GET | /api/admin/stats | Admin overview |
| GET | /api/admin/users | User list |

## Team

| Name | USN |
|------|-----|
| Eddula Tejaswaroop | 1DA23CS057 |
| Himanshu Mankotia | 1DA23CS066 |
| Hrishita Nandan Gowda | 1DA23CS067 |
| Jyothi S | 1DA23CS071 |

**Guide:** Dr. Suresha D, Assoc. Prof., CSE Programme, Dr. AIT, Bengaluru
