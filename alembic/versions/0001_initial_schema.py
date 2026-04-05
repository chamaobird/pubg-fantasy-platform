"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ------------------------------------------------------------------
    # CHAMPIONSHIP
    # ------------------------------------------------------------------
    op.create_table(
        "championship",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("short_name", sa.String(length=30), nullable=False),
        sa.Column(
            "shard",
            sa.String(length=30),
            nullable=False,
            comment="steam | pc-tournament",
        ),
        sa.Column(
            "pricing_weight",
            sa.Numeric(precision=5, scale=4),
            nullable=False,
            server_default="1.0",
            comment="Weight applied when this championship's stats feed future pricing",
        ),
        sa.Column(
            "pricing_cap_newcomer",
            sa.Integer(),
            nullable=True,
            comment="Max fantasy cost for players with newcomer_to_tier=true",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ------------------------------------------------------------------
    # STAGE
    # ------------------------------------------------------------------
    op.create_table(
        "stage",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("championship_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "shard",
            sa.String(length=30),
            nullable=False,
            comment="steam | pc-tournament — overrides championship default",
        ),
        sa.Column(
            "carries_stats_from",
            postgresql.ARRAY(sa.Integer()),
            nullable=True,
            comment="stage_ids whose stats feed pricing for this stage",
        ),
        sa.Column("lineup_open_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lineup_close_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "lineup_status",
            sa.String(length=10),
            nullable=False,
            server_default="closed",
            comment="closed | open | locked",
        ),
        sa.Column(
            "roster_source_stage_id",
            sa.Integer(),
            nullable=True,
            comment="Stage to copy base roster from",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["championship_id"], ["championship.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["roster_source_stage_id"], ["stage.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "lineup_status IN ('closed', 'open', 'locked')",
            name="ck_stage_lineup_status",
        ),
    )
    op.create_index("ix_stage_championship_id", "stage", ["championship_id"])

    # ------------------------------------------------------------------
    # STAGE_DAY
    # ------------------------------------------------------------------
    op.create_table(
        "stage_day",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stage_id", sa.Integer(), nullable=False),
        sa.Column("day_number", sa.SmallInteger(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column(
            "lineup_close_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Matches first match start time for this day",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["stage_id"], ["stage.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stage_id", "day_number", name="uq_stage_day"),
    )
    op.create_index("ix_stage_day_stage_id", "stage_day", ["stage_id"])

    # ------------------------------------------------------------------
    # MATCH
    # ------------------------------------------------------------------
    op.create_table(
        "match",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stage_day_id", sa.Integer(), nullable=False),
        sa.Column(
            "pubg_match_id",
            sa.String(length=60),
            nullable=False,
            comment="UUID from PUBG API",
        ),
        sa.Column(
            "shard",
            sa.String(length=30),
            nullable=False,
            comment="Inherited from Stage at import time",
        ),
        sa.Column("played_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["stage_day_id"], ["stage_day.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pubg_match_id", "shard", name="uq_match_pubg_shard"),
    )
    op.create_index("ix_match_stage_day_id", "match", ["stage_day_id"])

    # ------------------------------------------------------------------
    # PERSON
    # ------------------------------------------------------------------
    op.create_table(
        "person",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "display_name",
            sa.String(length=80),
            nullable=False,
            comment="Canonical name shown in the platform",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="Never deleted, only deactivated",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ------------------------------------------------------------------
    # PLAYER_ACCOUNT
    # ------------------------------------------------------------------
    op.create_table(
        "player_account",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.Column(
            "account_id",
            sa.String(length=80),
            nullable=False,
            comment="PUBG account_id from the API",
        ),
        sa.Column(
            "shard",
            sa.String(length=30),
            nullable=False,
            comment="steam | pc-tournament",
        ),
        sa.Column(
            "alias",
            sa.String(length=80),
            nullable=True,
            comment="Steam name or in-game alias at that time",
        ),
        sa.Column(
            "active_from",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "active_until",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="null = still active",
        ),
        sa.ForeignKeyConstraint(
            ["person_id"], ["person.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "account_id", "shard", "active_from", name="uq_player_account_shard_from"
        ),
    )
    op.create_index(
        "ix_player_account_account_id_shard",
        "player_account",
        ["account_id", "shard"],
    )
    op.create_index(
        "ix_player_account_person_id", "player_account", ["person_id"]
    )

    # ------------------------------------------------------------------
    # ROSTER
    # ------------------------------------------------------------------
    op.create_table(
        "roster",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stage_id", sa.Integer(), nullable=False),
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.Column(
            "team_name",
            sa.String(length=80),
            nullable=True,
            comment="Team name at the time of this stage",
        ),
        sa.Column(
            "fantasy_cost",
            sa.Integer(),
            nullable=True,
            comment="Calculated automatically by pricing service",
        ),
        sa.Column(
            "cost_override",
            sa.Integer(),
            nullable=True,
            comment="Manual override — used for display, does not block future calcs",
        ),
        sa.Column(
            "newcomer_to_tier",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="True = no history at this level, cap = championship.pricing_cap_newcomer",
        ),
        sa.Column(
            "is_available",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["stage_id"], ["stage.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["person_id"], ["person.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stage_id", "person_id", name="uq_roster_stage_person"),
    )
    op.create_index("ix_roster_stage_id", "roster", ["stage_id"])
    op.create_index("ix_roster_person_id", "roster", ["person_id"])

    # ------------------------------------------------------------------
    # ROSTER_PRICE_HISTORY
    # ------------------------------------------------------------------
    op.create_table(
        "roster_price_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("roster_id", sa.Integer(), nullable=False),
        sa.Column("stage_day_id", sa.Integer(), nullable=True),
        sa.Column("cost", sa.Integer(), nullable=False),
        sa.Column(
            "source",
            sa.String(length=20),
            nullable=False,
            comment="auto | override",
        ),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["roster_id"], ["roster.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["stage_day_id"], ["stage_day.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_roster_price_history_roster_id", "roster_price_history", ["roster_id"]
    )

    # ------------------------------------------------------------------
    # MATCH_STAT
    # ------------------------------------------------------------------
    op.create_table(
        "match_stat",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.Column(
            "account_id_used",
            sa.String(length=80),
            nullable=True,
            comment="Traceability: which player_account was resolved",
        ),
        # raw stats
        sa.Column("kills", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("assists", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("damage", sa.Numeric(precision=8, scale=2), nullable=False, server_default="0"),
        sa.Column("placement", sa.SmallInteger(), nullable=True),
        sa.Column("survival_time", sa.Integer(), nullable=True, comment="Seconds"),
        sa.Column("knocks", sa.SmallInteger(), nullable=False, server_default="0"),
        # computed
        sa.Column(
            "xama_points",
            sa.Numeric(precision=8, scale=2),
            nullable=True,
            comment="Points calculated by scoring service",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["match_id"], ["match.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["person_id"], ["person.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("match_id", "person_id", name="uq_match_stat_match_person"),
    )
    op.create_index("ix_match_stat_match_id", "match_stat", ["match_id"])
    op.create_index("ix_match_stat_person_id", "match_stat", ["person_id"])

    # ------------------------------------------------------------------
    # PERSON_STAGE_STAT
    # ------------------------------------------------------------------
    op.create_table(
        "person_stage_stat",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.Column("stage_id", sa.Integer(), nullable=False),
        sa.Column(
            "total_xama_points",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("matches_played", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column(
            "pts_per_match",
            sa.Numeric(precision=8, scale=4),
            nullable=True,
            comment="Main pricing metric: total_xama_points / matches_played",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["person_id"], ["person.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["stage_id"], ["stage.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "person_id", "stage_id", name="uq_person_stage_stat"
        ),
    )
    op.create_index(
        "ix_person_stage_stat_stage_id", "person_stage_stat", ["stage_id"]
    )

    # ------------------------------------------------------------------
    # LINEUP
    # ------------------------------------------------------------------
    op.create_table(
        "lineup",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "user_id",
            sa.String(length=60),
            nullable=False,
            comment="Auth user identifier (UUID string)",
        ),
        sa.Column("stage_day_id", sa.Integer(), nullable=False),
        sa.Column(
            "is_auto_replicated",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "is_valid",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="False if any player was removed after submission",
        ),
        sa.Column(
            "total_cost",
            sa.Integer(),
            nullable=True,
            comment="Sum of locked costs at lineup_close_at",
        ),
        sa.Column(
            "total_points",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Filled after day scoring",
        ),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["stage_day_id"], ["stage_day.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "stage_day_id", name="uq_lineup_user_day"),
    )
    op.create_index("ix_lineup_user_id", "lineup", ["user_id"])
    op.create_index("ix_lineup_stage_day_id", "lineup", ["stage_day_id"])

    # ------------------------------------------------------------------
    # LINEUP_PLAYER
    # ------------------------------------------------------------------
    op.create_table(
        "lineup_player",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lineup_id", sa.Integer(), nullable=False),
        sa.Column("roster_id", sa.Integer(), nullable=False),
        sa.Column(
            "slot_type",
            sa.String(length=10),
            nullable=False,
            comment="titular | reserve",
        ),
        sa.Column(
            "locked_cost",
            sa.Integer(),
            nullable=True,
            comment="fantasy_cost or cost_override at the moment of lock",
        ),
        sa.Column(
            "points_earned",
            sa.Numeric(precision=8, scale=2),
            nullable=True,
            comment="Points credited to user from this player on this day",
        ),
        sa.ForeignKeyConstraint(
            ["lineup_id"], ["lineup.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["roster_id"], ["roster.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lineup_id", "roster_id", name="uq_lineup_player"),
        sa.CheckConstraint(
            "slot_type IN ('titular', 'reserve')",
            name="ck_lineup_player_slot_type",
        ),
    )
    op.create_index("ix_lineup_player_lineup_id", "lineup_player", ["lineup_id"])

    # ------------------------------------------------------------------
    # USER_STAGE_STAT
    # ------------------------------------------------------------------
    op.create_table(
        "user_stage_stat",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=60), nullable=False),
        sa.Column("stage_id", sa.Integer(), nullable=False),
        sa.Column(
            "total_points",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("days_played", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column(
            "rank",
            sa.Integer(),
            nullable=True,
            comment="Position in stage leaderboard, updated after each day",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["stage_id"], ["stage.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "stage_id", name="uq_user_stage_stat"),
    )
    op.create_index("ix_user_stage_stat_stage_id", "user_stage_stat", ["stage_id"])
    op.create_index("ix_user_stage_stat_user_id", "user_stage_stat", ["user_id"])

    # ------------------------------------------------------------------
    # USER_DAY_STAT
    # ------------------------------------------------------------------
    op.create_table(
        "user_day_stat",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=60), nullable=False),
        sa.Column("stage_day_id", sa.Integer(), nullable=False),
        sa.Column(
            "points",
            sa.Numeric(precision=8, scale=2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "rank",
            sa.Integer(),
            nullable=True,
            comment="Position in day leaderboard",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["stage_day_id"], ["stage_day.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "stage_day_id", name="uq_user_day_stat"),
    )
    op.create_index(
        "ix_user_day_stat_stage_day_id", "user_day_stat", ["stage_day_id"]
    )
    op.create_index("ix_user_day_stat_user_id", "user_day_stat", ["user_id"])


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("user_day_stat")
    op.drop_table("user_stage_stat")
    op.drop_table("lineup_player")
    op.drop_table("lineup")
    op.drop_table("person_stage_stat")
    op.drop_table("match_stat")
    op.drop_table("roster_price_history")
    op.drop_table("roster")
    op.drop_table("player_account")
    op.drop_table("person")
    op.drop_table("match")
    op.drop_table("stage_day")
    op.drop_table("stage")
    op.drop_table("championship")
