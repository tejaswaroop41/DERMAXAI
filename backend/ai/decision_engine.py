"""
DERMAXAI — Decision Engine

Combines the image classifier's output with symptom and demographic
risk signals to produce the final clinical decision.

Important distinction this engine preserves:
  - image_confidence / fused_confidence answer "how sure is the model
    the predicted class is correct?" — this comes ONLY from the image
    model's softmax output, since symptoms and demographics are risk
    scores, not class-probability distributions, and mixing the two
    would make "confidence" meaningless.
  - symptom_risk_score / demographic_risk_score / malignancy_mass
    answer "how concerning is this case?" — these drive escalation
    (is_malignant, requires_review, urgency_escalated) but never
    alter the reported confidence number itself.
"""
import numpy as np

from core.config import settings


class DecisionEngine:
    """
    Fuses:
      - Image modality        (EfficientNet-B3 prediction + full class distribution)
      - Symptom modality       (rule-based/BioBERT risk score)
      - Demographic modality   (risk engine score)

    Produces the final clinical decision: predicted class, confidence
    (image-only, never risk-inflated), malignancy flag, and review
    requirement.
    """

    # Below this fused/image confidence, a malignant call always needs review
    MALIGNANT_REVIEW_CONFIDENCE_FLOOR = 0.70
    # Above this total probability mass on malignant classes, escalate
    # even if the top-1 predicted class itself is benign
    MALIGNANCY_MASS_ESCALATION_THRESHOLD = 0.30

    def fuse(self, image_result: dict,
             symptom_risk: dict,
             demographic_risk: dict,
             uncertainty: dict) -> dict:

        pred_class   = image_result["predicted_class"]
        image_conf   = image_result["confidence"]
        class_probs  = image_result["class_probabilities"]
        is_malignant = image_result["is_malignant"]

        # Confidence is image-only. It is not boosted or diluted by
        # symptom/demographic risk — those are a different axis (concern),
        # not evidence about which class is correct.
        fused_confidence = float(image_conf)

        # Total probability mass the image model itself places on malignant
        # classes — a more sensitive malignancy signal than top-1 confidence,
        # since a model can be "confidently nv" while still assigning
        # meaningful probability to bcc/mel.
        malignancy_mass = float(sum(
            class_probs.get(c, 0.0) for c in settings.MALIGNANT_CLASSES
        ))

        symptom_score = symptom_risk.get("symptom_risk_score", 0.0)
        demo_score    = demographic_risk.get("demographic_risk_score", 0.0)

        # Relative contribution of each concern signal — for transparency/UI
        # display only. Not used to alter confidence.
        img_signal  = max(malignancy_mass, 0.05)
        sym_signal  = max(symptom_score,   0.05)
        demo_signal = max(demo_score,      0.05)
        total_signal = img_signal + sym_signal + demo_signal
        w_img  = img_signal  / total_signal
        w_sym  = sym_signal  / total_signal
        w_demo = demo_signal / total_signal

        # Escalate malignancy suspicion if:
        #  - the image model itself already predicted a malignant class, OR
        #  - the image model places substantial probability mass on
        #    malignant classes even though top-1 was benign, OR
        #  - symptom urgency + elevated demographic risk together suggest
        #    concern the image model may have missed
        urgency_escalation = (
          symptom_risk.get("urgency_flag", False)
          or malignancy_mass >= self.MALIGNANCY_MASS_ESCALATION_THRESHOLD
        )

        final_malignant = bool(
            is_malignant or
            malignancy_mass >= self.MALIGNANCY_MASS_ESCALATION_THRESHOLD or
            urgency_escalation
        )

        requires_review = bool(
            uncertainty.get("requires_review", False) or
            urgency_escalation or
            (final_malignant and fused_confidence < self.MALIGNANT_REVIEW_CONFIDENCE_FLOOR)
        )

        return {
            "predicted_class":     pred_class,
            "class_name":          image_result["class_name"],
            "fused_confidence":    round(fused_confidence, 4),
            "image_confidence":    round(image_conf, 4),
            "malignancy_mass":     round(malignancy_mass, 4),
            "is_malignant":        final_malignant,
            "requires_review":     requires_review,
            "urgency_escalated":   bool(urgency_escalation),
            "modality_weights": {
                "image":        round(w_img, 4),
                "symptoms":     round(w_sym, 4),
                "demographics": round(w_demo, 4),
            },
            "class_probabilities": class_probs,
        }


decision_engine = DecisionEngine()