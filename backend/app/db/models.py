from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class MessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True, default=uuid4)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(Uuid(), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[MessageRole] = mapped_column(
        Enum(
            MessageRole,
            name="message_role",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        )
    )
    content: Mapped[str] = mapped_column(Text)
    sequence: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    session: Mapped[ChatSession] = relationship(back_populates="messages")
