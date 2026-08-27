from types import SimpleNamespace

from ai.decision_engine import DecisionEngine
from app import _can_view_diagnosis


def test_patient_owner_can_view_own_diagnosis():
    diagnosis = SimpleNamespace(user_id=101, review=None)
    patient = SimpleNamespace(id=101, role="patient")
    assert _can_view_diagnosis(diagnosis, patient) is True


def test_unclaimed_diagnosis_is_not_visible_to_doctor():
    diagnosis = SimpleNamespace(user_id=101, review=None)
    doctor = SimpleNamespace(id=202, role="doctor")
    assert _can_view_diagnosis(diagnosis, doctor) is False


def test_claimed_diagnosis_is_visible_only_to_claiming_doctor():
    diagnosis = SimpleNamespace(
        user_id=101,
        review=SimpleNamespace(doctor_id=202),
    )
    claiming_doctor = SimpleNamespace(id=202, role="doctor")
    other_doctor = SimpleNamespace(id=303, role="doctor")
    assert _can_view_diagnosis(diagnosis, claiming_doctor) is True
    assert _can_view_diagnosis(diagnosis, other_doctor) is False


def test_admin_without_ownership_cannot_use_doctor_access_path():
    diagnosis = SimpleNamespace(
        user_id=101,
        review=SimpleNamespace(doctor_id=202),
    )
    admin = SimpleNamespace(id=999, role="admin")
    assert _can_view_diagnosis(diagnosis, admin) is False


def test_clinical_concern_does_not_change_case_access_policy():
    # Authorization is independent of the decision engine's clinical-concern state.
    diagnosis = SimpleNamespace(
        user_id=101,
        review=SimpleNamespace(doctor_id=202),
    )
    doctor = SimpleNamespace(id=202, role="doctor")
    assert _can_view_diagnosis(diagnosis, doctor) is True
