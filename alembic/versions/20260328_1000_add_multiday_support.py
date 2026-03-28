"""add multi-day support: current_day to tournaments, day to lineups

Revision ID: 20260328_1000
Revises: f2a3b4c5d6e7
Create Date: 2026-03-28 10:00:00.000000

Adds support for multi-day lineup phases:
- tournaments.current_day (int, default=1): which competition day is open for lineups
- lineups.day (int, default=1): which day this lineup belongs to
- unique constraint uq_lineup_user_tournament_day on (user_id, tournament_id, day)
  replacing the code-only uniqueness check with a proper DB constraint.

Existing lineups default to day=1, existing tournaments default to current_day=1.
No data loss — fully backward compatible.
"""
from alembic import op
import sqlalchemy as sa

revision = '20260328_1000'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── tournaments.current_day ────────────────────────────────────────────
    tourn_cols = [row[0] for row in conn.execute(
        sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='tournaments'")
    ).fetchall()]
    if 'current_day' not in tourn_cols:
        op.add_column(
            'tournaments',
            sa.Column('current_day', sa.Integer(), nullable=False, server_default='1'),
        )

    # ── lineups.day ───────────────────────────────────────────────────────
    lineup_cols = [row[0] for row in conn.execute(
        sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='lineups'")
    ).fetchall()]
    if 'day' not in lineup_cols:
        op.add_column(
            'lineups',
            sa.Column('day', sa.Integer(), nullable=False, server_default='1'),
        )

    # ── unique constraint on (user_id, tournament_id, day) ───────────────
    constraints = [row[0] for row in conn.execute(
        sa.text("""
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'lineups'
              AND constraint_type = 'UNIQUE'
        """)
    ).fetchall()]
    if 'uq_lineup_user_tournament_day' not in constraints:
        op.create_unique_constraint(
            'uq_lineup_user_tournament_day',
            'lineups',
            ['user_id', 'tournament_id', 'day'],
        )


def downgrade() -> None:
    op.drop_constraint('uq_lineup_user_tournament_day', 'lineups', type_='unique')
    op.drop_column('lineups', 'day')
    op.drop_column('tournaments', 'current_day')
