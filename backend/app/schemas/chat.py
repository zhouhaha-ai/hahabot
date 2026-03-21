from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str


class StreamStartEvent(BaseModel):
    session_id: UUID


class StreamDeltaEvent(BaseModel):
    text: str


class StreamDoneEvent(BaseModel):
    message_id: UUID
    session_id: UUID


class StreamErrorEvent(BaseModel):
    error: str
