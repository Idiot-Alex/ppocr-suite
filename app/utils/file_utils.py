import os
import tempfile

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import settings


ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
CHUNK_SIZE = 1024 * 1024


def validate_filename(filename: str) -> str:
    suffix = os.path.splitext(filename or "")[-1].lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {suffix}")

    return suffix


def validate_image_file(path: str) -> None:
    try:
        with Image.open(path) as image:
            image.verify()
    except (OSError, UnidentifiedImageError) as exc:
        raise ValueError("Uploaded file is not a valid image") from exc


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

    validate_image_file(tmp_path)
    return tmp_path


def remove_file(path: str | None) -> None:
    if path and os.path.exists(path):
        os.remove(path)
