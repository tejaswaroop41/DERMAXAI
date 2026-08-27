"""
DERMAXAI — Demographic Risk Engine
Computes a patient risk score from demographic and history factors,
following established dermatological risk-factor literature
(ABCDE criteria correlates: age, skin type, family history, sun exposure).
"""
import re
from typing import Optional

from ai.text_negation import is_negated


# Fitzpatrick skin type risk multipliers
# Type I/II (fair skin) carry higher melanoma risk
FITZPATRICK_RISK = {
    "Type I":   0.20,
    "Type II":  0.15,
    "Type III": 0.08,
    "Type IV":  0.05,
    "Type V":   0.03,
    "Type VI":  0.02,
}


class RiskEngine:
    """
    Computes demographic and history-based risk score.
    Combined with image and symptom modalities via the decision engine.
    """
    def compute_age_risk(self, age: Optional[int]) -> float:
        if age is None:
            return 0.0
        if age >= 65: return 0.25
        if age >= 50: return 0.18
        if age >= 40: return 0.10
        if age >= 30: return 0.05
        return 0.02

    def compute_skin_type_risk(self, skin_type: Optional[str]) -> float:
        if not skin_type:
            return 0.05
        normalized = skin_type.strip().lower()

        exact_lookup = {k.lower(): v for k, v in FITZPATRICK_RISK.items()}
        if normalized in exact_lookup:
            return exact_lookup[normalized]

        for key, val in FITZPATRICK_RISK.items():
            if re.search(rf'\b{re.escape(key.lower())}\b', normalized):
                return val
        return 0.05

    def compute_history_risk(self, medical_history: Optional[str]) -> float:
        if not medical_history:
            return 0.0
        history_lower = medical_history.lower()
        risk = 0.0
        risk_factors = {
            "family history": 0.20, "melanoma": 0.25, "skin cancer": 0.20,
            "sunburn": 0.10, "blistering sunburn": 0.15, "tanning bed": 0.12,
            "immunosuppress": 0.15, "many moles": 0.10, "atypical mole": 0.15,
            "previous biopsy": 0.10,
        }
        for kw, weight in risk_factors.items():
            for match in re.finditer(re.escape(kw), history_lower):
                if is_negated(history_lower, match.start()):
                    continue
                risk += weight
                break
        return min(risk, 1.0)

    def compute_sun_exposure_risk(self, sun_exposure: Optional[str]) -> float:
        if not sun_exposure:
            return 0.0
        mapping = {"high": 0.20, "moderate": 0.10, "low": 0.02}
        return mapping.get(sun_exposure.strip().lower(), 0.0)

    def assess(self, age: Optional[int] = None,
               gender: Optional[str] = None,
               skin_type: Optional[str] = None,
               medical_history: Optional[str] = None,
               sun_exposure: Optional[str] = None) -> dict:
        """
        Returns the composite demographic risk score [0, 1]
        plus a breakdown of contributing factors.
        """
        age_risk = self.compute_age_risk(age)
        skin_risk = self.compute_skin_type_risk(skin_type)
        history_risk = self.compute_history_risk(medical_history)
        sun_risk = self.compute_sun_exposure_risk(sun_exposure)

        composite = min(age_risk + skin_risk + history_risk + sun_risk, 1.0)

        return {
            "demographic_risk_score": round(composite, 4),
            "breakdown": {
                "age_risk": round(age_risk, 4),
                "skin_type_risk": round(skin_risk, 4),
                "history_risk": round(history_risk, 4),
                "sun_exposure_risk": round(sun_risk, 4),
            },
            "risk_level": self._risk_label(composite),
        }

    def _risk_label(self, score: float) -> str:
        if score >= 0.5: return "High"
        if score >= 0.25: return "Moderate"
        if score >= 0.10: return "Low-Moderate"
        return "Low"


risk_engine = RiskEngine()
