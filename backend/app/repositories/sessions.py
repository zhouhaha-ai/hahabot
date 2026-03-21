from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import ChatMessage, ChatSession


def create_chat_session(db: Session) -> ChatSession:
    session = ChatSession()
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def list_chat_sessions(db: Session) -> list[ChatSession]:
    latest_message_subquery = (
        select(
            ChatMessage.session_id,
            func.max(ChatMessage.created_at).label("latest_message_at"),
        )
        .group_by(ChatMessage.session_id)
        .subquery()
    )
    statement = (
        select(ChatSession)
        .outerjoin(
            latest_message_subquery,
            latest_message_subquery.c.session_id == ChatSession.id,
        )
        .order_by(
            func.coalesce(
                latest_message_subquery.c.latest_message_at,
                ChatSession.updated_at,
            ).desc(),
            ChatSession.created_at.desc(),
        )
    )
    return list(db.scalars(statement))


def get_chat_session(db: Session, session_id: UUID) -> ChatSession | None:
    return db.get(ChatSession, session_id)


def delete_chat_session(db: Session, session: ChatSession) -> None:
    db.delete(session)
    db.commit()


def update_chat_session_title(db: Session, session: ChatSession, title: str) -> ChatSession:
    session.title = title
    db.flush()
    return session
