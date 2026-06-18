import logging
import time

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import verify_api_key
from app.core.config import settings
from app.schemas.ocr import OCRResponse
from app.services.ocr_service import run_ocr
from app.utils.file_utils import remove_file, save_upload_file


router = APIRouter(prefix="/api", tags=["ocr"])
logger = logging.getLogger(__name__)


@router.post("/ocr", response_model=OCRResponse, dependencies=[Depends(verify_api_key)])
async def ocr_image(
    file: UploadFile = File(...),
    include_raw: bool = settings.ocr_include_raw_by_default,
) -> OCRResponse:
    tmp_path: str | None = None
    started_at = time.perf_counter()

    try:
        logger.info(
            "ocr.start filename=%s content_type=%s include_raw=%s",
            file.filename,
            file.content_type,
            include_raw,
        )
        tmp_path = await save_upload_file(file)
        raw, texts, results = run_ocr(tmp_path, include_raw=include_raw)
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.info(
            "ocr.done filename=%s texts=%s results=%s elapsed_ms=%.2f",
            file.filename,
            len(texts),
            len(results),
            elapsed_ms,
        )

        return OCRResponse(
            success=True,
            filename=file.filename,
            texts=texts,
            results=results,
            raw=raw,
        )

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc

    finally:
        remove_file(tmp_path)
