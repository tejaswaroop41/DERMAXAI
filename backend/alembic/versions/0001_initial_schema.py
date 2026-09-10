"""Initial DERMAXAI schema.

Revision ID: 0001_initial_schema
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("password_reset_nonce_hash", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "patients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("gender", sa.String(), nullable=True),
        sa.Column("skin_type", sa.String(), nullable=True),
        sa.Column("medical_history", sa.Text(), nullable=True),
        sa.Column("sun_exposure", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_patients_user_id"),
    )
    op.create_index("ix_patients_id", "patients", ["id"], unique=False)

    op.create_table(
        "diagnoses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("patient_id", sa.Integer(), nullable=True),
        sa.Column("image_path", sa.String(), nullable=True),
        sa.Column("symptoms", sa.Text(), nullable=True),
        sa.Column("predicted_class", sa.String(), nullable=True),
        sa.Column("fused_confidence", sa.Float(), nullable=True),
        sa.Column("image_confidence", sa.Float(), nullable=True),
        sa.Column("is_malignant", sa.Boolean(), nullable=True),
        sa.Column("requires_review", sa.Boolean(), nullable=True),
        sa.Column("urgency_escalated", sa.Boolean(), nullable=True),
        sa.Column("aleatory_uncertainty", sa.Float(), nullable=True),
        sa.Column("epistemic_uncertainty", sa.Float(), nullable=True),
        sa.Column("fusion_uncertainty", sa.Float(), nullable=True),
        sa.Column("composite_uncertainty", sa.Float(), nullable=True),
        sa.Column("symptom_risk_score", sa.Float(), nullable=True),
        sa.Column("demographic_risk_score", sa.Float(), nullable=True),
        sa.Column("gradcam_path", sa.String(), nullable=True),
        sa.Column("report_path", sa.String(), nullable=True),
        sa.Column("class_probs", sa.Text(), nullable=True),
        sa.Column("modality_weights", sa.Text(), nullable=True),
        sa.Column("abcd_features", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_diagnoses_id", "diagnoses", ["id"], unique=False)

    op.create_table(
        "doctor_reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("diagnosis_id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("verdict", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("claimed_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("patient_viewed", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["diagnosis_id"], ["diagnoses.id"]),
        sa.ForeignKeyConstraint(["doctor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("diagnosis_id"),
    )
    op.create_index("ix_doctor_reviews_id", "doctor_reviews", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_doctor_reviews_id", table_name="doctor_reviews")
    op.drop_table("doctor_reviews")
    op.drop_index("ix_diagnoses_id", table_name="diagnoses")
    op.drop_table("diagnoses")
    op.drop_index("ix_patients_id", table_name="patients")
    op.drop_table("patients")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
