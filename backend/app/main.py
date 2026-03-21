from __future__ import annotations

from fastapi import FastAPI

from app.api.routes.sessions import router as sessions_router
from app.core.config import get_settings


settings = get_settings()
app = FastAPI(title=settings.app_name)
app.include_router(sessions_router, prefix="/api/sessions", tags=["sessions"])
