from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.messages import list_messages_for_session
from app.repositories.sessions import (
    create_chat_session,
    delete_chat_session,
    get_chat_session,
    list_chat_sessions,
)
from app.schemas.session import SessionDetail, SessionMessage, SessionSummary

router = APIRouter()


@router.post("", response_model=SessionSummary)
def create_session(db: Session = Depends(get_db)) -> SessionSummary:
    session = create_chat_session(db)
    return SessionSummary.model_validate(session)


@router.get("", response_model=list[SessionSummary])
def list_sessions(db: Session = Depends(get_db)) -> list[SessionSummary]:
    sessions = list_chat_sessions(db)
    return [SessionSummary.model_validate(session) for session in sessions]


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(session_id: UUID, db: Session = Depends(get_db)) -> SessionDetail:
    session = get_chat_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = list_messages_for_session(db, session_id)
    return SessionDetail(
        session=SessionSummary.model_validate(session),
        messages=[SessionMessage.model_validate(message) for message in messages],
    )


@router.delete("/{session_id}")
def delete_session(session_id: UUID, db: Session = Depends(get_db)) -> dict[str, bool]:
    session = get_chat_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    delete_chat_session(db, session)
    return {"ok": True}
