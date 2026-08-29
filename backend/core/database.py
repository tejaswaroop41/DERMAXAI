"""
DERMAXAI v6 — Database Models
SQLAlchemy ORM models for users, patients, and diagnoses.
"""
from datetime import datetime
from pathlib import Path

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer,
    String, Text, UniqueConstraint, create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy.types import TypeDecorator

from core.config import settings


class NormalizedEmail(TypeDecorator):
    """Store and compare email addresses using a canonical lowercase form."""

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value).strip().lower()

    def process_result_value(self, value, dialect):
        return value


DATABASE_URL = settings.DATABASE_URL
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL.startswith("sqlite:///"):
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if db_path and db_path != ":memory:":
        Path(db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)

connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(NormalizedEmail(320), unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="patient")
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    diagnoses = relationship("Diagnosis", back_populates="user")
    patient = relationship(
        "Patient",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (UniqueConstraint("user_id", name="uq_patients_user_id"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    age = Column(Integer)
    gender = Column(String)
    skin_type = Column(String)
    medical_history = Column(Text)
    sun_exposure = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    diagnoses = relationship("Diagnosis", back_populates="patient")
    user = relationship("User", back_populates="patient")


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    patient_id = Column(Integer, ForeignKey("patients.id"))
    image_path = Column(String)
    symptoms = Column(Text)

    predicted_class = Column(String)
    fused_confidence = Column(Float)
    image_confidence = Column(Float)
    is_malignant = Column(Boolean, default=False)
    requires_review = Column(Boolean, default=False)
    urgency_escalated = Column(Boolean, default=False)

    aleatory_uncertainty = Column(Float)
    epistemic_uncertainty = Column(Float)
    fusion_uncertainty = Column(Float)
    composite_uncertainty = Column(Float)

    symptom_risk_score = Column(Float)
    demographic_risk_score = Column(Float)

    gradcam_path = Column(String)
    report_path = Column(String)
    class_probs = Column(Text)
    modality_weights = Column(Text)
    abcd_features = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="diagnoses")
    patient = relationship("Patient", back_populates="diagnoses")
    review = relationship(
        "DoctorReview",
        back_populates="diagnosis",
        uselist=False,
        cascade="all, delete-orphan",
    )


class DoctorReview(Base):
    __tablename__ = "doctor_reviews"

    id = Column(Integer, primary_key=True, index=True)
    diagnosis_id = Column(Integer, ForeignKey("diagnoses.id"), nullable=False, unique=True)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="claimed")
    verdict = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    claimed_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    patient_viewed = Column(Boolean, default=False)

    diagnosis = relationship("Diagnosis", back_populates="review")
    doctor = relationship("User")


def create_tables():
    """
    Create missing tables and apply additive SQLite-compatible column/index migrations.
    """
    from sqlalchemy import inspect, text

    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing_cols:
                continue
            col_type = col.type.compile(engine.dialect)
            with engine.begin() as conn:
                conn.execute(
                    text(
                        f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col_type}'
                    )
                )
            print(f"[INFO] Auto-migration: added missing column {table.name}.{col.name}")

    inspector = inspect(engine)
    patient_table = Patient.__table__
    if patient_table.name in inspector.get_table_names():
        existing_uniques = {uc.get("name") for uc in inspector.get_unique_constraints(patient_table.name)}
        existing_indexes = {idx.get("name") for idx in inspector.get_indexes(patient_table.name)}
        invariant_name = "uq_patients_user_id"
        if invariant_name not in existing_uniques and invariant_name not in existing_indexes:
            # Do not create the invariant blindly when legacy duplicate rows exist.
            with engine.begin() as conn:
                duplicates = conn.execute(
                    text(
                        'SELECT user_id, COUNT(*) AS count FROM "patients" '
                        'GROUP BY user_id HAVING COUNT(*) > 1'
                    )
                ).fetchall()
                if duplicates:
                    raise RuntimeError(
                        "Cannot create unique patient.user_id invariant because duplicate patient rows exist"
                    )
                conn.execute(
                    text(
                        f'CREATE UNIQUE INDEX "{invariant_name}" '
                        f'ON "{patient_table.name}" ("user_id")'
                    )
                )

    users_table = User.__table__
    if users_table.name in inspector.get_table_names():
        with engine.begin() as conn:
            duplicates = conn.execute(
                text(
                    'SELECT LOWER(TRIM(email)) AS normalized_email, COUNT(*) AS count '
                    'FROM "users" GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1'
                )
            ).fetchall()
            if duplicates:
                values = ", ".join(str(row[0]) for row in duplicates)
                raise RuntimeError(
                    "Cannot normalize user emails because case-insensitive duplicates exist: " + values
                )
            conn.execute(text('UPDATE "users" SET email = LOWER(TRIM(email))'))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
