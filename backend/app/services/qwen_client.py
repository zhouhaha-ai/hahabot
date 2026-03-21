from __future__ import annotations

from functools import lru_cache
from typing import AsyncIterator

from openai import AsyncOpenAI

from app.core.config import get_settings


class QwenClient:
    def __init__(self, *, api_key: str, base_url: str, model: str) -> None:
        self._model = model
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    async def stream_response(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        stream = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield delta


@lru_cache(maxsize=1)
def get_qwen_client() -> QwenClient:
    settings = get_settings()
    return QwenClient(
        api_key=settings.qwen_api_key,
        base_url=settings.qwen_base_url,
        model=settings.qwen_model,
    )
