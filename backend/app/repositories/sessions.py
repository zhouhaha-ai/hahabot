from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ChatSession


def create_chat_session(db: Session) -> ChatSession:
    session = ChatSession()
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def list_chat_sessions(db: Session) -> list[ChatSession]:
    statement = select(ChatSession).order_by(ChatSession.updated_at.desc(), ChatSession.created_at.desc())
    return list(db.scalars(statement))


def get_chat_session(db: Session, session_id: UUID) -> ChatSession | None:
    return db.get(ChatSession, session_id)


def delete_chat_session(db: Session, session: ChatSession) -> None:
    db.delete(session)
    db.commit()
