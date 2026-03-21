from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.models import ChatMessage, ChatSession


def test_create_and_list_sessions(client):
    created = client.post("/api/sessions")
    listed = client.get("/api/sessions")

    assert created.status_code == 200
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == created.json()["id"]


def test_get_session_returns_messages(client, seeded_session):
    response = client.get(f"/api/sessions/{seeded_session.id}")

    assert response.status_code == 200
    assert response.json()["session"]["id"] == str(seeded_session.id)
    assert len(response.json()["messages"]) == 1


def test_list_sessions_prefers_recent_message_activity(client, db_session):
    now = datetime.now(timezone.utc)

    older_session = ChatSession(
        title="Older session",
        created_at=now - timedelta(days=2),
        updated_at=now - timedelta(days=2),
    )
    newer_session = ChatSession(
        title="Newer session",
        created_at=now - timedelta(days=1),
        updated_at=now - timedelta(days=1),
    )
    db_session.add_all([older_session, newer_session])
    db_session.flush()

    db_session.add(
        ChatMessage(
            session_id=older_session.id,
            role="user",
            content="Most recent activity happened here",
            sequence=1,
            created_at=now,
        )
    )
    db_session.commit()

    response = client.get("/api/sessions")

    assert response.status_code == 200
    assert response.json()[0]["id"] == str(older_session.id)


def test_delete_session_removes_messages(client, db_session, seeded_session):
    response = client.delete(f"/api/sessions/{seeded_session.id}")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert client.get(f"/api/sessions/{seeded_session.id}").status_code == 404
    assert db_session.get(ChatSession, seeded_session.id) is None
    remaining_messages = db_session.scalars(
        select(ChatMessage).where(ChatMessage.session_id == seeded_session.id)
    ).all()
    assert remaining_messages == []
