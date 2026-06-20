import base64
import binascii
import ipaddress
import os
import socket
import tempfile
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import settings


ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
CHUNK_SIZE = 1024 * 1024
DOWNLOAD_TIMEOUT_SECONDS = 10
DATA_URI_MARKER = ";base64,"
CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
}


def validate_filename(filename: str) -> str:
    suffix = os.path.splitext(filename or "")[-1].lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {suffix}")

    return suffix


def _suffix_from_content_type(content_type: str | None) -> str | None:
    media_type = (content_type or "").split(";", 1)[0].strip().lower()
    return CONTENT_TYPE_EXTENSIONS.get(media_type)


def _suffix_from_url_or_content_type(image_url: str, content_type: str | None = None) -> str:
    suffix = os.path.splitext(urlparse(image_url).path)[-1].lower()
    if suffix in ALLOWED_EXTENSIONS:
        return suffix

    content_type_suffix = _suffix_from_content_type(content_type)
    if content_type_suffix:
        return content_type_suffix

    raise ValueError("Unsupported image URL file type")


def _validate_remote_url(image_url: str) -> None:
    parsed_url = urlparse(image_url)
    if parsed_url.scheme not in {"http", "https"}:
        raise ValueError("Image URL must use http or https")
    if not parsed_url.hostname:
        raise ValueError("Image URL must include a hostname")

    try:
        addresses = socket.getaddrinfo(parsed_url.hostname, None)
    except socket.gaierror as exc:
        raise ValueError("Image URL hostname could not be resolved") from exc

    for address in {item[4][0] for item in addresses}:
        ip_address = ipaddress.ip_address(address)
        if (
            ip_address.is_private
            or ip_address.is_loopback
            or ip_address.is_link_local
            or ip_address.is_multicast
            or ip_address.is_reserved
            or ip_address.is_unspecified
        ):
            raise ValueError("Image URL must not resolve to a private or local address")


def validate_image_file(path: str) -> None:
    try:
        with Image.open(path) as image:
            width, height = image.size
            if width * height > settings.max_image_pixels:
                raise ValueError(
                    f"Image too large. Max pixels is {settings.max_image_pixels}"
                )
            image.verify()
    except (OSError, UnidentifiedImageError) as exc:
        raise ValueError("Uploaded file is not a valid image") from exc


def get_image_size(path: str) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


def _write_temp_image_from_chunks(chunks: list[bytes], suffix: str) -> str:
    max_size = settings.max_upload_size_mb * 1024 * 1024

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name
        total_size = 0
        try:
            for chunk in chunks:
                total_size += len(chunk)
                if total_size > max_size:
                    raise ValueError(f"File too large. Max size is {settings.max_upload_size_mb}MB")
                tmp.write(chunk)
        except Exception:
            tmp.close()
            remove_file(tmp_path)
            raise

    try:
        validate_image_file(tmp_path)
    except Exception:
        remove_file(tmp_path)
        raise
    return tmp_path


def _save_bytes_as_image(content: bytes, suffix: str) -> str:
    return _write_temp_image_from_chunks([content], suffix)


async def save_upload_file(file: UploadFile) -> str:
    suffix = validate_filename(file.filename or "")
    max_size = settings.max_upload_size_mb * 1024 * 1024

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name
        total_size = 0

        while chunk := await file.read(CHUNK_SIZE):
            total_size += len(chunk)
            if total_size > max_size:
                tmp.close()
                remove_file(tmp_path)
                raise ValueError(f"File too large. Max size is {settings.max_upload_size_mb}MB")
            tmp.write(chunk)

    try:
        validate_image_file(tmp_path)
    except Exception:
        remove_file(tmp_path)
        raise
    return tmp_path


def save_base64_image(image_base64: str, filename: str | None = None) -> str:
    payload = image_base64.strip()
    suffix = validate_filename(filename or "image.png") if filename else ".png"

    if DATA_URI_MARKER in payload:
        header, payload = payload.split(DATA_URI_MARKER, 1)
        media_type = header.removeprefix("data:").strip().lower()
        suffix = _suffix_from_content_type(media_type) or suffix

    max_size = settings.max_upload_size_mb * 1024 * 1024
    if len(payload) * 3 // 4 > max_size:
        raise ValueError(f"File too large. Max size is {settings.max_upload_size_mb}MB")

    try:
        content = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid base64 image data") from exc

    return _save_bytes_as_image(content, suffix)


def download_image_to_temp_file(image_url: str) -> str:
    _validate_remote_url(image_url)

    request = Request(
        image_url,
        headers={"User-Agent": "ppocr-api/0.2"},
        method="GET",
    )
    max_size = settings.max_upload_size_mb * 1024 * 1024

    try:
        with urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
            content_type = response.headers.get("content-type")
            suffix = _suffix_from_url_or_content_type(image_url, content_type)
            chunks: list[bytes] = []
            total_size = 0

            while True:
                chunk = response.read(CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > max_size:
                    raise ValueError(f"File too large. Max size is {settings.max_upload_size_mb}MB")
                chunks.append(chunk)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Failed to download image URL: {exc}") from exc

    return _write_temp_image_from_chunks(chunks, suffix)


def remove_file(path: str | None) -> None:
    if path and os.path.exists(path):
        os.remove(path)
