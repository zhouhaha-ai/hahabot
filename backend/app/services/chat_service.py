from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import ChatMessage, ChatSession, MessageRole
from app.repositories.messages import create_message, get_next_sequence, list_messages_for_session
from app.repositories.sessions import get_chat_session, update_chat_session_title
from app.schemas.chat import StreamDeltaEvent, StreamDoneEvent, StreamErrorEvent, StreamStartEvent
from app.services.sse import format_sse
from app.services.title_service import make_session_title
from app.services.transcript_service import build_transcript


class ChatService:
    def __init__(self, db: Session, qwen_client) -> None:
        self._db = db
        self._qwen_client = qwen_client

    async def stream_chat(self, *, session_id: UUID, user_message: str) -> AsyncIterator[str]:
        session = self._require_session(session_id)
        normalized_message = user_message.strip()
        if not normalized_message:
            raise ValueError("Message must not be empty")

        user_record = self._persist_user_message(session, normalized_message)
        transcript = self._build_session_transcript(session.id)

        yield format_sse("start", StreamStartEvent(session_id=session.id).model_dump(mode="json"))

        assistant_chunks: list[str] = []
        try:
            async for delta in self._qwen_client.stream_response(transcript):
                assistant_chunks.append(delta)
                yield format_sse("delta", StreamDeltaEvent(text=delta).model_dump())
        except Exception:
            self._db.rollback()
            yield format_sse("error", StreamErrorEvent(error="Chat generation failed").model_dump())
            return

        assistant_record = create_message(
            self._db,
            session_id=session.id,
            role=MessageRole.ASSISTANT,
            content="".join(assistant_chunks),
            sequence=user_record.sequence + 1,
        )
        self._db.commit()
        self._db.refresh(assistant_record)

        yield format_sse(
            "done",
            StreamDoneEvent(message_id=assistant_record.id, session_id=session.id).model_dump(mode="json"),
        )

    def _require_session(self, session_id: UUID) -> ChatSession:
        session = get_chat_session(self._db, session_id)
        if session is None:
            raise LookupError("Session not found")
        return session

    def _persist_user_message(self, session: ChatSession, content: str) -> ChatMessage:
        sequence = get_next_sequence(self._db, session.id)
        message = create_message(
            self._db,
            session_id=session.id,
            role=MessageRole.USER,
            content=content,
            sequence=sequence,
        )
        if session.title is None:
            update_chat_session_title(self._db, session, make_session_title(content))
        self._db.commit()
        self._db.refresh(message)
        return message

    def _build_session_transcript(self, session_id: UUID) -> list[dict[str, str]]:
        messages = list_messages_for_session(self._db, session_id)
        payload = [
            {
                "role": message.role,
                "content": message.content,
                "sequence": message.sequence,
            }
            for message in messages
        ]
        return build_transcript(payload)
