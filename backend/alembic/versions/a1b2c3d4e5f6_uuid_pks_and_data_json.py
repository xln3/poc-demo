"""uuid pks and data_json for cases/datasets/test_results

Revision ID: a1b2c3d4e5f6
Revises: 75b0d57c3307
Create Date: 2026-02-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '75b0d57c3307'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop child tables first (FK dependencies), then parent tables.
    # These tables are empty — no data loss.
    op.drop_table('test_result_entries')
    op.drop_table('test_results')
    op.drop_table('dataset_cases')
    op.drop_table('test_cases')
    op.drop_table('datasets')

    # Recreate with String(36) UUID PKs and document-in-column design
    op.create_table(
        'test_cases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('scenario_key', sa.String(64), nullable=True),
        sa.Column('attack_id', sa.String(64), nullable=True),
        sa.Column('attack_type', sa.String(32), nullable=True),
        sa.Column('capability_level', sa.String(32), nullable=True),
        sa.Column('payload', sa.Text(), nullable=True),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('threat_class', sa.String(16), nullable=True),
        sa.Column('risk_item_id', sa.Integer(), nullable=True),
        sa.Column('data_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
    )
    op.create_index('ix_test_cases_attack_type', 'test_cases', ['attack_type'])
    op.create_index('ix_test_cases_created_at', 'test_cases', ['created_at'])

    op.create_table(
        'datasets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('capability_level', sa.String(32), nullable=True),
        sa.Column('case_count', sa.Integer(), default=0),
        sa.Column('total_size', sa.Integer(), default=0),
        sa.Column('data_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
    )
    op.create_index('ix_datasets_created_at', 'datasets', ['created_at'])

    op.create_table(
        'test_results',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('status', sa.String(32), nullable=True),
        sa.Column('source_type', sa.String(32), nullable=True),
        sa.Column('data_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
    )
    op.create_index('ix_test_results_created_at', 'test_results', ['created_at'])


def downgrade() -> None:
    # Drop new tables
    op.drop_index('ix_test_results_created_at', table_name='test_results')
    op.drop_table('test_results')
    op.drop_index('ix_datasets_created_at', table_name='datasets')
    op.drop_table('datasets')
    op.drop_index('ix_test_cases_attack_type', table_name='test_cases')
    op.drop_index('ix_test_cases_created_at', table_name='test_cases')
    op.drop_table('test_cases')

    # Recreate old tables with Integer PKs
    op.create_table(
        'test_cases',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('scenario_key', sa.String(64), nullable=True),
        sa.Column('attack_id', sa.String(64), nullable=True),
        sa.Column('attack_type', sa.String(32), nullable=True),
        sa.Column('payload', sa.Text(), nullable=True),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('data_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
    )
    op.create_table(
        'datasets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('capability_level', sa.String(32), nullable=True),
        sa.Column('data_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
    )
    op.create_table(
        'dataset_cases',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('dataset_id', sa.Integer(), sa.ForeignKey('datasets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('test_case_id', sa.Integer(), sa.ForeignKey('test_cases.id'), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=True),
    )
    op.create_table(
        'test_results',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('dataset_id', sa.Integer(), sa.ForeignKey('datasets.id'), nullable=True),
        sa.Column('status', sa.String(32), nullable=True),
        sa.Column('summary_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
    )
    op.create_table(
        'test_result_entries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('test_result_id', sa.Integer(), sa.ForeignKey('test_results.id', ondelete='CASCADE'), nullable=False),
        sa.Column('test_case_id', sa.Integer(), sa.ForeignKey('test_cases.id'), nullable=True),
        sa.Column('attack_name', sa.String(256), nullable=True),
        sa.Column('model_id', sa.String(128), nullable=True),
        sa.Column('response', sa.Text(), nullable=True),
        sa.Column('judgment', sa.JSON(), nullable=True),
        sa.Column('timing_json', sa.JSON(), nullable=True),
        sa.Column('token_usage_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
