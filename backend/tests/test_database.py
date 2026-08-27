import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.database import Patient, User


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
