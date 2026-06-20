from io import BytesIO

import base64
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.api import ocr
from app.utils import file_utils
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


def test_ocr_base64_endpoint_returns_mocked_results(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run_ocr(image_path: str, include_raw: bool = False) -> tuple[None, list[str], list[OCRItem]]:
        assert image_path.endswith(".png")
        assert include_raw is False
        return None, ["base64 text"], [OCRItem(text="base64 text", score=0.9, bbox=None)]

    monkeypatch.setattr(ocr, "run_ocr", fake_run_ocr)

    response = client.post(
        "/api/ocr/base64",
        headers={"x-api-key": "ppocr-dev-7c9f2b8a6e1d4c30"},
        json={
            "filename": "sample.png",
            "image_base64": base64.b64encode(make_png_bytes()).decode("ascii"),
        },
    )

    assert response.status_code == 200
    assert response.json()["texts"] == ["base64 text"]


def test_ocr_base64_endpoint_rejects_invalid_base64() -> None:
    response = client.post(
        "/api/ocr/base64",
        headers={"x-api-key": "ppocr-dev-7c9f2b8a6e1d4c30"},
        json={"filename": "sample.png", "image_base64": "not valid base64"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid base64 image data"


def test_ocr_url_endpoint_returns_mocked_results(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_download_image_to_temp_file(image_url: str) -> str:
        assert image_url == "https://example.com/sample.png"
        return file_utils.save_base64_image(
            base64.b64encode(make_png_bytes()).decode("ascii"),
            "sample.png",
        )

    def fake_run_ocr(image_path: str, include_raw: bool = False) -> tuple[None, list[str], list[OCRItem]]:
        assert image_path.endswith(".png")
        assert include_raw is False
        return None, ["url text"], [OCRItem(text="url text", score=0.8, bbox=[1, 2, 3, 4])]

    monkeypatch.setattr(ocr, "download_image_to_temp_file", fake_download_image_to_temp_file)
    monkeypatch.setattr(ocr, "run_ocr", fake_run_ocr)

    response = client.post(
        "/api/ocr/url",
        headers={"x-api-key": "ppocr-dev-7c9f2b8a6e1d4c30"},
        json={"image_url": "https://example.com/sample.png"},
    )

    assert response.status_code == 200
    assert response.json()["texts"] == ["url text"]
    assert response.json()["results"][0]["bbox"] == [1, 2, 3, 4]


def test_ocr_url_get_endpoint_returns_mocked_results(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_download_image_to_temp_file(image_url: str) -> str:
        assert image_url == "https://example.com/sample.png"
        return file_utils.save_base64_image(
            base64.b64encode(make_png_bytes()).decode("ascii"),
            "sample.png",
        )

    def fake_run_ocr(image_path: str, include_raw: bool = False) -> tuple[None, list[str], list[OCRItem]]:
        assert image_path.endswith(".png")
        assert include_raw is False
        return None, ["get url text"], [OCRItem(text="get url text", score=0.8, bbox=None)]

    monkeypatch.setattr(ocr, "download_image_to_temp_file", fake_download_image_to_temp_file)
    monkeypatch.setattr(ocr, "run_ocr", fake_run_ocr)

    response = client.get(
        "/api/ocr/url?image_url=https://example.com/sample.png",
        headers={"x-api-key": "ppocr-dev-7c9f2b8a6e1d4c30"},
    )

    assert response.status_code == 200
    assert response.json()["texts"] == ["get url text"]


def test_download_image_rejects_localhost_url() -> None:
    with pytest.raises(ValueError, match="private or local"):
        file_utils.download_image_to_temp_file("http://127.0.0.1/sample.png")
