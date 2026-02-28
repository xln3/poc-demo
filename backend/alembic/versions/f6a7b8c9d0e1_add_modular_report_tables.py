"""add modular report tables (outline, modules) and generation_mode column

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-02-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add generation_mode to reports
    op.add_column('reports', sa.Column(
        'generation_mode', sa.String(16), nullable=False, server_default='legacy'
    ))

    # Create report_outlines table
    op.create_table(
        'report_outlines',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('report_id', sa.String(36),
                  sa.ForeignKey('reports.id', ondelete='CASCADE'),
                  nullable=False, unique=True),
        sa.Column('outline_json', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('status', sa.String(16), nullable=False, server_default='draft'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    # Create report_modules table
    op.create_table(
        'report_modules',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('report_id', sa.String(36),
                  sa.ForeignKey('reports.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('title', sa.String(512), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('status', sa.String(16), nullable=False, server_default='pending'),
        sa.Column('depends_on', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('data_keys', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('chart_configs', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('generation_meta', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index(
        'ix_report_modules_report_order',
        'report_modules',
        ['report_id', 'order_index'],
    )


def downgrade() -> None:
    op.drop_index('ix_report_modules_report_order', table_name='report_modules')
    op.drop_table('report_modules')
    op.drop_table('report_outlines')
    op.drop_column('reports', 'generation_mode')
