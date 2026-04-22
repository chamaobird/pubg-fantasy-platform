"""add team and team_member tables

Revision ID: 0019
Revises: 0018
Create Date: 2026-04-21
"""
import sqlalchemy as sa
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── team ──────────────────────────────────────────────────────────────────
    op.create_table(
        "team",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("tag", sa.String(10), nullable=False),
        sa.Column("region", sa.String(50), nullable=False),
        sa.Column("logo_path", sa.String(200), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_team_name"),
        sa.UniqueConstraint("tag", name="uq_team_tag"),
    )

    # ── team_member ───────────────────────────────────────────────────────────
    op.create_table(
        "team_member",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["team_id"], ["team.id"], name="fk_team_member_team"),
        sa.ForeignKeyConstraint(
            ["person_id"], ["person.id"], name="fk_team_member_person"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_team_member_team_id", "team_member", ["team_id"])
    op.create_index("ix_team_member_person_id", "team_member", ["person_id"])

    # Índice parcial — garante que cada pessoa está em no máximo 1 time ativo
    op.execute(
        """
        CREATE UNIQUE INDEX uq_team_member_active_person
        ON team_member (person_id)
        WHERE left_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_table("team_member")
    op.drop_table("team")
