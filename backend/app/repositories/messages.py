from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import ChatMessage, MessageRole


def list_messages_for_session(db: Session, session_id: UUID) -> list[ChatMessage]:
    statement = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.sequence.asc(), ChatMessage.created_at.asc())
    )
    return list(db.scalars(statement))


def get_next_sequence(db: Session, session_id: UUID) -> int:
    statement = select(func.max(ChatMessage.sequence)).where(ChatMessage.session_id == session_id)
    current_max = db.scalar(statement)
    return 1 if current_max is None else current_max + 1


def create_message(
    db: Session,
    *,
    session_id: UUID,
    role: MessageRole,
    content: str,
    sequence: int,
) -> ChatMessage:
    message = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        sequence=sequence,
    )
    db.add(message)
    db.flush()
    return message
