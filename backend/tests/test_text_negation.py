import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai.biobert_engine import BioBERTEngine
from ai.risk_engine import RiskEngine


def test_negated_symptoms_do_not_add_risk():
    engine = BioBERTEngine()
    result = engine.compute_symptom_risk("No bleeding and not painful.")
    assert result["matched_keywords"] == []
    assert result["symptom_risk_score"] == 0.0
    assert result["urgency_flag"] is False


def test_positive_symptoms_still_add_risk():
    engine = BioBERTEngine()
    result = engine.compute_symptom_risk("The lesion is bleeding and painful.")
    assert "bleeding" in result["matched_keywords"]
    assert "painful" in result["matched_keywords"]
    assert result["symptom_risk_score"] > 0.0


def test_negated_history_does_not_add_risk():
    engine = RiskEngine()
    assert engine.compute_history_risk("No family history of melanoma and no skin cancer.") == 0.0


def test_positive_history_still_adds_risk():
    engine = RiskEngine()
    assert engine.compute_history_risk("Family history of melanoma.") > 0.0
