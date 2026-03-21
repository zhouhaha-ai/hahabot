from __future__ import annotations


def make_session_title(message: str, max_length: int = 30) -> str:
    normalized = " ".join(message.split())
    return normalized[:max_length]
