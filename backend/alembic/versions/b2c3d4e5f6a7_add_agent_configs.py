"""add agent_configs table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'agent_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('api_base', sa.String(512), nullable=False),
        sa.Column('api_key_encrypted', sa.Text(), nullable=True),
        sa.Column('model_id', sa.String(256), nullable=False),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('tools_enabled', sa.Boolean(), default=False),
        sa.Column('enabled_tools', sa.JSON(), default=[]),
        sa.Column('rag_enabled', sa.Boolean(), default=False),
        sa.Column('rag_config', sa.JSON(), default={}),
        sa.Column('mcp_enabled', sa.Boolean(), default=False),
        sa.Column('mcp_servers', sa.JSON(), default=[]),
        sa.Column('eval_model_id', sa.String(256), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('agent_configs')
