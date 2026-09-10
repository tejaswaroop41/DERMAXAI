import os
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.database import Base, Diagnosis, Patient, User


DATABASE_URL = os.getenv("DATABASE_URL", "")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL.startswith(("postgresql://", "postgres://")),
    reason="PostgreSQL regression tests require DATABASE_URL to point to PostgreSQL",
)


def make_session():
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, autoflush=False)
    return engine, Session()


def test_postgres_enforces_patient_one_to_one_constraint():
    engine, db = make_session()
    try:
        user = User(
            email="pg-unique@example.com",
            name="PG Unique",
            hashed_password="hashed",
            role="patient",
        )
        db.add(user)
        db.flush()
        db.add(Patient(user_id=user.id, age=30))
        db.commit()

        db.add(Patient(user_id=user.id, age=31))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        assert db.query(Patient).filter(Patient.user_id == user.id).count() == 1
    finally:
        db.close()
        engine.dispose()


def test_postgres_transaction_rolls_back_all_related_rows():
    engine, db = make_session()
    try:
        user = User(
            email="pg-rollback@example.com",
            name="PG Rollback",
            hashed_password="hashed",
            role="patient",
        )
        db.add(user)
        db.flush()
        db.add(Patient(user_id=user.id, age=40))
        db.add(Patient(user_id=user.id, age=41))

        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

        assert db.query(User).filter(User.email == "pg-rollback@example.com").count() == 0
        assert db.query(Patient).filter(Patient.user_id == user.id).count() == 0
    finally:
        db.close()
        engine.dispose()


def test_postgres_enforces_diagnosis_foreign_key():
    engine, db = make_session()
    try:
        db.add(Diagnosis(patient_id=999999999))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
    finally:
        db.close()
        engine.dispose()
