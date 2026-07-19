"""
DERMAXAI v6 — Main Application Entry Point
Wires together all AI engines (predictor, uncertainty, decision,
recommendation, Grad-CAM) into a single diagnostic pipeline,
exposed via FastAPI REST endpoints.
"""
import os
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

import torch
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from core.config import settings
from core.database import create_tables, get_db, User, Patient, Diagnosis
from core.auth import (hash_password, verify_password, create_token,
                        get_current_user, require_admin)
from core.model import load_model

from ai.predictor import predictor
from ai.uncertainty import UncertaintyEngine
from ai.gradcam import GradCAMEngine
from ai.biobert_engine import biobert_engine
from ai.risk_engine import risk_engine
from ai.decision_engine import decision_engine
from ai.recommendation_engine import recommendation_engine

from reports.report_generator import generate_report
from utils.logger import get_logger
from utils.validators import (validate_image_extension, validate_image_size,
                               sanitize_filename)

logger = get_logger("dermaxai")

uncertainty_engine: Optional[UncertaintyEngine] = None
gradcam_engine: Optional[GradCAMEngine] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    predictor.load()

    global uncertainty_engine, gradcam_engine
    uncertainty_engine = UncertaintyEngine(predictor.model, predictor.device,
                                            mc_passes=settings.MC_DROPOUT_PASSES)
    gradcam_engine = GradCAMEngine(predictor.model, predictor.device)

    logger.info(f"DERMAXAI v6 ready. Device={predictor.device}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Multimodal AI-Powered Healthcare Diagnostic Assistant",
    version=settings.APP_VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ════════════════════════════════════════════════════════════
# Pydantic schemas
# ════════════════════════════════════════════════════════════
class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    role: str = "patient"
    age: Optional[int] = None
    gender: Optional[str] = None
    skin_type: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class PatientUpdate(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None
    skin_type: Optional[str] = None
    medical_history: Optional[str] = None
    sun_exposure: Optional[str] = None


# ════════════════════════════════════════════════════════════
# Health + root
# ════════════════════════════════════════════════════════════
@app.get("/")
async def root():
    return {"message": settings.APP_NAME, "status": "running",
            "version": settings.APP_VERSION}


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "model": "EfficientNet-B3",
        "dataset": "ISIC 2018",
        "device": str(predictor.device),
        "model_loaded": predictor.loaded,
        "algorithms": [
            "TTA",
            "MCUE",
            "CMCA",
            "Grad-CAM",
            "BioBERT",
            "Demographic Risk Engine"
        ],
    }


# ════════════════════════════════════════════════════════════
# Auth endpoints
# ════════════════════════════════════════════════════════════
@app.post("/api/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=req.email, name=req.name,
                hashed_password=hash_password(req.password), role=req.role)
    db.add(user); db.commit(); db.refresh(user)

    patient = Patient(user_id=user.id, age=req.age,
                       gender=req.gender, skin_type=req.skin_type)
    db.add(patient); db.commit()

    token = create_token({"sub": user.id, "role": user.role})
    return {"access_token": token, "token_type": "bearer",
            "user": {"id": user.id, "name": user.name,
                     "email": user.email, "role": user.role}}


@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": user.id, "role": user.role})
    return {"access_token": token, "token_type": "bearer",
            "user": {"id": user.id, "name": user.name,
                     "email": user.email, "role": user.role}}


@app.get("/api/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name,
            "email": current_user.email, "role": current_user.role}


# ════════════════════════════════════════════════════════════
# Core diagnostic pipeline
# ════════════════════════════════════════════════════════════
@app.post("/api/diagnose")
async def diagnose(
    image: UploadFile = File(...),
    symptoms: str = Form(default=""),
    age: Optional[int] = Form(default=None),
    gender: str = Form(default=""),
    skin_type: str = Form(default=""),
    sun_exposure: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ── Validate + save upload ────────────────────────────
    if not validate_image_extension(image.filename):
        raise HTTPException(status_code=400, detail="Unsupported image format")
    file_bytes = await image.read()
    if not validate_image_size(file_bytes):
        raise HTTPException(status_code=400, detail="Image exceeds 10MB limit")

    safe_name = sanitize_filename(image.filename)
    ext       = safe_name.split(".")[-1]
    img_id    = str(uuid.uuid4())
    img_path  = os.path.join(settings.UPLOADS_DIR, f"{img_id}.{ext}")
    with open(img_path, "wb") as f:
        f.write(file_bytes)

    logger.info(f"Diagnosis request: user={current_user.id} image={img_path}")

    # ── 1. Image modality — TTA prediction ────────────────
    image_result = predictor.predict(img_path)

    # ── 2. Symptom modality — BioBERT/rule-based NLP ──────
    symptom_risk = biobert_engine.compute_symptom_risk(symptoms)

    # ── 3. Demographic modality — Risk engine ─────────────
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    demographic_risk = risk_engine.assess(
        age=age or (patient.age if patient else None),
        gender=gender or (patient.gender if patient else None),
        skin_type=skin_type or (patient.skin_type if patient else None),
        medical_history=patient.medical_history if patient else None,
        sun_exposure=sun_exposure or (patient.sun_exposure if patient else None),
    )


    # ── 4. MCUE — uncertainty estimation ──────────────────
    # Runs calibrated MC-Dropout uncertainty using the checkpoint's
    # saved entropy threshold (mcue_threshold).
    uncertainty = uncertainty_engine.composite_uncertainty(
        image_path=img_path
    )

    # ── 5. CMCA — cross-modal fusion decision ─────────────
    decision = decision_engine.fuse(
        image_result=image_result,
        symptom_risk=symptom_risk,
        demographic_risk=demographic_risk,
        uncertainty=uncertainty,
    )

    # ── 6. Grad-CAM explainability ─────────────────────────
    gradcam_path = os.path.join(settings.HEATMAPS_DIR, f"gradcam_{img_id}.jpg")
    try:
        class_idx = settings.CLASSES.index(decision["predicted_class"])
        gradcam_engine.generate(img_path, class_idx, gradcam_path)
    except Exception as e:
        logger.warning(f"Grad-CAM generation failed: {e}")
        gradcam_path = None

    # ── 7. Recommendation engine ──────────────────────────
    recommendation = recommendation_engine.generate(
        decision=decision, uncertainty=uncertainty, symptom_risk=symptom_risk)

    # ── 8. Persist to database ─────────────────────────────
    diag = Diagnosis(
        user_id=current_user.id,
        patient_id=patient.id if patient else None,
        image_path=img_path,
        symptoms=symptoms,
        predicted_class=decision["predicted_class"],
        fused_confidence=decision["fused_confidence"],
        image_confidence=decision["image_confidence"],
        is_malignant=decision["is_malignant"],
        requires_review=decision["requires_review"],
        urgency_escalated=decision["urgency_escalated"],
        aleatory_uncertainty=uncertainty["aleatory_uncertainty"],
        epistemic_uncertainty=uncertainty["epistemic_uncertainty"],
        fusion_uncertainty=uncertainty["fusion_uncertainty"],
        composite_uncertainty=uncertainty["composite_uncertainty"],
        symptom_risk_score=symptom_risk["symptom_risk_score"],
        demographic_risk_score=demographic_risk["demographic_risk_score"],
        gradcam_path=gradcam_path,
        class_probs=json.dumps(decision["class_probabilities"]),
        modality_weights=json.dumps(decision["modality_weights"]),
    )
    db.add(diag); db.commit(); db.refresh(diag)

    # ── 9. PDF report generation ───────────────────────────
    report_path = os.path.join(settings.REPORTS_DIR, f"report_{diag.id}.pdf")
    try:
        patient_data = {
            "name": current_user.name,
            "age": age or (patient.age if patient else "N/A"),
            "gender": gender or (patient.gender if patient else "N/A"),
            "skin_type": skin_type or (patient.skin_type if patient else "N/A"),
            "diagnosis_id": diag.id,
        }
        generate_report(decision, uncertainty, recommendation,
                         patient_data, gradcam_path, report_path)
        diag.report_path = report_path
        db.commit()
    except Exception as e:
        logger.warning(f"PDF generation failed: {e}")

    return {
        "diagnosis_id": diag.id,
        "decision": decision,
        "uncertainty": uncertainty,
        "symptom_analysis": symptom_risk,
        "demographic_risk": demographic_risk,
        "recommendation": recommendation,
        "image_quality": image_result["image_quality"],
        "gradcam_url": f"/api/diagnose/{diag.id}/gradcam" if gradcam_path else None,
        "report_url": f"/api/reports/{diag.id}" if diag.report_path else None,
    }


@app.get("/api/diagnose/history")
def get_history(db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    diags = db.query(Diagnosis).filter(
        Diagnosis.user_id == current_user.id
    ).order_by(Diagnosis.created_at.desc()).limit(50).all()
    return [{
        "id": d.id,
        "predicted_class": d.predicted_class,
        "class_name": settings.CLASS_FULL_NAMES.get(d.predicted_class, d.predicted_class),
        "fused_confidence": d.fused_confidence,
        "composite_uncertainty": d.composite_uncertainty,
        "is_malignant": d.is_malignant,
        "requires_review": d.requires_review,
        "created_at": d.created_at,
        "report_url": f"/api/reports/{d.id}" if d.report_path else None,
    } for d in diags]


@app.get("/api/diagnose/{diagnosis_id:int}/gradcam")
def get_gradcam(diagnosis_id: int, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    diag = db.query(Diagnosis).filter(
        Diagnosis.id == diagnosis_id,
        Diagnosis.user_id == current_user.id,
    ).first()
    if not diag or not diag.gradcam_path or not os.path.exists(diag.gradcam_path):
        raise HTTPException(status_code=404, detail="Grad-CAM not found")
    return FileResponse(diag.gradcam_path, media_type="image/jpeg")


# ════════════════════════════════════════════════════════════
# Reports
# ════════════════════════════════════════════════════════════
@app.get("/api/reports/{diagnosis_id}")
def download_report(diagnosis_id: int, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    diag = db.query(Diagnosis).filter(Diagnosis.id == diagnosis_id,
                                       Diagnosis.user_id == current_user.id).first()
    if not diag or not diag.report_path or not os.path.exists(diag.report_path):
        raise HTTPException(status_code=404, detail="Report not found")
    return FileResponse(diag.report_path, media_type="application/pdf",
                        filename=f"DERMAXAI_Report_{diagnosis_id}.pdf")


# ════════════════════════════════════════════════════════════
# Patients
# ════════════════════════════════════════════════════════════
@app.get("/api/patients/profile")
def get_profile(db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {
        "id": patient.id, "age": patient.age, "gender": patient.gender,
        "skin_type": patient.skin_type, "medical_history": patient.medical_history,
        "sun_exposure": patient.sun_exposure,
        "name": current_user.name, "email": current_user.email,
    }


@app.put("/api/patients/profile")
def update_profile(data: PatientUpdate, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Profile not found")
    for field, value in data.dict(exclude_none=True).items():
        setattr(patient, field, value)
    db.commit()
    return {"message": "Profile updated successfully"}


# ════════════════════════════════════════════════════════════
# Admin
# ════════════════════════════════════════════════════════════
@app.get("/api/admin/stats")
def admin_stats(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    total_users     = db.query(func.count(User.id)).scalar()
    total_diagnoses = db.query(func.count(Diagnosis.id)).scalar()
    malignant_count = db.query(func.count(Diagnosis.id)).filter(Diagnosis.is_malignant == True).scalar()
    review_count    = db.query(func.count(Diagnosis.id)).filter(Diagnosis.requires_review == True).scalar()
    class_dist      = db.query(Diagnosis.predicted_class,
                               func.count(Diagnosis.id)).group_by(Diagnosis.predicted_class).all()
    return {
        "total_users": total_users,
        "total_diagnoses": total_diagnoses,
        "malignant_count": malignant_count,
        "review_required": review_count,
        "class_distribution": {c: n for c, n in class_dist},
        "model_info": {
    "backbone": settings.MODEL_NAME,
    "dataset": "HAM10000 / ISIC 2018",
    "algorithms": [
        "ACWF-FL",
        "MixUp",
        "Test-Time Augmentation",
        "MCUE",
        "CMCA",
        "Grad-CAM"
    ],
}
    }


@app.get("/api/admin/users")
def list_users(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).limit(100).all()
    return [{"id": u.id, "name": u.name, "email": u.email,
             "role": u.role, "created_at": u.created_at} for u in users]


@app.get("/api/admin/diagnoses")
def list_diagnoses(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    diags = db.query(Diagnosis).order_by(Diagnosis.created_at.desc()).limit(100).all()
    return [{"id": d.id, "predicted_class": d.predicted_class,
             "fused_confidence": d.fused_confidence,
             "is_malignant": d.is_malignant,
             "requires_review": d.requires_review,
             "created_at": d.created_at} for d in diags]
