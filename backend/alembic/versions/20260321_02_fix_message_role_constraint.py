"""fix message role constraint values

Revision ID: 20260321_02
Revises: 20260321_01
Create Date: 2026-03-21 14:50:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260321_02"
down_revision = "20260321_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE chat_messages
            SET role = lower(role)
            WHERE role IN ('USER', 'ASSISTANT', 'SYSTEM')
            """
        )
    )
    op.drop_constraint("message_role", "chat_messages", type_="check")
    op.create_check_constraint(
        "message_role",
        "chat_messages",
        "role IN ('user', 'assistant', 'system')",
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE chat_messages
            SET role = upper(role)
            WHERE role IN ('user', 'assistant', 'system')
            """
        )
    )
    op.drop_constraint("message_role", "chat_messages", type_="check")
    op.create_check_constraint(
        "message_role",
        "chat_messages",
        "role IN ('USER', 'ASSISTANT', 'SYSTEM')",
    )
