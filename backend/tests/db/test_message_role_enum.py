from __future__ import annotations

from app.db.models import ChatMessage, MessageRole


def test_message_role_enum_persists_lowercase_values():
    role_type = ChatMessage.__table__.c.role.type
    processor = role_type.bind_processor(None)

    assert role_type.enums == ["user", "assistant", "system"]
    assert processor is not None
    assert processor(MessageRole.USER) == "user"
