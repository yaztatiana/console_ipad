from __future__ import annotations

import logging
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import Settings, get_settings
from app.db import fetch_orders

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"

app = FastAPI(title="MOTHER console", version="0.1.0")

if STATIC.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")


@app.get("/", response_class=HTMLResponse)
def dashboard() -> FileResponse:
    index = STATIC / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=500, detail="Missing static/index.html")
    return FileResponse(index, media_type="text/html; charset=utf-8")


@app.get("/api/health")
def health(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    return {"status": "ok", "db": settings.mysql_database or "(not configured)"}


@app.get("/api/orders")
def orders(
    limit: int = Query(100, ge=1, le=500),
    settings: Settings = Depends(get_settings),
) -> JSONResponse:
    if not settings.mysql_user or not settings.mysql_database:
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set MYSQL_USER and MYSQL_DATABASE in server environment.",
        )
    try:
        rows = fetch_orders(settings, limit=limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("orders query failed")
        raise HTTPException(status_code=502, detail="Upstream database error") from e
    return JSONResponse({"orders": rows})
