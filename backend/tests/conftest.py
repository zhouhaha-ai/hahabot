from __future__ import annotations

import sys
from pathlib import Path

import pytest


BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Base, ChatMessage, ChatSession, MessageRole
from app.db.session import get_db
from app.main import app
from app.services.qwen_client import get_qwen_client


class FakeQwenClient:
    async def stream_response(self, messages: list[dict[str, str]]):
        prompt = messages[-1]["content"]
        if prompt == "FAIL_STREAM":
            raise RuntimeError("synthetic stream failure")

        for chunk in ("Hi", " there"):
            yield chunk


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)

    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session: Session) -> TestClient:
    def override_get_db():
        yield db_session

    def override_qwen_client():
        return FakeQwenClient()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_qwen_client] = override_qwen_client
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def seeded_session(db_session: Session) -> ChatSession:
    session = ChatSession(title="Existing session")
    db_session.add(session)
    db_session.flush()

    message = ChatMessage(
        session_id=session.id,
        role=MessageRole.USER,
        content="How should I deploy this?",
        sequence=1,
    )
    db_session.add(message)
    db_session.commit()
    db_session.refresh(session)
    return session
