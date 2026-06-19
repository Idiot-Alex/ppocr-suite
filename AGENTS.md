# Repository Guidelines

## Project Structure & Module Organization

This is a FastAPI OCR service powered by PaddleOCR. Application code lives under `app/`.
API routes are in `app/api/`, configuration and runtime setup are in `app/core/`, OCR parsing logic is in `app/services/`, schemas are in `app/schemas/`, and static workbench assets are in `app/web/`. Tests live in `tests/`. Local helper scripts are in `scripts/`; Docker deployment files are `Dockerfile` and `docker-compose.yml`.

## Build, Test, and Development Commands

- `uv sync`: install locked dependencies from `uv.lock`.
- `./scripts/run_dev.sh`: run the local dev server with reload on `127.0.0.1:8000`.
- `./scripts/run_prod.sh`: run uvicorn with one worker for production-style local testing.
- `uv run pytest`: run the test suite.
- `uv run ruff check .`: run Python lint checks.
- `docker compose up -d --build`: build and run the service container.

For UI-only checks, set `OCR_PRELOAD_ON_STARTUP=false` to avoid loading PaddleOCR at startup.

## Coding Style & Naming Conventions

Use Python 3.11+ with 4-space indentation and type hints for public functions. Follow the existing module layout and keep request handling, OCR execution, and response shaping separated. Use `snake_case` for Python functions and variables, `PascalCase` for Pydantic models, and descriptive test names such as `test_extract_items_from_paddleocr_dict`.

Ruff is configured in `pyproject.toml` with a 100-character line length. Keep frontend assets plain static HTML/CSS/JS unless a build step is intentionally introduced.

## Testing Guidelines

Tests use `pytest` and FastAPI `TestClient`. Add or update tests when changing auth, config parsing, OCR result extraction, or API response behavior. Place tests in `tests/test_*.py`, and prefer focused unit tests for parsing helpers before broader API tests.

Run both:

```bash
uv run pytest
uv run ruff check .
```

## Commit & Pull Request Guidelines

Recent commits follow Conventional Commits, for example `feat: update API key handling`. Use short imperative subjects such as `fix: correct OCR bbox fallback`.

Pull requests should include a concise summary, test results, and any configuration changes. For UI changes, include screenshots or a short note about desktop/mobile verification. Do not commit `.env`, `.venv`, `__pycache__`, model downloads, or upload artifacts.

## Security & Configuration Tips

Configure API keys with `API_KEYS` as a comma-separated list. Use `API_KEYS=` only when intentionally disabling authentication. Keep `--workers 1` for low-memory deployments because each worker loads its own PaddleOCR engine.
