"""
DERMAXAI v6 — BioBERT Symptom Analysis Engine
Extracts clinically relevant features from patient free-text
symptom descriptions: severity, duration, urgency indicators.

Uses a lightweight keyword + rule-based NLP layer by default
(no GPU/network dependency), with an optional BioBERT
transformer backend for higher-fidelity extraction when
the `transformers` package and model weights are available.
"""
import re
from typing import Optional

from ai.text_negation import is_negated


# High-risk clinical keywords associated with malignant transformation
URGENT_KEYWORDS = {
    "bleeding":        0.25,
    "bleeds":           0.25,
    "ulcer":            0.25,
    "ulcerated":        0.25,
    "rapid growth":     0.30,
    "rapidly growing":  0.30,
    "growing fast":     0.30,
    "irregular border":  0.20,
    "irregular shape":  0.20,
    "color change":     0.20,
    "changed color":    0.20,
    "asymmetric":       0.15,
    "itching":          0.10,
    "itchy":            0.10,
    "painful":          0.15,
    "pain":             0.15,
    "crusting":         0.15,
    "oozing":           0.20,
    "new mole":         0.10,
    "darkening":        0.15,
}

DURATION_PATTERNS = [
    (r'(\d+)\s*(day|days)',   'days'),
    (r'(\d+)\s*(week|weeks)', 'weeks'),
    (r'(\d+)\s*(month|months)', 'months'),
    (r'(\d+)\s*(year|years)', 'years'),
]


class BioBERTEngine:
    """
    Symptom text analysis engine.
    Falls back gracefully to rule-based extraction if BioBERT
    transformer weights are not installed/available.
    """
    def __init__(self, use_transformer: bool = False):
        self.use_transformer = use_transformer
        self.transformer_model = None

        if use_transformer:
            try:
                from transformers import AutoTokenizer, AutoModel
                self.tokenizer = AutoTokenizer.from_pretrained(
                    "dmis-lab/biobert-base-cased-v1.2")
                self.transformer_model = AutoModel.from_pretrained(
                    "dmis-lab/biobert-base-cased-v1.2")
                print("[BioBERT] Transformer model loaded.")
            except Exception as e:
                print(f"[BioBERT] Could not load transformer model: {e}")
                print("[BioBERT] Falling back to rule-based extraction.")
                self.use_transformer = False

    def extract_duration(self, text: str) -> Optional[dict]:
        text_lower = text.lower()
        for pattern, unit in DURATION_PATTERNS:
            match = re.search(pattern, text_lower)
            if match:
                value = int(match.group(1))
                days  = {"days": 1, "weeks": 7, "months": 30, "years": 365}[unit]
                return {"value": value, "unit": unit, "days_approx": value * days}
        return None

    def compute_symptom_risk(self, text: str) -> dict:
        """
        Rule-based symptom risk scoring.
        Returns a risk contribution score [0, 1] plus matched keywords.
        """
        if not text or not text.strip():
            return {
                "symptom_risk_score": 0.0,
                "matched_keywords": [],
                "duration": None,
                "urgency_flag": False,
            }

        text_lower = text.lower()
        matched = []
        risk_score = 0.0

        for kw, weight in URGENT_KEYWORDS.items():
            for match in re.finditer(re.escape(kw), text_lower):
                if is_negated(text_lower, match.start()):
                    continue
                matched.append(kw)
                risk_score += weight
                break

        risk_score = min(risk_score, 1.0)
        duration = self.extract_duration(text)

        # Rapid onset (under 30 days) + any risk keyword raises urgency
        urgency_flag = bool(matched) and (
            duration is None or duration["days_approx"] < 30
        )

        return {
            "symptom_risk_score": round(risk_score, 4),
            "matched_keywords": matched,
            "duration": duration,
            "urgency_flag": urgency_flag,
        }

    def get_embedding(self, text: str):
        """
        Returns a BioBERT sentence embedding if transformer mode is enabled.
        Returns None if running in rule-based-only mode.
        """
        if not self.use_transformer or self.transformer_model is None:
            return None
        import torch
        inputs = self.tokenizer(text, return_tensors="pt",
                                 truncation=True, max_length=128)
        with torch.no_grad():
            outputs = self.transformer_model(**inputs)
        return outputs.last_hidden_state.mean(dim=1).squeeze().numpy()


# Module-level singleton (rule-based by default — zero extra dependencies)
biobert_engine = BioBERTEngine(use_transformer=False)
