"""
DERMAXAI — Decision Engine

Combines the image classifier's output with symptom and demographic
risk signals to produce the final clinical decision.

Important distinction this engine preserves:
  - image_confidence / fused_confidence answer "how sure is the model
    the predicted class is correct?" — this comes ONLY from the image
    model's class-probability output.
  - is_malignant answers only whether the predicted image class itself
    is in the configured malignant-class set.
  - symptom/demographic signals can increase clinical concern and review
    urgency, but they MUST NOT relabel a benign image prediction as
    malignant.
"""

from core.config import settings


class DecisionEngine:
    """
    Fuses:
      - Image modality        (EfficientNet-B3 prediction + class distribution)
      - Symptom modality       (risk/urgency signal)
      - Demographic modality   (risk signal)

    Produces the final decision while keeping model classification and
    clinical escalation as separate concepts.
    """

    # Below this image confidence, a malignant image prediction needs review.
    MALIGNANT_REVIEW_CONFIDENCE_FLOOR = 0.70
    # Escalate when the image model assigns substantial mass to malignant classes.
    MALIGNANCY_MASS_ESCALATION_THRESHOLD = 0.30

    def fuse(self, image_result: dict,
             symptom_risk: dict,
             demographic_risk: dict,
             uncertainty: dict) -> dict:

        pred_class = image_result["predicted_class"]
        image_conf = float(image_result["confidence"])
        class_probs = image_result["class_probabilities"]
        predicted_malignant = bool(pred_class in settings.MALIGNANT_CLASSES)

        # Confidence is image-only. Risk/urgency signals are not class probabilities.
        fused_confidence = image_conf

        # Total probability mass the image model places on malignant classes.
        malignancy_mass = float(sum(
            class_probs.get(c, 0.0) for c in settings.MALIGNANT_CLASSES
        ))

        symptom_score = float(symptom_risk.get("symptom_risk_score", 0.0))
        demo_score = float(demographic_risk.get("demographic_risk_score", 0.0))
        symptom_urgent = bool(symptom_risk.get("urgency_flag", False))

        # Relative concern-signal contribution for transparency/UI only.
        # These values do not modify the image classification or confidence.
        img_signal = max(malignancy_mass, 0.05)
        sym_signal = max(symptom_score, 0.05)
        demo_signal = max(demo_score, 0.05)
        total_signal = img_signal + sym_signal + demo_signal
        w_img = img_signal / total_signal
        w_sym = sym_signal / total_signal
        w_demo = demo_signal / total_signal

        # Clinical escalation can come from image evidence or urgent symptoms.
        # It is deliberately separate from the malignant classification flag.
        urgency_escalation = bool(
            symptom_urgent or
            malignancy_mass >= self.MALIGNANCY_MASS_ESCALATION_THRESHOLD
        )

        # IMPORTANT: symptoms/demographics NEVER convert a benign image
        # prediction into a malignant classification.
        is_malignant = predicted_malignant

        requires_review = bool(
            uncertainty.get("requires_review", False)
            or urgency_escalation
            or (is_malignant and fused_confidence < self.MALIGNANT_REVIEW_CONFIDENCE_FLOOR)
        )

        return {
            "predicted_class": pred_class,
            "class_name": image_result["class_name"],
            "fused_confidence": round(fused_confidence, 4),
            "image_confidence": round(image_conf, 4),
            "malignancy_mass": round(malignancy_mass, 4),
            "is_malignant": is_malignant,
            "predicted_malignant": predicted_malignant,
            "clinical_concern": bool(urgency_escalation or requires_review),
            "requires_review": requires_review,
            "urgency_escalated": urgency_escalation,
            "modality_weights": {
                "image": round(w_img, 4),
                "symptoms": round(w_sym, 4),
                "demographics": round(w_demo, 4),
            },
            "class_probabilities": class_probs,
        }


decision_engine = DecisionEngine()
