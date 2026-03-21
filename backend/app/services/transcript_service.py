from __future__ import annotations


def build_transcript(messages: list[dict]) -> list[dict[str, str]]:
    ordered_messages = sorted(messages, key=lambda item: item["sequence"])
    return [
        {
            "role": message["role"],
            "content": message["content"],
        }
        for message in ordered_messages
    ]
