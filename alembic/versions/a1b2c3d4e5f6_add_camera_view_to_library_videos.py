"""add_camera_view_to_library_videos

Revision ID: a1b2c3d4e5f6
Revises: 99b997fb282c
Create Date: 2026-04-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '99b997fb282c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add camera_view column to library_videos."""
    op.add_column(
        'library_videos',
        sa.Column('camera_view', sa.String(length=20), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema: remove camera_view column from library_videos."""
    op.drop_column('library_videos', 'camera_view')
