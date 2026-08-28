from ai.biobert_engine import BioBERTEngine


def test_painful_is_not_double_counted_as_pain():
    engine = BioBERTEngine(use_transformer=False)
    result = engine.compute_symptom_risk("The lesion is painful")

    assert result["matched_keywords"] == ["painful"]
    assert result["symptom_risk_score"] == 0.15


def test_separate_pain_and_painful_mentions_count_independently_when_non_overlapping():
    engine = BioBERTEngine(use_transformer=False)
    result = engine.compute_symptom_risk("One lesion is painful; another causes pain")

    assert "painful" in result["matched_keywords"]
    assert "pain" in result["matched_keywords"]
    assert result["symptom_risk_score"] == 0.30
