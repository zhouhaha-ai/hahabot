from __future__ import annotations

import os
from functools import lru_cache
from typing import AsyncIterator


class QwenClient:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
    ) -> None:
        from openai import AsyncOpenAI

        self._model = model
        self._client = AsyncOpenAI(
            api_key=api_key or os.getenv("QWEN_API_KEY", ""),
            base_url=base_url or os.getenv("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        )
        self._model = model or os.getenv("QWEN_MODEL", "qwen-plus")

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
    return QwenClient()
