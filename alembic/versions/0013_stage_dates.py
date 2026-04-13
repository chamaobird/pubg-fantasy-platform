"""add start_date and end_date to stage

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("stage", sa.Column("start_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("stage", sa.Column("end_date",   sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("stage", "end_date")
    op.drop_column("stage", "start_date")
