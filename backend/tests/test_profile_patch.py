import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from features.routes import PatientProfilePatch


def test_profile_patch_preserves_explicit_null_values():
    patch = PatientProfilePatch(age=None, gender=None, skin_type=None)
    assert patch.model_dump(exclude_unset=True) == {
        "age": None,
        "gender": None,
        "skin_type": None,
    }


def test_profile_patch_preserves_supplied_values():
    patch = PatientProfilePatch(
        age=42,
        gender="Female",
        skin_type="Type II",
        sun_exposure="High",
    )
    payload = patch.model_dump(exclude_unset=True)
    assert payload["age"] == 42
    assert payload["gender"] == "Female"
    assert payload["skin_type"] == "Type II"
    assert payload["sun_exposure"] == "High"
