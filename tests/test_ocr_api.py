from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.api import ocr
from app.main import app
from app.schemas.ocr import OCRItem


client = TestClient(app)


def make_png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), color="white").save(buffer, format="PNG")
    return buffer.getvalue()


def test_ocr_endpoint_returns_mocked_results(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, bool]] = []

    def fake_run_ocr(image_path: str, include_raw: bool = False) -> tuple[dict, list[str], list[OCRItem]]:
        calls.append((image_path, include_raw))
        return (
            {"rec_texts": ["hello"]},
            ["hello"],
            [OCRItem(text="hello", score=0.99, bbox=[0, 0, 4, 4])],
        )

    monkeypatch.setattr(ocr, "run_ocr", fake_run_ocr)

    response = client.post(
        "/api/ocr?include_raw=true",
        headers={"x-api-key": "ppocr-dev-7c9f2b8a6e1d4c30"},
        files={"file": ("sample.png", make_png_bytes(), "image/png")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "filename": "sample.png",
        "texts": ["hello"],
        "results": [{"text": "hello", "score": 0.99, "bbox": [0, 0, 4, 4]}],
        "raw": {"rec_texts": ["hello"]},
    }
    assert len(calls) == 1
    assert calls[0][1] is True


def test_ocr_endpoint_rejects_invalid_image_content() -> None:
    response = client.post(
        "/api/ocr",
        headers={"x-api-key": "ppocr-dev-7c9f2b8a6e1d4c30"},
        files={"file": ("sample.png", b"not an image", "image/png")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Uploaded file is not a valid image"
