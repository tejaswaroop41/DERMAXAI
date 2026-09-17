"""Add per-user token version for access-token revocation.

Revision ID: 0003_token_version
Revises: 0002_lesion_tracking
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_token_version"
down_revision = "0002_lesion_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )

    # SQLite is the supported application database. These triggers ensure that
    # security-sensitive changes made through existing query.update() code also
    # revoke previously issued JWTs without requiring every caller to remember
    # to increment the session generation manually.
    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_users_password_change_revoke_tokens
        AFTER UPDATE OF hashed_password ON users
        FOR EACH ROW
        WHEN OLD.hashed_password IS NOT NEW.hashed_password
        BEGIN
            UPDATE users
            SET token_version = COALESCE(token_version, 0) + 1
            WHERE id = NEW.id;
        END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_users_deactivation_revoke_tokens
        AFTER UPDATE OF is_active ON users
        FOR EACH ROW
        WHEN OLD.is_active IS NOT NEW.is_active AND NEW.is_active = 0
        BEGIN
            UPDATE users
            SET token_version = COALESCE(token_version, 0) + 1
            WHERE id = NEW.id;
        END;
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_users_deactivation_revoke_tokens")
    op.execute("DROP TRIGGER IF EXISTS trg_users_password_change_revoke_tokens")
    op.drop_column("users", "token_version")
