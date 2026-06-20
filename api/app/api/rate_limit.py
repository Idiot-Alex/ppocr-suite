import time
from threading import Lock

from fastapi import Header, Request

from app.core.config import settings
from app.core.errors import raise_api_error


_rate_limit_lock = Lock()
_request_buckets: dict[str, list[float]] = {}


def _client_key(request: Request, x_api_key: str | None) -> str:
    if x_api_key:
        return f"key:{x_api_key}"
    client_host = request.client.host if request.client else "unknown"
    return f"ip:{client_host}"


def check_rate_limit(request: Request, x_api_key: str | None = Header(default=None)) -> None:
    limit = settings.rate_limit_per_minute
    if limit <= 0:
        return

    now = time.monotonic()
    window_start = now - 60
    bucket_key = _client_key(request, x_api_key)

    with _rate_limit_lock:
        bucket = [timestamp for timestamp in _request_buckets.get(bucket_key, []) if timestamp > window_start]
        if len(bucket) >= limit:
            retry_after = max(1, int(60 - (now - bucket[0])))
            _request_buckets[bucket_key] = bucket
            raise_api_error(
                429,
                "rate_limited",
                "Too many OCR requests. Please retry later.",
                retry_after_seconds=retry_after,
            )

        bucket.append(now)
        _request_buckets[bucket_key] = bucket
