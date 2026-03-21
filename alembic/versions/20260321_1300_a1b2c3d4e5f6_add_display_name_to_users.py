"""add_display_name_to_users

Revision ID: a1b2c3d4e5f6
Revises: 2870059da34f
Create Date: 2026-03-21 13:00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '2870059da34f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Guard: só adiciona se a coluna ainda não existir
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('users')]
    if 'display_name' not in columns:
        op.add_column(
            'users',
            sa.Column('display_name', sa.String(100), nullable=True),
        )


def downgrade() -> None:
    op.drop_column('users', 'display_name')
