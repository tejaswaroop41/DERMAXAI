"""
DERMAXAI v6 — Main Application Entry Point
Wires together all AI engines into a single diagnostic pipeline exposed via FastAPI.
"""
import os
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from core.config import settings
from core.database import create_tables, get_db, User, Patient, Diagnosis, DoctorReview
from core.auth import (hash_password, verify_password, create_token,
                       get_current_user, require_admin, require_doctor)
from ai.predictor import predictor
from ai.uncertainty import UncertaintyEngine
from ai.gradcam import GradCAMEngine
from ai.biobert_engine import biobert_engine
from ai.risk_engine import risk_engine
from ai.decision_engine import decision_engine
from ai.recommendation_engine import recommendation_engine
from ai.abcd_engine import extract_abcd_features
from reports.report_generator import generate_report
from utils.logger import get_logger
from utils.validators import (validate_image_extension, validate_image_size,
                              sanitize_filename)

logger = get_logger("dermaxai")
uncertainty_engine: Optional[UncertaintyEngine] = None
gradcam_engine: Optional[GradCAMEngine] = None
limiter = Limiter(key_func=get_remote_address)


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


app = FastAPI(title=settings.APP_NAME, description="Multimodal AI-Powered Healthcare Diagnostic Assistant",
              version=settings.APP_VERSION, lifespan=lifespan,
              docs_url="/docs" if settings.DEBUG else None,
              redoc_url="/redoc" if settings.DEBUG else None,
              openapi_url="/openapi.json" if settings.DEBUG else None)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str = Field(..., min_length=8, max_length=128)
    role: str = "patient"
    age: Optional[int] = None
    gender: Optional[str] = None
    skin_type: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not any(ch.isalpha() for ch in value) or not any(ch.isdigit() for ch in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


PUBLIC_REGISTRATION_ROLES = {"patient"}


class LoginRequest(BaseModel):
    email: str
    password: str


class PatientUpdate(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None
    skin_type: Optional[str] = None
    medical_history: Optional[str] = None
    sun_exposure: Optional[str] = None


class DoctorReviewRequest(BaseModel):
    verdict: str
    notes: Optional[str] = None


VALID_VERDICTS = {"confirmed", "revised", "dismissed"}


def _can_view_diagnosis(diag: Diagnosis, current_user: User) -> bool:
    """Allow the patient owner or the doctor who claimed the case to view it."""
    if diag.user_id == current_user.id:
        return True
    return bool(
        current_user.role == "doctor"
        and diag.review is not None
        and diag.review.doctor_id == current_user.id
    )


def _review_payload(diag: Diagnosis) -> Optional[dict]:
    if not diag.review:
        return None
    return {
        "status": diag.review.status,
        "verdict": diag.review.verdict,
        "notes": diag.review.notes,
        "doctor_name": diag.review.doctor.name if diag.review.doctor else None,
        "claimed_at": diag.review.claimed_at,
        "reviewed_at": diag.review.reviewed_at,
    }


@app.get("/")
async def root():
    return {"message": settings.APP_NAME, "status": "running", "version": settings.APP_VERSION}


@app.get("/api/health")
async def health():
    return {"status": "healthy", "model": "EfficientNet-B3", "dataset": "ISIC 2018",
            "device": str(predictor.device), "model_loaded": predictor.loaded,
            "algorithms": ["TTA", "MCUE", "CMCA", "Grad-CAM", "BioBERT", "Demographic Risk Engine"]}


@app.post("/api/auth/register")
@limiter.limit("5/minute")
def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
    role = req.role.lower().strip()
    if role not in PUBLIC_REGISTRATION_ROLES:
        raise HTTPException(status_code=403,
                            detail="Doctor accounts must be provisioned by an administrator")

    email = req.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=email, name=req.name.strip(), hashed_password=hash_password(req.password), role=role)
    patient = Patient(user=user, age=req.age, gender=req.gender, skin_type=req.skin_type)
    db.add(user)
    db.add(patient)

    try:
        # Flush assigns user.id while keeping user + patient in one transaction.
        db.flush()
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")

    token = create_token({"sub": user.id, "role": user.role})
    return {"access_token": token, "token_type": "bearer",
            "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}}


@app.post("/api/auth/login")
@limiter.limit("10/minute")
def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": user.id, "role": user.role})
    return {"access_token": token, "token_type": "bearer",
            "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}}


@app.get("/api/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name,
            "email": current_user.email, "role": current_user.role}


@app.post("/api/diagnose")
async def diagnose(image: UploadFile = File(...), symptoms: str = Form(default=""),
                   age: Optional[int] = Form(default=None), gender: str = Form(default=""),
                   skin_type: str = Form(default=""), sun_exposure: str = Form(default=""),
                   db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not validate_image_extension(image.filename):
        raise HTTPException(status_code=400, detail="Unsupported image format")
    file_bytes = await image.read()
    if not validate_image_size(file_bytes):
        raise HTTPException(status_code=400, detail="Image exceeds 10MB limit")

    safe_name = sanitize_filename(image.filename)
    ext = safe_name.split(".")[-1]
    img_id = str(uuid.uuid4())
    img_path = os.path.join(settings.UPLOADS_DIR, f"{img_id}.{ext}")
    with open(img_path, "wb") as f:
        f.write(file_bytes)

    try:
        image_result = predictor.predict(img_path)
        symptom_risk = biobert_engine.compute_symptom_risk(symptoms)
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        demographic_risk = risk_engine.assess(
            age=age if age is not None else (patient.age if patient else None),
            gender=gender or (patient.gender if patient else None),
            skin_type=skin_type or (patient.skin_type if patient else None),
            medical_history=patient.medical_history if patient else None,
            sun_exposure=sun_exposure or (patient.sun_exposure if patient else None),
        )

        uncertainty = uncertainty_engine.composite_uncertainty(
            raw_probs=image_result["raw_probs"],
            mc_probs=image_result["mc_probs"],
        )
        decision = decision_engine.fuse(image_result=image_result, symptom_risk=symptom_risk,
                                        demographic_risk=demographic_risk, uncertainty=uncertainty)

        gradcam_path = os.path.join(settings.HEATMAPS_DIR, f"gradcam_{img_id}.jpg")
        try:
            class_idx = settings.CLASSES.index(decision["predicted_class"])
            gradcam_engine.generate(img_path, class_idx, gradcam_path)
        except Exception as e:
            logger.warning(f"Grad-CAM generation failed: {e}")
            gradcam_path = None

        recommendation = recommendation_engine.generate(decision=decision, uncertainty=uncertainty,
                                                        symptom_risk=symptom_risk)
        try:
            abcd_features = extract_abcd_features(img_path)
        except Exception as e:
            logger.warning(f"ABCD feature extraction failed: {e}")
            abcd_features = {"asymmetry": None, "border_irregularity": None,
                             "color_variation": None, "diameter_px": None, "segmentation_ok": False}

        diag = Diagnosis(
            user_id=current_user.id, patient_id=patient.id if patient else None,
            image_path=img_path, symptoms=symptoms,
            predicted_class=decision["predicted_class"], fused_confidence=decision["fused_confidence"],
            image_confidence=decision["image_confidence"], is_malignant=decision["is_malignant"],
            requires_review=decision["requires_review"], urgency_escalated=decision["urgency_escalated"],
            aleatory_uncertainty=uncertainty["aleatory_uncertainty"],
            epistemic_uncertainty=uncertainty["epistemic_uncertainty"],
            fusion_uncertainty=uncertainty["fusion_uncertainty"],
            composite_uncertainty=uncertainty["composite_uncertainty"],
            symptom_risk_score=symptom_risk["symptom_risk_score"],
            demographic_risk_score=demographic_risk["demographic_risk_score"],
            gradcam_path=gradcam_path, class_probs=json.dumps(decision["class_probabilities"]),
            modality_weights=json.dumps(decision["modality_weights"]), abcd_features=json.dumps(abcd_features),
        )
        db.add(diag); db.commit(); db.refresh(diag)

        report_path = os.path.join(settings.REPORTS_DIR, f"report_{diag.id}.pdf")
        try:
            patient_data = {"name": current_user.name,
                            "age": age if age is not None else (patient.age if patient else "N/A"),
                            "gender": gender or (patient.gender if patient else "N/A"),
                            "skin_type": skin_type or (patient.skin_type if patient else "N/A"),
                            "diagnosis_id": diag.id}
            generate_report(decision, uncertainty, recommendation, patient_data, gradcam_path, report_path)
            diag.report_path = report_path
            db.commit()
        except Exception as e:
            logger.warning(f"PDF generation failed: {e}")

        return {"diagnosis_id": diag.id, "decision": decision, "uncertainty": uncertainty,
                "symptom_analysis": symptom_risk, "demographic_risk": demographic_risk,
                "recommendation": recommendation, "image_quality": image_result["image_quality"],
                "abcd_features": abcd_features,
                "gradcam_url": f"/api/diagnose/{diag.id}/gradcam" if gradcam_path else None,
                "report_url": f"/api/reports/{diag.id}" if diag.report_path else None}
    except Exception:
        try:
            if os.path.exists(img_path):
                os.remove(img_path)
        except OSError:
            pass
        raise


@app.get("/api/diagnose/notifications")
def get_review_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = db.query(DoctorReview).join(Diagnosis).filter(
        Diagnosis.user_id == current_user.id, DoctorReview.status == "completed",
        DoctorReview.patient_viewed.isnot(True)).count()
    return {"unread_reviews": count}


@app.post("/api/diagnose/notifications/mark-seen")
def mark_reviews_seen(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    reviews = db.query(DoctorReview).join(Diagnosis).filter(
        Diagnosis.user_id == current_user.id, DoctorReview.status == "completed",
        DoctorReview.patient_viewed.isnot(True)).all()
    for review in reviews:
        review.patient_viewed = True
    db.commit()
    return {"marked_seen": len(reviews)}


@app.get("/api/diagnose/history")
def get_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    diags = db.query(Diagnosis).filter(Diagnosis.user_id == current_user.id).order_by(
        Diagnosis.created_at.desc()).limit(50).all()
    return [{"id": d.id, "predicted_class": d.predicted_class,
             "class_name": settings.CLASS_FULL_NAMES.get(d.predicted_class, d.predicted_class),
             "fused_confidence": d.fused_confidence, "composite_uncertainty": d.composite_uncertainty,
             "is_malignant": d.is_malignant, "requires_review": d.requires_review,
             "created_at": d.created_at, "report_url": f"/api/reports/{d.id}" if d.report_path else None,
             "doctor_review": _review_payload(d),
             "abcd_features": json.loads(d.abcd_features) if d.abcd_features else None} for d in diags]


@app.get("/api/diagnose/{diagnosis_id:int}/gradcam")
def get_gradcam(diagnosis_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    diag = db.query(Diagnosis).filter(Diagnosis.id == diagnosis_id).first()
    if not diag or not _can_view_diagnosis(diag, current_user):
        raise HTTPException(status_code=404, detail="Grad-CAM not found")
    if not diag.gradcam_path or not os.path.exists(diag.gradcam_path):
        raise HTTPException(status_code=404, detail="Grad-CAM not found")
    return FileResponse(diag.gradcam_path, media_type="image/jpeg")


@app.get("/api/reports/{diagnosis_id}")
def download_report(diagnosis_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    diag = db.query(Diagnosis).filter(Diagnosis.id == diagnosis_id).first()
    if not diag or not _can_view_diagnosis(diag, current_user):
        raise HTTPException(status_code=404, detail="Report not found")
    if not diag.report_path or not os.path.exists(diag.report_path):
        raise HTTPException(status_code=404, detail="Report not found")
    return FileResponse(diag.report_path, media_type="application/pdf",
                        filename=f"DERMAXAI_Report_{diagnosis_id}.pdf")


@app.get("/api/patients/profile")
def get_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"id": patient.id, "age": patient.age, "gender": patient.gender,
            "skin_type": patient.skin_type, "medical_history": patient.medical_history,
            "sun_exposure": patient.sun_exposure, "name": current_user.name, "email": current_user.email}


@app.put("/api/patients/profile")
def update_profile(data: PatientUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Profile not found")
    for field, value in data.dict(exclude_none=True).items():
        setattr(patient, field, value)
    db.commit()
    return {"message": "Profile updated successfully"}


@app.get("/api/doctor/queue")
def doctor_queue(db: Session = Depends(require_doctor)):
    raise NotImplementedError
