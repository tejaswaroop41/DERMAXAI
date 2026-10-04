"""Remove misleading fused confidence column.

Revision ID: 0004_image_confidence
Revises: 0003_token_version
"""
from alembic import op
import sqlalchemy as sa


revision = "0004_image_confidence"
down_revision = "0003_token_version"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # image_confidence already exists and is the canonical value. The old
    # fused_confidence column duplicated it and incorrectly implied that CMCA
    # produced a fused class-confidence score.
    with op.batch_alter_table("diagnoses") as batch_op:
        batch_op.drop_column("fused_confidence")


def downgrade() -> None:
    with op.batch_alter_table("diagnoses") as batch_op:
        batch_op.add_column(sa.Column("fused_confidence", sa.Float(), nullable=True))
