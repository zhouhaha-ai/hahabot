from __future__ import annotations


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


def test_delete_session_removes_messages(client, seeded_session):
    response = client.delete(f"/api/sessions/{seeded_session.id}")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
