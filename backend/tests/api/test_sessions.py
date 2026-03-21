from __future__ import annotations

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
