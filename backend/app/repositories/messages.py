from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ChatMessage


def list_messages_for_session(db: Session, session_id: UUID) -> list[ChatMessage]:
    statement = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.sequence.asc(), ChatMessage.created_at.asc())
    )
    return list(db.scalars(statement))
