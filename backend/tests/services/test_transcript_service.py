from app.services.transcript_service import build_transcript


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
