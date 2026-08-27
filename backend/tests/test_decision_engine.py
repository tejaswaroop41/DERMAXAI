import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai.decision_engine import DecisionEngine


def _image_result(predicted_class="nv", confidence=0.80):
    classes = {"akiec": 0.05, "bcc": 0.05, "bkl": 0.10,
               "df": 0.05, "mel": 0.05, "nv": 0.65, "vasc": 0.05}
    classes[predicted_class] = confidence
    # Keep the test distribution valid after overriding the top class.
    total = sum(classes.values())
    classes = {k: v / total for k, v in classes.items()}
    return {
        "predicted_class": predicted_class,
        "class_name": predicted_class,
        "confidence": classes[predicted_class],
        "class_probabilities": classes,
        "is_malignant": predicted_class in {"akiec", "bcc", "mel"},
    }


def test_urgent_symptoms_do_not_turn_benign_prediction_malignant():
    engine = DecisionEngine()
    result = engine.fuse(
        image_result=_image_result("nv", 0.80),
        symptom_risk={"symptom_risk_score": 0.25, "urgency_flag": True},
        demographic_risk={"demographic_risk_score": 0.05},
        uncertainty={"requires_review": False},
    )

    assert result["predicted_class"] == "nv"
    assert result["is_malignant"] is False
    assert result["predicted_malignant"] is False
    assert result["urgency_escalated"] is True
    assert result["requires_review"] is True
    assert result["clinical_concern"] is True


def test_malignant_image_prediction_remains_malignant():
    engine = DecisionEngine()
    result = engine.fuse(
        image_result=_image_result("mel", 0.80),
        symptom_risk={"symptom_risk_score": 0.0, "urgency_flag": False},
        demographic_risk={"demographic_risk_score": 0.0},
        uncertainty={"requires_review": False},
    )

    assert result["predicted_class"] == "mel"
    assert result["is_malignant"] is True
    assert result["predicted_malignant"] is True
