from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import ChatMessage, ChatSession, MessageRole
from app.repositories.messages import list_messages_for_session
from app.repositories.sessions import get_chat_session
from app.schemas.chat import StreamDeltaEvent, StreamDoneEvent, StreamErrorEvent, StreamStartEvent
from app.services.sse import format_sse
from app.services.title_service import make_session_title
from app.services.transcript_service import build_transcript


class ChatService:
    def __init__(self, db: Session, qwen_client) -> None:
        self._db = db
        self._qwen_client = qwen_client

    async def stream_chat(self, *, session_id: UUID, user_message: str) -> AsyncIterator[str]:
        session, normalized_message = self.prepare_stream(session_id=session_id, user_message=user_message)

        user_record = self._persist_user_message(session, normalized_message)
        transcript = self._build_session_transcript(session.id)

        yield format_sse("start", StreamStartEvent(session_id=session.id).model_dump(mode="json"))

        assistant_chunks: list[str] = []
        try:
            async for delta in self._qwen_client.stream_response(transcript):
                assistant_chunks.append(delta)
                yield format_sse("delta", StreamDeltaEvent(text=delta).model_dump())
        except Exception:
            yield format_sse("error", StreamErrorEvent(error="Chat generation failed").model_dump())
            return

        assistant_record = self._create_message(
            session_id=session.id,
            role=MessageRole.ASSISTANT,
            content="".join(assistant_chunks),
            sequence=self._next_sequence(session.id),
        )
        self._db.commit()
        self._db.refresh(assistant_record)

        yield format_sse(
            "done",
            StreamDoneEvent(message_id=assistant_record.id, session_id=session.id).model_dump(mode="json"),
        )

    def prepare_stream(self, *, session_id: UUID, user_message: str) -> tuple[ChatSession, str]:
        session = self._require_session(session_id)
        normalized_message = user_message.strip()
        if not normalized_message:
            raise ValueError("Message must not be empty")
        return session, normalized_message

    def _require_session(self, session_id: UUID) -> ChatSession:
        session = get_chat_session(self._db, session_id)
        if session is None:
            raise LookupError("Session not found")
        return session

    def _persist_user_message(self, session: ChatSession, content: str) -> ChatMessage:
        sequence = self._next_sequence(session.id)
        message = self._create_message(
            session_id=session.id,
            role=MessageRole.USER,
            content=content,
            sequence=sequence,
        )
        if session.title is None:
            session.title = make_session_title(content)
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

    def _next_sequence(self, session_id: UUID) -> int:
        statement = select(func.max(ChatMessage.sequence)).where(ChatMessage.session_id == session_id)
        current_max = self._db.scalar(statement)
        return 1 if current_max is None else current_max + 1

    def _create_message(
        self,
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
        self._db.add(message)
        self._db.flush()
        return message
