"""Add patient-owned lesion tracking.

Revision ID: 0002_lesion_tracking
Revises: 0001_initial_schema
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_lesion_tracking"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lesions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("body_site", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lesions_id", "lesions", ["id"], unique=False)
    op.create_index("ix_lesions_user_id", "lesions", ["user_id"], unique=False)

    with op.batch_alter_table("diagnoses") as batch_op:
        batch_op.add_column(sa.Column("lesion_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_diagnoses_lesion_id", ["lesion_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_diagnoses_lesion_id",
            "lesions",
            ["lesion_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("diagnoses") as batch_op:
        batch_op.drop_constraint("fk_diagnoses_lesion_id", type_="foreignkey")
        batch_op.drop_index("ix_diagnoses_lesion_id")
        batch_op.drop_column("lesion_id")

    op.drop_index("ix_lesions_user_id", table_name="lesions")
    op.drop_index("ix_lesions_id", table_name="lesions")
    op.drop_table("lesions")
