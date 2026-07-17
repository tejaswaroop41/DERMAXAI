"""
DERMAXAI v6 — Recommendation Engine
Generates structured clinical recommendations and next-step guidance
based on the fused diagnostic decision, drawing on the knowledge base.
"""
import json
import os

from core.config import settings


class RecommendationEngine:
    """
    Produces patient-facing and clinician-facing recommendations
    based on the predicted class, malignancy status, and uncertainty.
    """
    def __init__(self):
        self.knowledge_cache = {}

    def _load_knowledge(self, class_code: str) -> dict:
        if class_code in self.knowledge_cache:
            return self.knowledge_cache[class_code]

        path = os.path.join(settings.KNOWLEDGE_DIR, f"{class_code}.json")
        if os.path.exists(path):
            with open(path) as f:
                data = json.load(f)
        else:
            data = self._default_knowledge(class_code)

        self.knowledge_cache[class_code] = data
        return data

    def _default_knowledge(self, class_code: str) -> dict:
        is_malignant = class_code in settings.MALIGNANT_CLASSES
        return {
            "name": settings.CLASS_FULL_NAMES.get(class_code, class_code),
            "is_malignant": is_malignant,
            "description": "Detailed clinical description not yet available in knowledge base.",
            "typical_features": [],
            "next_steps": (
                ["Refer to dermatologist for biopsy confirmation",
                 "Avoid sun exposure to the area",
                 "Monitor for changes in size, shape, or color"]
                if is_malignant else
                ["Routine dermatological follow-up recommended",
                 "Self-monitor using the ABCDE rule",
                 "No urgent action required"]
            ),
        }

    def generate(self, decision: dict, uncertainty: dict,
                 symptom_risk: dict) -> dict:
        class_code   = decision["predicted_class"]
        knowledge    = self._load_knowledge(class_code)
        is_malignant = decision["is_malignant"]
        requires_review = decision["requires_review"]

        recommendations = list(knowledge.get("next_steps", []))

        # Dynamic recommendations based on the specific case
        if requires_review:
            recommendations.insert(
                0, "⚠ This case has been flagged for mandatory clinical review "
                   "due to diagnostic uncertainty.")

        if is_malignant:
            urgency = "URGENT" if decision["fused_confidence"] > 0.75 else "PROMPT"
            recommendations.insert(
                0, f"{urgency}: Schedule a dermatologist consultation "
                   "for biopsy and confirmation.")

        if symptom_risk.get("urgency_flag"):
            recommendations.append(
                "Reported symptoms (rapid change, bleeding, or irregularity) "
                "warrant closer clinical attention regardless of image classification.")

        follow_up_days = 7 if is_malignant else (30 if requires_review else 180)

        return {
            "class_description":  knowledge.get("description", ""),
            "typical_features":   knowledge.get("typical_features", []),
            "recommendations":    recommendations,
            "follow_up_days":     follow_up_days,
            "urgency_level":      self._urgency_level(decision, requires_review),
        }

    def _urgency_level(self, decision: dict, requires_review: bool) -> str:
        if decision["is_malignant"] and decision["fused_confidence"] > 0.75:
            return "Urgent"
        if decision["is_malignant"] or requires_review:
            return "Prompt"
        return "Routine"


recommendation_engine = RecommendationEngine()
