"""players nationality and tournament_id

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-09 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS nationality VARCHAR(50)")
    op.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS tournament_id INTEGER")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_players_tournament_id ON players (tournament_id)"
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_players_tournament_id'
          ) THEN
            ALTER TABLE players
              ADD CONSTRAINT fk_players_tournament_id
              FOREIGN KEY (tournament_id) REFERENCES tournaments(id);
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE players DROP CONSTRAINT IF EXISTS fk_players_tournament_id")
    op.execute("DROP INDEX IF EXISTS ix_players_tournament_id")
    op.execute("ALTER TABLE players DROP COLUMN IF EXISTS tournament_id")
    op.execute("ALTER TABLE players DROP COLUMN IF EXISTS nationality")
