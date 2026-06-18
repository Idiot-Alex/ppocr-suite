from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_ocr_requires_api_key() -> None:
    response = client.post("/api/ocr")

    assert response.status_code == 401
