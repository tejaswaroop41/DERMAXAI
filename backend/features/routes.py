"""Additive feature routes: lesion tracking and admin analytics."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.auth import get_current_user, require_admin
from core.config import settings
from core.database import Diagnosis, DoctorReview, Lesion, Patient, User, get_db

router = APIRouter()
_mounted = False


class LesionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    body_site: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=2000)


class LesionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    body_site: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=2000)


class PatientProfilePatch(BaseModel):
    """Partial patient profile update; explicit null values clear fields."""

    age: Optional[int] = Field(default=None, ge=0, le=120)
    gender: Optional[str] = Field(default=None, max_length=30)
    skin_type: Optional[str] = Field(default=None, max_length=30)
    medical_history: Optional[str] = Field(default=None, max_length=5000)
    sun_exposure: Optional[str] = Field(default=None, max_length=30)


def _diagnosis_payload(d: Diagnosis) -> dict:
    return {
        "id": d.id,
        "lesion_id": d.lesion_id,
        "predicted_class": d.predicted_class,
        "class_name": settings.CLASS_FULL_NAMES.get(d.predicted_class, d.predicted_class),
        "fused_confidence": d.fused_confidence,
        "composite_uncertainty": d.composite_uncertainty,
        "is_malignant": d.is_malignant,
        "requires_review": d.requires_review,
        "urgency_escalated": d.urgency_escalated,
        "symptoms": d.symptoms,
        "created_at": d.created_at,
        "gradcam_url": f"/api/diagnose/{d.id}/gradcam" if d.gradcam_path else None,
        "report_url": f"/api/reports/{d.id}" if d.report_path else None,
    }


def _lesion_summary(lesion: Lesion) -> dict:
    diagnoses = sorted(lesion.diagnoses, key=lambda d: d.created_at or datetime.min, reverse=True)
    latest = diagnoses[0] if diagnoses else None
    return {
        "id": lesion.id,
        "name": lesion.name,
        "body_site": lesion.body_site,
        "notes": lesion.notes,
        "created_at": lesion.created_at,
        "updated_at": lesion.updated_at,
        "diagnosis_count": len(diagnoses),
        "latest": _diagnosis_payload(latest) if latest else None,
    }


def compute_admin_performance(diagnoses: list[Diagnosis], reviews: list[DoctorReview]) -> dict:
    """Compute review/uncertainty metrics without claiming unsupported accuracy."""
    total = len(diagnoses)
    malignant = sum(1 for d in diagnoses if d.is_malignant)
    requires_review = sum(1 for d in diagnoses if d.requires_review)
    distribution: dict[str, int] = {}
    uncertainty_values = []
    for d in diagnoses:
        key = d.predicted_class or "unknown"
        distribution[key] = distribution.get(key, 0) + 1
        if d.composite_uncertainty is not None:
            uncertainty_values.append(float(d.composite_uncertainty))

    revised = sum(1 for r in reviews if r.verdict == "revised")
    turnaround_hours = [
        max(0.0, (r.reviewed_at - r.claimed_at).total_seconds() / 3600)
        for r in reviews
        if r.claimed_at and r.reviewed_at
    ]

    return {
        "total_diagnoses": total,
        "malignant_count": malignant,
        "malignant_rate": round(malignant / total, 4) if total else 0.0,
        "review_required": requires_review,
        "review_rate": round(requires_review / total, 4) if total else 0.0,
        "reviewed_count": len(reviews),
        "revised_count": revised,
        "revision_rate": round(revised / len(reviews), 4) if reviews else 0.0,
        "average_uncertainty": round(sum(uncertainty_values) / len(uncertainty_values), 4) if uncertainty_values else None,
        "average_review_turnaround_hours": round(sum(turnaround_hours) / len(turnaround_hours), 2) if turnaround_hours else None,
        "class_distribution": distribution,
    }


@router.post("/api/lesions")
def create_lesion(req: LesionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lesion = Lesion(user_id=current_user.id, name=req.name.strip(), body_site=req.body_site.strip() if req.body_site else None, notes=req.notes.strip() if req.notes else None)
    db.add(lesion)
    db.commit()
    db.refresh(lesion)
    return _lesion_summary(lesion)


@router.get("/api/lesions")
def list_lesions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lesions = db.query(Lesion).filter(Lesion.user_id == current_user.id).order_by(Lesion.updated_at.desc(), Lesion.id.desc()).all()
    return [_lesion_summary(lesion) for lesion in lesions]


@router.get("/api/lesions/{lesion_id:int}")
def get_lesion(lesion_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lesion = db.query(Lesion).filter(Lesion.id == lesion_id, Lesion.user_id == current_user.id).first()
    if not lesion:
        raise HTTPException(status_code=404, detail="Lesion not found")
    diagnoses = sorted(lesion.diagnoses, key=lambda d: d.created_at or datetime.min)
    payload = _lesion_summary(lesion)
    payload["diagnoses"] = [_diagnosis_payload(d) for d in diagnoses]
    return payload


@router.patch("/api/lesions/{lesion_id:int}")
def update_lesion(lesion_id: int, req: LesionUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lesion = db.query(Lesion).filter(Lesion.id == lesion_id, Lesion.user_id == current_user.id).first()
    if not lesion:
        raise HTTPException(status_code=404, detail="Lesion not found")
    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(lesion, field, value.strip() if isinstance(value, str) else value)
    lesion.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(lesion)
    return _lesion_summary(lesion)


@router.delete("/api/lesions/{lesion_id:int}")
def delete_lesion(lesion_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lesion = db.query(Lesion).filter(Lesion.id == lesion_id, Lesion.user_id == current_user.id).first()
    if not lesion:
        raise HTTPException(status_code=404, detail="Lesion not found")
    for diagnosis in lesion.diagnoses:
        diagnosis.lesion_id = None
    db.delete(lesion)
    db.commit()
    return {"message": "Lesion tracking removed"}


@router.post("/api/lesions/{lesion_id:int}/diagnoses/{diagnosis_id:int}")
def attach_diagnosis(lesion_id: int, diagnosis_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lesion = db.query(Lesion).filter(Lesion.id == lesion_id, Lesion.user_id == current_user.id).first()
    diagnosis = db.query(Diagnosis).filter(Diagnosis.id == diagnosis_id, Diagnosis.user_id == current_user.id).first()
    if not lesion or not diagnosis:
        raise HTTPException(status_code=404, detail="Lesion or diagnosis not found")
    if diagnosis.lesion_id is not None and diagnosis.lesion_id != lesion.id:
        raise HTTPException(status_code=409, detail="Diagnosis is already assigned to another lesion")
    diagnosis.lesion_id = lesion.id
    lesion.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Diagnosis added to lesion", "lesion_id": lesion.id, "diagnosis_id": diagnosis.id}


@router.patch("/api/patients/profile")
def patch_patient_profile(req: PatientProfilePatch, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Partially update a patient profile while preserving explicit nulls."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Profile not found")

    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(patient, field, value.strip() if isinstance(value, str) else value)

    db.commit()
    db.refresh(patient)
    return {
        "message": "Profile updated successfully",
        "profile": {
            "id": patient.id,
            "age": patient.age,
            "gender": patient.gender,
            "skin_type": patient.skin_type,
            "medical_history": patient.medical_history,
            "sun_exposure": patient.sun_exposure,
        },
    }


@router.get("/api/admin/performance")
def admin_performance(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    diagnoses = db.query(Diagnosis).all()
    reviews = db.query(DoctorReview).filter(DoctorReview.status == "completed").all()
    payload = compute_admin_performance(diagnoses, reviews)
    payload["model_info"] = {
        "architecture": settings.MODEL_NAME,
        "dataset": "ISIC 2018",
        "classes": settings.CLASSES,
        "device": "runtime",
    }
    payload["note"] = "Revision rate uses completed doctor reviews marked 'revised'; it is not an accuracy metric because ground-truth labels are not stored."
    return payload


def mount_feature_routes() -> None:
    global _mounted
    if _mounted:
        return
    try:
        from app import app as fastapi_app
    except Exception:
        return
    fastapi_app.include_router(router)
    _mounted = True
