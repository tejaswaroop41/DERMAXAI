import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.config import settings
from features.routes import _clinical_concern_for_diagnosis


def test_concern_class_is_not_reclassified_as_malignant():
    diagnosis = SimpleNamespace(
        predicted_class="akiec",
        is_malignant=False,
        requires_review=False,
    )
    assert _clinical_concern_for_diagnosis(diagnosis) is True
    assert "akiec" in settings.CLINICAL_CONCERN_CLASSES
    assert "akiec" not in settings.MALIGNANT_CLASSES


def test_review_escalation_is_a_clinical_concern_for_non_malignant_classes():
    diagnosis = SimpleNamespace(
        predicted_class="nv",
        is_malignant=False,
        requires_review=True,
    )
    assert _clinical_concern_for_diagnosis(diagnosis) is True


def test_routine_non_malignant_case_is_not_a_clinical_concern():
    diagnosis = SimpleNamespace(
        predicted_class="nv",
        is_malignant=False,
        requires_review=False,
    )
    assert _clinical_concern_for_diagnosis(diagnosis) is False
