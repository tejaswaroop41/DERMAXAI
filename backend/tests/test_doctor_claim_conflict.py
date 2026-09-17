import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.exc import IntegrityError

from features.routes import doctor_claim_integrity_error_handler


def _response_payload(response):
    return json.loads(response.body.decode("utf-8"))


def test_doctor_claim_unique_collision_returns_conflict():
    exc = IntegrityError(
        "INSERT INTO doctor_reviews",
        {},
        Exception("UNIQUE constraint failed: doctor_reviews.diagnosis_id"),
    )

    response = doctor_claim_integrity_error_handler(None, exc)

    assert response.status_code == 409
    assert _response_payload(response)["detail"] == "Diagnosis already claimed by another doctor"


def test_unrelated_integrity_error_is_not_reported_as_claim_conflict():
    exc = IntegrityError(
        "INSERT INTO users",
        {},
        Exception("UNIQUE constraint failed: users.email"),
    )

    response = doctor_claim_integrity_error_handler(None, exc)

    assert response.status_code == 500
    assert _response_payload(response)["detail"] == "Database integrity error"
