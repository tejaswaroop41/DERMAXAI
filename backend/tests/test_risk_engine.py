import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai.risk_engine import RiskEngine


def test_skin_type_free_text_does_not_match_type_i_inside_type_iii():
    engine = RiskEngine()

    assert engine.compute_skin_type_risk("Patient reports Type III skin") == 0.08


def test_skin_type_exact_dropdown_values_have_expected_risk():
    engine = RiskEngine()

    assert engine.compute_skin_type_risk("Type I") == 0.20
    assert engine.compute_skin_type_risk("Type VI") == 0.02
