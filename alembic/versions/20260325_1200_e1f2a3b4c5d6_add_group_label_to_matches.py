"""add group_label to matches

Revision ID: e1f2a3b4c5d6
Revises: d5e6f7a8b9c0
Create Date: 2026-03-25 12:00:00

Adds group_label (nullable VARCHAR 10) to the matches table.
Used to distinguish parallel match groups within a tournament day
(e.g. "A", "B", "C", "D" for PAS scrim weeks with multiple groups).
NULL means the match was played in a single-group / no-group format.
"""
from alembic import op
import sqlalchemy as sa

revision = 'e1f2a3b4c5d6'
down_revision = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("matches") as batch_op:
        batch_op.add_column(
            sa.Column("group_label", sa.String(10), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("matches") as batch_op:
        batch_op.drop_column("group_label")
