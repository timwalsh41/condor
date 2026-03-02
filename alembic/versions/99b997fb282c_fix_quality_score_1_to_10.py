"""fix_quality_score_1_to_10

Revision ID: 99b997fb282c
Revises: fc559ec13c86
Create Date: 2026-02-28 22:25:53.421079

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '99b997fb282c'
down_revision: Union[str, Sequence[str], None] = 'fc559ec13c86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: fix quality_score check constraint to allow 1-10."""
    # Use IF EXISTS — constraint may not exist if the DB was created without it.
    op.execute("ALTER TABLE library_videos DROP CONSTRAINT IF EXISTS ck_quality_score")
    op.create_check_constraint(
        "ck_quality_score",
        "library_videos",
        "quality_score BETWEEN 1 AND 10",
    )


def downgrade() -> None:
    """Downgrade schema: revert quality_score check constraint to 1-5."""
    op.execute("ALTER TABLE library_videos DROP CONSTRAINT IF EXISTS ck_quality_score")
    op.create_check_constraint(
        "ck_quality_score",
        "library_videos",
        "quality_score BETWEEN 1 AND 5",
    )
