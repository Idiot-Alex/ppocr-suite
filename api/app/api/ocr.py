import logging
import time

from fastapi import APIRouter, Depends, File, Query, UploadFile
from starlette.concurrency import run_in_threadpool

from app.api.deps import verify_api_key
from app.api.rate_limit import check_rate_limit
from app.core.config import settings
from app.core.errors import raise_api_error
from app.schemas.ocr import OCRBase64Request, OCRResponse, OCRResponseMeta, OCRUrlRequest
from app.services.ocr_service import run_ocr
from app.utils.file_utils import (
    download_image_to_temp_file,
    get_image_size,
    remove_file,
    save_base64_image,
    save_upload_file,
)


router = APIRouter(prefix="/api", tags=["ocr"])
ocr_dependencies = [Depends(verify_api_key), Depends(check_rate_limit)]
logger = logging.getLogger(__name__)


async def _run_ocr_from_temp_file(
    tmp_path: str,
    filename: str | None,
    source: str,
    include_raw: bool,
) -> OCRResponse:
    started_at = time.perf_counter()

    try:
        image_width, image_height = await run_in_threadpool(get_image_size, tmp_path)
        logger.info(
            "ocr.start source=%s filename=%s include_raw=%s",
            source,
            filename,
            include_raw,
        )
        raw, texts, results = await run_in_threadpool(run_ocr, tmp_path, include_raw)
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.info(
            "ocr.done source=%s filename=%s texts=%s results=%s elapsed_ms=%.2f",
            source,
            filename,
            len(texts),
            len(results),
            elapsed_ms,
        )

        return OCRResponse(
            success=True,
            filename=filename,
            texts=texts,
            results=results,
            raw=raw,
            meta=OCRResponseMeta(
                source=source,
                elapsed_ms=round(elapsed_ms, 2),
                image_width=image_width,
                image_height=image_height,
                engine=settings.ocr_engine or "paddleocr",
                text_count=len(texts),
            ),
        )

    except Exception as exc:
        raise_api_error(500, "ocr_failed", f"OCR failed: {exc}")

    finally:
        remove_file(tmp_path)


@router.post("/ocr", response_model=OCRResponse, dependencies=ocr_dependencies)
async def ocr_image(
    file: UploadFile = File(...),
    include_raw: bool = settings.ocr_include_raw_by_default,
) -> OCRResponse:
    try:
        tmp_path = await save_upload_file(file)
    except ValueError as exc:
        raise_api_error(400, "invalid_image", str(exc))

    return await _run_ocr_from_temp_file(
        tmp_path=tmp_path,
        filename=file.filename,
        source="upload",
        include_raw=include_raw,
    )


@router.post("/ocr/url", response_model=OCRResponse, dependencies=ocr_dependencies)
async def ocr_image_url(
    payload: OCRUrlRequest,
    include_raw: bool = settings.ocr_include_raw_by_default,
) -> OCRResponse:
    image_url = str(payload.image_url)
    try:
        tmp_path = await run_in_threadpool(download_image_to_temp_file, image_url)
    except ValueError as exc:
        raise_api_error(400, "invalid_image_url", str(exc))

    return await _run_ocr_from_temp_file(
        tmp_path=tmp_path,
        filename=image_url,
        source="url",
        include_raw=include_raw,
    )


@router.get("/ocr/url", response_model=OCRResponse, dependencies=ocr_dependencies)
async def ocr_image_url_get(
    image_url: str = Query(..., min_length=1),
    include_raw: bool = settings.ocr_include_raw_by_default,
) -> OCRResponse:
    try:
        tmp_path = await run_in_threadpool(download_image_to_temp_file, image_url)
    except ValueError as exc:
        raise_api_error(400, "invalid_image_url", str(exc))

    return await _run_ocr_from_temp_file(
        tmp_path=tmp_path,
        filename=image_url,
        source="url",
        include_raw=include_raw,
    )


@router.post("/ocr/base64", response_model=OCRResponse, dependencies=ocr_dependencies)
async def ocr_image_base64(
    payload: OCRBase64Request,
    include_raw: bool = settings.ocr_include_raw_by_default,
) -> OCRResponse:
    try:
        tmp_path = await run_in_threadpool(
            save_base64_image,
            payload.image_base64,
            payload.filename,
        )
    except ValueError as exc:
        raise_api_error(400, "invalid_base64_image", str(exc))

    return await _run_ocr_from_temp_file(
        tmp_path=tmp_path,
        filename=payload.filename,
        source="base64",
        include_raw=include_raw,
    )
