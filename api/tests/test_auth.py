import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.main import app


client = TestClient(app)


def test_ocr_requires_api_key() -> None:
    response = client.post("/api/ocr")

    assert response.status_code == 401


def test_verify_api_key_accepts_any_configured_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(deps.settings, "api_keys", "app-a, app-b")
    monkeypatch.setattr(deps.settings, "api_key", "")

    deps.verify_api_key("app-b")


def test_verify_api_key_supports_legacy_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(deps.settings, "api_keys", "")
    monkeypatch.setattr(deps.settings, "api_key", "legacy-key")

    deps.verify_api_key("legacy-key")
