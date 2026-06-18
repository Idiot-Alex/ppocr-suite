from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import verify_api_key
from app.schemas.ocr import OCRResponse
from app.services.ocr_service import run_ocr
from app.utils.file_utils import remove_file, save_upload_file


router = APIRouter(prefix="/api", tags=["ocr"])


@router.post("/ocr", response_model=OCRResponse, dependencies=[Depends(verify_api_key)])
async def ocr_image(file: UploadFile = File(...)) -> OCRResponse:
    tmp_path: str | None = None

    try:
        tmp_path = await save_upload_file(file)
        raw, texts, results = run_ocr(tmp_path)

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
