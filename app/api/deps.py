import secrets

from fastapi import Header, HTTPException

from app.core.config import settings


def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    valid_api_keys = settings.valid_api_keys
    if not valid_api_keys:
        return

    if x_api_key is None or not any(
        secrets.compare_digest(x_api_key, api_key) for api_key in valid_api_keys
    ):
        raise HTTPException(status_code=401, detail="Invalid API key")
