"""add championship_id to tournaments

Revision ID: 20260402_1000
Revises: 20260328_1000
Create Date: 2026-04-02 10:00:00.000000

Adds tournaments.championship_id (int, nullable, FK → championships.id).
Usado pelo sistema de repricing para identificar quais torneios pertencem
ao mesmo circuito (ex: PGS 2026 Circuit 1 = Winners Stage + Survival Stage + Grand Final).

Totalmente backward compatible — campo nullable, sem default obrigatório.
"""
from alembic import op
import sqlalchemy as sa

revision = '20260402_1000'
down_revision = '20260328_1000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Verifica se a coluna já existe antes de adicionar
    cols = [row[0] for row in conn.execute(
        sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='tournaments'")
    ).fetchall()]

    if 'championship_id' not in cols:
        op.add_column(
            'tournaments',
            sa.Column('championship_id', sa.Integer(), nullable=True),
        )

        # FK para championships se a tabela existir
        tables = [row[0] for row in conn.execute(
            sa.text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        ).fetchall()]

        if 'championships' in tables:
            op.create_foreign_key(
                'fk_tournaments_championship_id',
                'tournaments',
                'championships',
                ['championship_id'],
                ['id'],
                ondelete='SET NULL',
            )


def downgrade() -> None:
    conn = op.get_bind()

    tables = [row[0] for row in conn.execute(
        sa.text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    ).fetchall()]

    if 'championships' in tables:
        op.drop_constraint('fk_tournaments_championship_id', 'tournaments', type_='foreignkey')

    op.drop_column('tournaments', 'championship_id')
