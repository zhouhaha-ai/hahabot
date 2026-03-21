"""create chat tables

Revision ID: 20260321_01
Revises:
Create Date: 2026-03-21 12:10:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260321_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.Uuid(), sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "user",
                "assistant",
                "system",
                name="message_role",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_session_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    sa.Enum(name="message_role").drop(op.get_bind(), checkfirst=True)
