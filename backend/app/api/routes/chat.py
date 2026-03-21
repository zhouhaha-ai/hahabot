from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.chat import ChatRequest
from app.services.chat_service import ChatService
from app.services.qwen_client import get_qwen_client

router = APIRouter()


@router.post("/{session_id}/messages/stream")
async def stream_chat(
    session_id: UUID,
    payload: ChatRequest,
    db: Session = Depends(get_db),
    qwen_client=Depends(get_qwen_client),
) -> StreamingResponse:
    service = ChatService(db, qwen_client)

    try:
        event_generator = service.stream_chat(session_id=session_id, user_message=payload.message)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return StreamingResponse(
        event_generator,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
