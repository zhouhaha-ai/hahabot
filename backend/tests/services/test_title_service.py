from __future__ import annotations

from app.services.title_service import make_session_title


def test_title_uses_trimmed_first_message():
    assert make_session_title("   Hello   world from user   ") == "Hello world from user"


def test_title_truncates_long_messages():
    title = make_session_title("a" * 80)

    assert len(title) <= 30
