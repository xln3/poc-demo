"""add reports and report_history tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-27 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reports',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(512), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('scenario_type', sa.String(64), nullable=False, server_default='single_agent'),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('source_data', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('metadata_json', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('status', sa.String(32), nullable=False, server_default='draft'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'report_history',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('report_id', sa.String(36), sa.ForeignKey('reports.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('change_summary', sa.String(512), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_report_history_report_version', 'report_history', ['report_id', 'version'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_report_history_report_version', table_name='report_history')
    op.drop_table('report_history')
    op.drop_table('reports')
