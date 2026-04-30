"""fix oauth_code.user_id type INTEGER -> VARCHAR(36)

Revision ID: 0029
Revises: 0028
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tabela vazia em prod — drop/add é o caminho mais simples e seguro
    op.drop_column("oauth_code", "user_id")
    op.add_column("oauth_code", sa.Column("user_id", sa.String(36), nullable=False))


def downgrade() -> None:
    op.drop_column("oauth_code", "user_id")
    op.add_column("oauth_code", sa.Column("user_id", sa.Integer(), nullable=False))
