from __future__ import annotations

from sqlalchemy import func, select

from app.db.models import ChatMessage, MessageRole


def count_assistant_messages(db_session, session_id) -> int:
    statement = select(func.count()).select_from(ChatMessage).where(
        ChatMessage.session_id == session_id,
        ChatMessage.role == MessageRole.ASSISTANT,
    )
    return db_session.scalar(statement) or 0


def test_stream_chat_emits_start_delta_done(client, db_session, seeded_session):
    response = client.post(
        f"/api/sessions/{seeded_session.id}/messages/stream",
        json={"message": "Hello"},
    )

    body = response.text

    assert response.status_code == 200
    assert "event: start" in body
    assert "event: delta" in body
    assert "event: done" in body
    assert count_assistant_messages(db_session, seeded_session.id) == 1


def test_failed_stream_does_not_persist_partial_assistant(client, db_session, seeded_session):
    response = client.post(
        f"/api/sessions/{seeded_session.id}/messages/stream",
        json={"message": "FAIL_STREAM"},
    )

    assert response.status_code == 200
    assert "event: error" in response.text
    assert count_assistant_messages(db_session, seeded_session.id) == 0
