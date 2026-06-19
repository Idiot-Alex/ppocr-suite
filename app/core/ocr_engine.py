import logging
from threading import Lock
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class OCREngine:
    def __init__(self) -> None:
        logger.info("Initializing PaddleOCR engine...")
        logger.info("OCR lang=%s", settings.ocr_lang)

        try:
            from paddleocr import PaddleOCR
        except ImportError as exc:
            raise RuntimeError(
                "PaddleOCR is not installed. Run `uv sync` or install project dependencies."
            ) from exc

        self.ocr = PaddleOCR(
            lang=settings.ocr_lang,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )

    def predict(self, image_path: str) -> Any:
        return self.ocr.predict(image_path)


_ocr_engine: OCREngine | None = None
_ocr_engine_lock = Lock()


def get_ocr_engine() -> OCREngine:
    global _ocr_engine

    if _ocr_engine is None:
        with _ocr_engine_lock:
            if _ocr_engine is None:
                _ocr_engine = OCREngine()

    return _ocr_engine
