"""
DERMAXAI — Clinical Report Generator
Produces structured PDF diagnostic reports combining the image,
Grad-CAM heatmap, fused decision, uncertainty metrics, and
clinical recommendations.
"""
import os
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer,
    Table, TableStyle, Image as RLImage, HRFlowable
)

from core.config import settings

TEAL  = colors.HexColor("#0EA5E9")
DARK  = colors.HexColor("#0F172A")
LIGHT = colors.HexColor("#F8FAFC")
RED   = colors.HexColor("#EF4444")
GREEN = colors.HexColor("#22C55E")
GRAY  = colors.HexColor("#64748B")


def generate_report(decision: dict, uncertainty: dict,
                     recommendation: dict, patient_data: dict,
                     gradcam_path: str, save_path: str) -> str:
    doc = SimpleDocTemplate(
        save_path, pagesize=A4,
        topMargin=1.5*cm, bottomMargin=1.5*cm,
        leftMargin=2*cm, rightMargin=2*cm)
    story = []

    title_style = ParagraphStyle("title", fontSize=22, textColor=TEAL,
                                  spaceAfter=4, alignment=TA_CENTER,
                                  fontName="Helvetica-Bold")
    sub_style   = ParagraphStyle("sub", fontSize=10, textColor=GRAY,
                                  spaceAfter=2, alignment=TA_CENTER)
    h2_style    = ParagraphStyle("h2", fontSize=13, textColor=DARK,
                                  spaceBefore=12, spaceAfter=4,
                                  fontName="Helvetica-Bold")
    body_style  = ParagraphStyle("body", fontSize=10, textColor=DARK,
                                  spaceAfter=4, leading=15)

    # ── Header ───────────────────────────────────────────
    story.append(Paragraph("DERMAXAI", title_style))
    story.append(Paragraph("AI-Powered Dermatological Diagnostic Report", sub_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}", sub_style))
    story.append(HRFlowable(width="100%", thickness=2, color=TEAL))
    story.append(Spacer(1, 0.4*cm))

    # ── Patient info ─────────────────────────────────────
    story.append(Paragraph("Patient Information", h2_style))
    pt_data = [
        ["Name", patient_data.get("name", "N/A"), "Age", str(patient_data.get("age", "N/A"))],
        ["Gender", patient_data.get("gender", "N/A"), "Skin Type", patient_data.get("skin_type", "N/A")],
        ["Date", datetime.now().strftime("%d/%m/%Y"), "Report ID", f"DX-{patient_data.get('diagnosis_id', '000')}"],
    ]
    pt_table = Table(pt_data, colWidths=[3*cm, 5.5*cm, 3*cm, 5.5*cm])
    pt_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), LIGHT),
        ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"),
        ("GRID", (0,0), (-1,-1), 0.5, colors.white),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [LIGHT, colors.white]),
        ("PADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(pt_table)
    story.append(Spacer(1, 0.4*cm))

    # ── Diagnosis result ─────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=GRAY))
    story.append(Paragraph("Diagnosis Result", h2_style))

    is_mal     = decision["is_malignant"]
    req_review = decision["requires_review"]

    result_data = [
        ["Predicted Class",     f"{decision['class_name']} ({decision['predicted_class'].upper()})"],
        ["Diagnostic Confidence", f"{decision['fused_confidence']*100:.1f}%"],
        ["Malignant Probability Mass", f"{decision.get('malignancy_mass', 0.0)*100:.1f}%"],
        ["Predictive Uncertainty (Entropy)",
            f"{uncertainty.get('raw_entropy', 0):.4f} nats  (calibrated threshold: {uncertainty.get('theta_H', 0):.4f})"],
        ["Uncertainty Level",  f"{uncertainty['composite_uncertainty']:.4f}  ({uncertainty['confidence_level']})"],
        ["Malignancy Risk",   "\u26a0 MALIGNANT — Urgent Referral Advised" if is_mal else "\u2713 BENIGN"],
        ["Review Status",     "REQUIRES CLINICAL REVIEW" if req_review else "Auto-Accepted"],
        ["Urgency Level",     recommendation["urgency_level"]],
    ]
    r_table = Table(result_data, colWidths=[6*cm, 11*cm])
    r_table.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("BACKGROUND", (0,0), (0,-1), LIGHT),
        ("BACKGROUND", (1,5), (1,5), RED if is_mal else GREEN),
        ("TEXTCOLOR", (1,5), (1,5), colors.white),
        ("FONTNAME", (1,5), (1,5), "Helvetica-Bold"),
        ("GRID", (0,0), (-1,-1), 0.5, colors.white),
        ("PADDING", (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [LIGHT, colors.white]),
    ]))
    story.append(r_table)
    story.append(Spacer(1, 0.4*cm))

    # ── Concern signal breakdown ──────────────────────────
    story.append(Paragraph("Concern Signal Breakdown", h2_style))
    story.append(Paragraph(
        "Relative contribution of each input signal to the escalation/review "
        "decision above. This is not a probability fusion across classes — "
        "only the image model predicts the lesion class. Symptom and "
        "demographic signals influence urgency and review, not the "
        "confidence figure reported above.", body_style))
    mw = decision["modality_weights"]

    model_name = settings.MODEL_NAME.replace("_", "-").title()

    mw_data = [
    ["Signal", "Relative Contribution"],
    [f"Image ({model_name}) malignancy mass", f"{mw['image']*100:.1f}%"],
    ["Symptom Analysis (BioBERT/NLP)", f"{mw['symptoms']*100:.1f}%"],
    ["Demographic Risk Factors", f"{mw['demographics']*100:.1f}%"],
]
    mw_table = Table(mw_data, colWidths=[10*cm, 7*cm])
    mw_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), DARK),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [LIGHT, colors.white]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.white),
        ("PADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(mw_table)
    story.append(Spacer(1, 0.4*cm))

    # ── Class probabilities ───────────────────────────────
    story.append(Paragraph("Class Probability Distribution", h2_style))
    probs = decision["class_probabilities"]
    prob_data = [["Class", "Probability", "Risk Level"]]
    for cls, prob in sorted(probs.items(), key=lambda x: -x[1]):
        risk = "Malignant" if cls in settings.MALIGNANT_CLASSES else "Benign"
        prob_data.append([cls.upper(), f"{prob*100:.2f}%", risk])
    p_table = Table(prob_data, colWidths=[5*cm, 6*cm, 6*cm])
    p_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), DARK),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [LIGHT, colors.white]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.white),
        ("PADDING", (0,0), (-1,-1), 6),
        ("ALIGN", (1,0), (1,-1), "CENTER"),
    ]))
    story.append(p_table)

    # ── Grad-CAM ──────────────────────────────────────────
    if gradcam_path and os.path.exists(gradcam_path):
        story.append(Spacer(1, 0.4*cm))
        story.append(Paragraph("Grad-CAM Visual Explanation", h2_style))
        story.append(Paragraph(
            "The heatmap highlights regions of the dermoscopic image that "
            "most influenced the AI prediction. Red/yellow areas indicate "
            "high diagnostic importance.", body_style))
        story.append(RLImage(gradcam_path, width=15*cm, height=7.5*cm))

    # ── Recommendations ───────────────────────────────────
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph("Clinical Recommendations", h2_style))
    story.append(Paragraph(recommendation["class_description"], body_style))
    for rec in recommendation["recommendations"]:
        story.append(Paragraph(f"\u2022 {rec}", body_style))
    story.append(Paragraph(
        f"Suggested follow-up window: {recommendation['follow_up_days']} days",
        body_style))

    # ── Disclaimer ────────────────────────────────────────
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=1, color=GRAY))
    story.append(Spacer(1, 0.2*cm))
    disclaimer = ParagraphStyle("disc", fontSize=8, textColor=GRAY,
                                 alignment=TA_CENTER, leading=12)
    story.append(Paragraph(
        "\u2695 DISCLAIMER: This report is generated by an AI diagnostic tool "
        "(DERMAXAI) and is intended for preliminary screening purposes "
        "only. It does not constitute a medical diagnosis. Always consult "
        "a qualified dermatologist for clinical decisions.", disclaimer))

    doc.build(story)
    return save_path