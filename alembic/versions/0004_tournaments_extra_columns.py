"""tournaments extra columns

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-09 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_rules_json TEXT"
    )
    op.execute(
        "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS budget_limit NUMERIC(8,2) DEFAULT 100.0"
    )
    op.execute(
        "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS created_by INTEGER"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE tournaments DROP COLUMN IF EXISTS created_by")
    op.execute("ALTER TABLE tournaments DROP COLUMN IF EXISTS budget_limit")
    op.execute("ALTER TABLE tournaments DROP COLUMN IF EXISTS scoring_rules_json")
