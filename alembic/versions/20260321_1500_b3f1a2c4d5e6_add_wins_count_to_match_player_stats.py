"""add wins_count to match_player_stats

Revision ID: b3f1a2c4d5e6
Revises: b2c3d4e5f6a1
Create Date: 2026-03-21 15:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = 'b3f1a2c4d5e6'
down_revision = 'b2c3d4e5f6a1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    existing_cols = [c["name"] for c in inspector.get_columns("match_player_stats")]

    if "wins_count" not in existing_cols:
        op.add_column(
            "match_player_stats",
            sa.Column(
                "wins_count",
                sa.Integer(),
                server_default="0",
                nullable=False,
            ),
        )
        op.execute(
            "UPDATE match_player_stats "
            "SET wins_count = CASE WHEN placement = 1 THEN 1 ELSE 0 END"
        )


def downgrade() -> None:
    op.drop_column("match_player_stats", "wins_count")
