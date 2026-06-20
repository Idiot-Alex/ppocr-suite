from typing import Any

from fastapi import HTTPException


def error_detail(code: str, message: str, **extra: Any) -> dict[str, Any]:
    detail: dict[str, Any] = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
        },
    }
    if extra:
        detail["error"].update(extra)
    return detail


def raise_api_error(status_code: int, code: str, message: str, **extra: Any) -> None:
    raise HTTPException(
        status_code=status_code,
        detail=error_detail(code, message, **extra),
    )
