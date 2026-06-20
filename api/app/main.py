from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.ocr import router as ocr_router
from app.core.config import settings
from app.core.errors import error_detail
from app.core.logging import setup_logging
from app.core.ocr_engine import get_ocr_engine
from app.core.request_logging import RequestLoggingMiddleware


setup_logging()
WEB_DIR = Path(__file__).resolve().parent / "web"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.ocr_preload_on_startup:
        get_ocr_engine()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    lifespan=lifespan,
)
app.add_middleware(RequestLoggingMiddleware)
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        content: dict[str, Any] = exc.detail
    else:
        content = error_detail("http_error", str(exc.detail))
    return JSONResponse(status_code=exc.status_code, content=content, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_detail(
            "validation_error",
            "Request validation failed",
            details=exc.errors(),
        ),
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "env": settings.app_env,
    }


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


app.include_router(ocr_router)
