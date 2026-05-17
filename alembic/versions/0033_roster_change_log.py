"""roster_change_log: track adds/updates/removes on roster entries

Revision ID: 0033
Revises: 0032
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "roster_change_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("roster_id", sa.Integer, sa.ForeignKey("roster.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("stage_id", sa.Integer, sa.ForeignKey("stage.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("person_id", sa.Integer, sa.ForeignKey("person.id", ondelete="CASCADE"), nullable=False),
        sa.Column("change_type", sa.String(30), nullable=False),  # 'created' | 'updated' | 'removed'
        sa.Column("field_name", sa.String(60), nullable=True),   # e.g. 'is_available', 'team_name', 'cost_override'
        sa.Column("old_value", sa.Text, nullable=True),
        sa.Column("new_value", sa.Text, nullable=True),
        sa.Column("changed_by_id", sa.String(36), nullable=True),  # user.id (UUID string)
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("note", sa.String(200), nullable=True),
    )

def downgrade() -> None:
    op.drop_table("roster_change_log")
