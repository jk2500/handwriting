"""Add enhancement columns to segmentations

Revision ID: a1b2c3d4e5f6
Revises: 9e1fd4100675
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '9e1fd4100675'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('segmentations', sa.Column('enhanced_s3_path', sa.String(), nullable=True))
    op.add_column('segmentations', sa.Column('use_enhanced', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('segmentations', 'use_enhanced')
    op.drop_column('segmentations', 'enhanced_s3_path')
