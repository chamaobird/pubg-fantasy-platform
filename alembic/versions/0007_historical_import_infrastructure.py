"""historical import infrastructure — pricing fields on players

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-11 00:00:00.000000

What this migration does
────────────────────────
The Match and MatchPlayerStat tables were created in earlier migrations
(0004/0005). This migration adds the pricing-related columns to the
players table that the recalculate-prices service will populate, and
ensures the match_player_stats table has all the columns our new
import service expects.

Columns added to `players`
  - avg_kills_50       FLOAT  (rolling average, last 50 matches)
  - avg_damage_50      FLOAT
  - avg_placement_50   FLOAT
  - avg_kills_10       FLOAT  (form window, last 10 matches)
  - computed_price     FLOAT  (output of pricing formula, pre-clamp)
  - price_updated_at   TIMESTAMPTZ  (when prices were last recalculated)

All statements use IF NOT EXISTS so this is safe to re-run.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Pricing stat columns on players ────────────────────────────────
    # These are populated by POST /players/recalculate-prices/{tournament_id}.
    # Kept separate from the live avg_kills/avg_damage/avg_placement columns
    # that the existing scoring engine updates, so both systems can evolve
    # independently.
    op.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_kills_50     FLOAT DEFAULT 0.0")
    op.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_damage_50    FLOAT DEFAULT 0.0")
    op.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_placement_50 FLOAT DEFAULT 0.0")
    op.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_kills_10     FLOAT DEFAULT 0.0")
    op.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS computed_price   FLOAT DEFAULT 0.0")
    op.execute(
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS price_updated_at "
        "TIMESTAMP WITH TIME ZONE DEFAULT NULL"
    )

    # ── 2. Safety-net: ensure match_player_stats has knocks + headshots ───
    # These exist in models.py but may be missing if the table was created
    # before those columns were added to the model. Safe no-ops if present.
    op.execute("ALTER TABLE match_player_stats ADD COLUMN IF NOT EXISTS headshots INTEGER DEFAULT 0")
    op.execute("ALTER TABLE match_player_stats ADD COLUMN IF NOT EXISTS knocks    INTEGER DEFAULT 0")


def downgrade() -> None:
    op.execute("ALTER TABLE players DROP COLUMN IF EXISTS price_updated_at")
    op.execute("ALTER TABLE players DROP COLUMN IF EXISTS computed_price")
    op.execute("ALTER TABLE players DROP COLUMN IF EXISTS avg_kills_10")
    op.execute("ALTER TABLE players DROP COLUMN IF EXISTS avg_placement_50")
    op.execute("ALTER TABLE players DROP COLUMN IF EXISTS avg_damage_50")
    op.execute("ALTER TABLE players DROP COLUMN IF EXISTS avg_kills_50")

    op.execute("ALTER TABLE match_player_stats DROP COLUMN IF EXISTS knocks")
    op.execute("ALTER TABLE match_player_stats DROP COLUMN IF EXISTS headshots")
