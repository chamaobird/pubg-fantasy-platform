"""lineup_scores table and match/lineup extra columns

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-10 00:00:00.000000

Changes on top of 0005:
  matches:       + match_number (INT), phase (VARCHAR 50), day (INT), results_json (TEXT)
  lineups:       + total_points (NUMERIC 10,2  NOT NULL DEFAULT 0)
  lineup_scores: new table — per-Lineup per-Match aggregated fantasy score

All ALTER TABLE statements use ADD COLUMN IF NOT EXISTS and create_table uses
if_not_exists=True, so this is safe to run against any DB state from 0001–0005.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Extra columns on matches ────────────────────────────────────────
    op.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_number INTEGER")
    op.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS phase        VARCHAR(50)")
    op.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS day          INTEGER")
    op.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS results_json TEXT")

    # ── 2. total_points on lineups ─────────────────────────────────────────
    op.execute(
        "ALTER TABLE lineups ADD COLUMN IF NOT EXISTS total_points NUMERIC(10,2) NOT NULL DEFAULT 0"
    )

    # ── 3. lineup_scores (new table) ───────────────────────────────────────
    op.create_table(
        "lineup_scores",
        sa.Column("id",                sa.Integer(),                     nullable=False),
        sa.Column("lineup_id",         sa.Integer(),                     nullable=False),
        sa.Column("match_id",          sa.Integer(),                     nullable=False),
        sa.Column("base_points",       sa.Numeric(10, 2), server_default="0.0",   nullable=False),
        sa.Column("captain_bonus",     sa.Numeric(10, 2), server_default="0.0",   nullable=False),
        sa.Column("reserve_points",    sa.Numeric(10, 2), server_default="0.0",   nullable=False),
        sa.Column("reserve_activated", sa.Boolean(),      server_default="false", nullable=False),
        sa.Column("final_points",      sa.Numeric(10, 2), server_default="0.0",   nullable=False),
        sa.Column("scored_at",         sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["lineup_id"], ["lineups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["match_id"],  ["matches.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("lineup_id", "match_id", name="uq_lineup_match_score"),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index("ix_lineup_scores_lineup_id",    "lineup_scores", ["lineup_id"],    unique=False, if_not_exists=True)
    op.create_index("ix_lineup_scores_match_id",     "lineup_scores", ["match_id"],     unique=False, if_not_exists=True)
    op.create_index("ix_lineup_scores_final_points", "lineup_scores", ["final_points"], unique=False, if_not_exists=True)


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("lineup_scores")

    op.execute("ALTER TABLE lineups DROP COLUMN IF EXISTS total_points")

    op.execute("ALTER TABLE matches DROP COLUMN IF EXISTS results_json")
    op.execute("ALTER TABLE matches DROP COLUMN IF EXISTS day")
    op.execute("ALTER TABLE matches DROP COLUMN IF EXISTS phase")
    op.execute("ALTER TABLE matches DROP COLUMN IF EXISTS match_number")
