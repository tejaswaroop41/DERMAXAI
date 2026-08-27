import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.database import Base, NormalizedEmail, Patient, User


def test_patient_user_id_is_database_unique():
    constraints = {
        constraint.name: tuple(column.name for column in constraint.columns)
        for constraint in Patient.__table__.constraints
        if constraint.name
    }
    assert constraints["uq_patients_user_id"] == ("user_id",)


def test_user_patient_relationship_is_one_to_one():
    relationship = User.__mapper__.relationships["patient"]
    assert relationship.uselist is False


def test_email_type_normalizes_bind_values():
    email_type = NormalizedEmail(320)
    assert email_type.process_bind_param("  TEST.User@Example.COM ", None) == "test.user@example.com"
    assert email_type.process_bind_param(None, None) is None


def test_patient_and_user_persist_together_in_one_transaction():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    db = Session()
    try:
        user = User(
            email="atomic@example.com",
            name="Atomic Test",
            hashed_password="hashed",
            role="patient",
        )
        patient = Patient(user=user, age=30, gender="other")
        db.add(user)
        db.add(patient)
        db.commit()

        persisted_user = db.query(User).filter(User.email == "ATOMIC@EXAMPLE.COM").one()
        persisted_patient = db.query(Patient).filter(Patient.user_id == persisted_user.id).one()
        assert persisted_patient.age == 30
        assert persisted_user.patient is persisted_patient
    finally:
        db.close()
