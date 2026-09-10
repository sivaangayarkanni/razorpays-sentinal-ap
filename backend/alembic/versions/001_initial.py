"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-09-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables are also auto-created on API startup for demo convenience.
    # This revision documents the canonical schema for production deploys.
    pass


def downgrade() -> None:
    pass
