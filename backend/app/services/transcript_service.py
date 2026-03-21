from __future__ import annotations


def build_transcript(messages: list[dict]) -> list[dict[str, str]]:
    ordered_messages = sorted(messages, key=lambda item: item["sequence"])
    return [
        {
            "role": _normalize_role(message["role"]),
            "content": message["content"],
        }
        for message in ordered_messages
    ]


def _normalize_role(role: object) -> str:
    if hasattr(role, "value"):
        return str(role.value)
    return str(role)
