"""user email verification fields

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

def upgrade():
    # email_verified já existe no banco via migration anterior — só adiciona o token
    op.add_column("user", sa.Column("email_verify_token", sa.String(), nullable=True))

def downgrade():
    op.drop_column("user", "email_verify_token")