import os
import sys

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.database import Base, Diagnosis, Lesion, User
from features.routes import _attach_diagnosis_atomically


def test_unassigned_diagnosis_can_be_claimed_once():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    db = Session()
    try:
        user = User(email="lesion-atomic@example.com", name="Lesion Atomic", hashed_password="hashed", role="patient")
        first_lesion = Lesion(user=user, name="Left arm")
        second_lesion = Lesion(user=user, name="Right arm")
        diagnosis = Diagnosis(user=user, predicted_class="nv", is_malignant=False)
        db.add_all([user, first_lesion, second_lesion, diagnosis])
        db.commit()

        diagnosis_id = diagnosis.id
        user_id = user.id
        first_lesion_id = first_lesion.id
        second_lesion_id = second_lesion.id
    finally:
        db.close()

    first = Session()
    second = Session()
    try:
        stale_diagnosis = first.query(Diagnosis).filter(Diagnosis.id == diagnosis_id).one()
        first.commit()

        assert _attach_diagnosis_atomically(
            second,
            diagnosis_id=diagnosis_id,
            user_id=user_id,
            lesion_id=second_lesion_id,
        ) is True
        second.commit()

        with pytest.raises(HTTPException) as exc_info:
            _attach_diagnosis_atomically(
                first,
                diagnosis_id=stale_diagnosis.id,
                user_id=user_id,
                lesion_id=first_lesion_id,
            )

        assert exc_info.value.status_code == 409
        assert "another lesion" in str(exc_info.value.detail)
        persisted = first.query(Diagnosis).filter(Diagnosis.id == diagnosis_id).one()
        assert persisted.lesion_id == second_lesion_id
    finally:
        first.close()
        second.close()
        engine.dispose()


def test_repeating_same_assignment_is_idempotent():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    db = Session()
    try:
        user = User(email="lesion-idempotent@example.com", name="Lesion Idempotent", hashed_password="hashed", role="patient")
        lesion = Lesion(user=user, name="Scalp")
        diagnosis = Diagnosis(user=user, predicted_class="nv", is_malignant=False)
        db.add_all([user, lesion, diagnosis])
        db.commit()

        assert _attach_diagnosis_atomically(
            db,
            diagnosis_id=diagnosis.id,
            user_id=user.id,
            lesion_id=lesion.id,
        ) is True
        db.commit()

        assert _attach_diagnosis_atomically(
            db,
            diagnosis_id=diagnosis.id,
            user_id=user.id,
            lesion_id=lesion.id,
        ) is False
        db.commit()

        assert db.query(Diagnosis).filter(Diagnosis.id == diagnosis.id).one().lesion_id == lesion.id
    finally:
        db.close()
        engine.dispose()
