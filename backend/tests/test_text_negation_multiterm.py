import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai.biobert_engine import biobert_engine
from ai.risk_engine import risk_engine


def test_negated_history_phrase_does_not_add_risk():
    result = risk_engine.compute_history_risk(
        "No family history of melanoma and no skin cancer."
    )
    assert result == 0.0


def test_negated_symptom_phrase_does_not_add_risk():
    result = biobert_engine.compute_symptom_risk(
        "No bleeding and no pain from the lesion."
    )
    assert result["symptom_risk_score"] == 0.0
    assert result["matched_keywords"] == []


def test_negation_does_not_leak_across_clause_boundary():
    result = biobert_engine.compute_symptom_risk(
        "No pain, but currently bleeding."
    )
    assert "bleeding" in result["matched_keywords"]
    assert "pain" not in result["matched_keywords"]
