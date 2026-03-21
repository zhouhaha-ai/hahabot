from app.services.transcript_service import build_transcript
from app.db.models import MessageRole


def test_messages_are_sorted_by_sequence():
    messages = [
        {"role": "assistant", "content": "second", "sequence": 2},
        {"role": "user", "content": "first", "sequence": 1},
    ]

    ordered = build_transcript(messages)

    assert ordered == [
        {"role": "user", "content": "first"},
        {"role": "assistant", "content": "second"},
    ]


def test_transcript_keeps_only_role_and_content():
    messages = [
        {
            "role": MessageRole.USER,
            "content": "hello",
            "sequence": 1,
            "id": "ignore-me",
        }
    ]

    assert build_transcript(messages) == [{"role": "user", "content": "hello"}]
