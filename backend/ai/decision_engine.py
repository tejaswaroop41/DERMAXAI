"""
DERMAXAI — Decision Engine / CMCA

Cross-Modal Confidence Aggregation (CMCA) combines three normalized clinical
risk signals into a single clinical-concern score:
  - image malignancy probability mass
  - symptom risk score
  - demographic risk score

The CMCA score is a risk/concern score, not a calibrated probability of
malignancy. The image model remains solely responsible for the predicted
class and image classification confidence.
"""

from core.config import settings


class DecisionEngine:
    """Fuse image, symptom, and demographic evidence without relabeling class."""

    MALIGNANT_REVIEW_CONFIDENCE_FLOOR = 0.70
    MALIGNANCY_MASS_ESCALATION_THRESHOLD = 0.30
    CMCA_CONCERN_THRESHOLD = 0.30

    @staticmethod
    def _weighted_average(values: dict, weights: dict) -> float:
        total_weight = sum(weights.values())
        if total_weight <= 0:
            raise ValueError("CMCA modality weights must contain positive mass")
        return sum(values[name] * weights[name] for name in values) / total_weight

    def fuse(self, image_result: dict,
             symptom_risk: dict,
             demographic_risk: dict,
             uncertainty: dict) -> dict:

        pred_class = image_result["predicted_class"]
        image_conf = float(image_result["confidence"])
        class_probs = image_result["class_probabilities"]
        predicted_malignant = bool(pred_class in settings.MALIGNANT_CLASSES)

        # Image confidence remains the model's class-confidence measure.
        image_confidence = image_conf

        # Image-derived malignancy evidence is the sum of the configured
        # malignant-class probabilities. This is the image-side risk input.
        malignancy_mass = float(sum(
            class_probs.get(c, 0.0) for c in settings.MALIGNANT_CLASSES
        ))

        symptom_score = max(0.0, min(1.0, float(
            symptom_risk.get("symptom_risk_score", 0.0)
        )))
        demo_score = max(0.0, min(1.0, float(
            demographic_risk.get("demographic_risk_score", 0.0)
        )))
        symptom_urgent = bool(symptom_risk.get("urgency_flag", False))

        # Evidence-adaptive modality weights. Each modality receives a small
        # baseline weight so that absence of one signal does not erase the
        # contribution of the other modalities. These same weights are used
        # in CMCA below; they are not reporting-only metadata.
        weights = {
            "image": 0.25 + 0.75 * image_confidence,
            "symptoms": 0.25 + 0.75 * symptom_score,
            "demographics": 0.25 + 0.75 * demo_score,
        }
        risk_values = {
            "image": malignancy_mass,
            "symptoms": symptom_score,
            "demographics": demo_score,
        }
        cmca_score = float(self._weighted_average(risk_values, weights))

        # Clinical escalation is intentionally separate from the malignant
        # class label. A concerning multimodal score can require review without
        # converting a benign image prediction into a malignant prediction.
        urgency_escalation = bool(
            symptom_urgent
            or malignancy_mass >= self.MALIGNANCY_MASS_ESCALATION_THRESHOLD
            or cmca_score >= self.CMCA_CONCERN_THRESHOLD
        )

        is_malignant = predicted_malignant
        requires_review = bool(
            uncertainty.get("requires_review", False)
            or urgency_escalation
            or (is_malignant and image_confidence < self.MALIGNANT_REVIEW_CONFIDENCE_FLOOR)
        )

        return {
            "predicted_class": pred_class,
            "class_name": image_result["class_name"],
            "fused_confidence": round(image_confidence, 4),
            "image_confidence": round(image_confidence, 4),
            "malignancy_mass": round(malignancy_mass, 4),
            "cmca_clinical_concern_score": round(cmca_score, 4),
            "is_malignant": is_malignant,
            "predicted_malignant": predicted_malignant,
            "clinical_concern": bool(cmca_score >= self.CMCA_CONCERN_THRESHOLD or requires_review),
            "requires_review": requires_review,
            "urgency_escalated": urgency_escalation,
            "modality_weights": {
                name: round(weight / sum(weights.values()), 4)
                for name, weight in weights.items()
            },
            "class_probabilities": class_probs,
        }


decision_engine = DecisionEngine()
