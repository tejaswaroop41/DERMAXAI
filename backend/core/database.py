"""
DERMAXAI v6 — Database Models
SQLAlchemy ORM models for users, patients, and diagnoses.
"""
from sqlalchemy import (create_engine, Column, Integer, String, Float,
                         DateTime, Text, Boolean, ForeignKey)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

from core.config import settings

DATABASE_URL = settings.DATABASE_URL
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id               = Column(Integer, primary_key=True, index=True)
    email            = Column(String, unique=True, index=True, nullable=False)
    name             = Column(String, nullable=False)
    hashed_password  = Column(String, nullable=False)
    role             = Column(String, default="patient")
    created_at       = Column(DateTime, default=datetime.utcnow)
    is_active        = Column(Boolean, default=True)
    diagnoses        = relationship("Diagnosis", back_populates="user")


class Patient(Base):
    __tablename__ = "patients"
    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    age              = Column(Integer)
    gender           = Column(String)
    skin_type        = Column(String)
    medical_history  = Column(Text)
    sun_exposure     = Column(String)
    created_at       = Column(DateTime, default=datetime.utcnow)
    diagnoses        = relationship("Diagnosis", back_populates="patient")


class Diagnosis(Base):
    __tablename__ = "diagnoses"
    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(Integer, ForeignKey("users.id"))
    patient_id           = Column(Integer, ForeignKey("patients.id"))
    image_path           = Column(String)
    symptoms             = Column(Text)

    predicted_class      = Column(String)
    fused_confidence     = Column(Float)
    image_confidence     = Column(Float)
    is_malignant         = Column(Boolean, default=False)
    requires_review      = Column(Boolean, default=False)
    urgency_escalated    = Column(Boolean, default=False)

    aleatory_uncertainty   = Column(Float)
    epistemic_uncertainty  = Column(Float)
    fusion_uncertainty     = Column(Float)
    composite_uncertainty  = Column(Float)

    symptom_risk_score      = Column(Float)
    demographic_risk_score  = Column(Float)

    gradcam_path         = Column(String)
    report_path          = Column(String)
    class_probs           = Column(Text)   # JSON string
    modality_weights      = Column(Text)   # JSON string

    created_at           = Column(DateTime, default=datetime.utcnow)

    user                 = relationship("User", back_populates="diagnoses")
    patient              = relationship("Patient", back_populates="diagnoses")


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
