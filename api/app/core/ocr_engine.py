import logging
from threading import Lock
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class OCREngine:
    def __init__(self) -> None:
        logger.info("Initializing PaddleOCR engine...")
        logger.info("OCR lang=%s", settings.ocr_lang)
        logger.info(
            "OCR models det=%s rec=%s engine=%s",
            settings.ocr_det_model or "-",
            settings.ocr_rec_model or "-",
            settings.ocr_engine or "-",
        )

        try:
            from paddleocr import PaddleOCR
        except ImportError as exc:
            raise RuntimeError(
                "PaddleOCR is not installed. Run `uv sync` or install project dependencies."
            ) from exc

        options: dict[str, Any] = {
            "lang": settings.ocr_lang,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
            "enable_mkldnn": settings.ocr_enable_mkldnn,
        }
        optional_options = {
            "engine": settings.ocr_engine,
            "text_detection_model_name": settings.ocr_det_model,
            "text_recognition_model_name": settings.ocr_rec_model,
            "text_detection_model_dir": settings.ocr_det_model_dir,
            "text_recognition_model_dir": settings.ocr_rec_model_dir,
        }
        options.update({key: value for key, value in optional_options.items() if value})

        self.ocr = PaddleOCR(**options)

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
