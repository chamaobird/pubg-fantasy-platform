"""0003 pricing fields

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "4bfb4ef75223"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Championship: drop legacy pricing fields ──────────────────────────────
    op.drop_column("championship", "pricing_weight")
    op.drop_column("championship", "pricing_cap_newcomer")

    # ── Stage: add pricing + lineup_size fields ───────────────────────────────
    op.add_column(
        "stage",
        sa.Column(
            "lineup_size",
            sa.SmallInteger(),
            nullable=False,
            server_default="4",
            comment="Number of starters per lineup (reserves excluded)",
        ),
    )
    op.add_column(
        "stage",
        sa.Column(
            "price_min",
            sa.SmallInteger(),
            nullable=False,
            server_default="12",
            comment="Cost assigned to the lowest-performing player on the roster",
        ),
    )
    op.add_column(
        "stage",
        sa.Column(
            "price_max",
            sa.SmallInteger(),
            nullable=False,
            server_default="35",
            comment="Cost assigned to the highest-performing player on the roster",
        ),
    )
    op.add_column(
        "stage",
        sa.Column(
            "pricing_distribution",
            sa.String(20),
            nullable=False,
            server_default="'linear'",
            comment="Distribution model: linear | (future: sqrt, quadratic)",
        ),
    )
    op.add_column(
        "stage",
        sa.Column(
            "pricing_n_matches",
            sa.SmallInteger(),
            nullable=False,
            server_default="20",
            comment="How many recent MatchStats to average for pts_per_match_effective",
        ),
    )
    op.add_column(
        "stage",
        sa.Column(
            "pricing_newcomer_cost",
            sa.SmallInteger(),
            nullable=False,
            server_default="15",
            comment="Default cost for players with newcomer_to_tier=true or no match history",
        ),
    )


def downgrade() -> None:
    # ── Stage: remove pricing + lineup_size fields ────────────────────────────
    op.drop_column("stage", "lineup_size")
    op.drop_column("stage", "price_min")
    op.drop_column("stage", "price_max")
    op.drop_column("stage", "pricing_distribution")
    op.drop_column("stage", "pricing_n_matches")
    op.drop_column("stage", "pricing_newcomer_cost")

    # ── Championship: restore legacy pricing fields ───────────────────────────
    op.add_column(
        "championship",
        sa.Column(
            "pricing_weight",
            sa.Numeric(5, 4),
            nullable=False,
            server_default="1.0",
        ),
    )
    op.add_column(
        "championship",
        sa.Column("pricing_cap_newcomer", sa.Integer(), nullable=True),
    )
