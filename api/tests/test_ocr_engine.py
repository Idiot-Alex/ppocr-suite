import sys
import types

from app.core import ocr_engine


def test_ocr_engine_disables_mkldnn_by_default(monkeypatch) -> None:
    calls: list[dict] = []

    class FakePaddleOCR:
        def __init__(self, **options) -> None:
            calls.append(options)

        def predict(self, image_path: str) -> list:
            return []

    fake_module = types.SimpleNamespace(PaddleOCR=FakePaddleOCR)
    monkeypatch.setitem(sys.modules, "paddleocr", fake_module)
    monkeypatch.setattr(ocr_engine, "_ocr_engine", None)
    monkeypatch.setattr(ocr_engine.settings, "ocr_enable_mkldnn", False)

    engine = ocr_engine.get_ocr_engine()

    assert engine.predict("sample.png") == []
    assert calls[0]["enable_mkldnn"] is False
