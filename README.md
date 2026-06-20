# OCR Suite

This repository contains three independent OCR subprojects:

- `api/`: FastAPI + PaddleOCR server-side OCR API.
- `web/`: Vite + TanStack browser OCR app planned for PP-OCRv6 ONNX models.
- `skill/`: Static skill website and OpenAPI artifacts for model/agent tool use.

The projects live in one repo for coordination, but each subproject owns its own runtime, dependencies, and deployment path.

## Projects

### API

`api/` is the production OCR API. It accepts multipart uploads, image URLs, and base64 images, then returns text, bounding boxes, scores, and metadata.

```bash
cd api
uv sync
uv run pytest
uv run ruff check .
./scripts/run_dev.sh
```

Docker deployment from the repo root:

```bash
docker compose up -d --build
```

### Web

`web/` is the browser-side OCR app. The intended stack is Vite, React, TanStack Router, TanStack Query, `onnxruntime-web`, Web Workers, and PP-OCRv6 tiny ONNX models.

The browser app should run OCR locally where possible, with the API project available as a fallback or server-side endpoint.

### Skill

`skill/` hosts agent-facing documentation and OpenAPI artifacts. It should describe how to call the API endpoints from tools, skills, and curl-compatible environments.

## Suggested Domains

- `api.example.com` -> `api/`
- `ocr.example.com` -> `web/`
- `skill.example.com` -> `skill/`

## Notes

Keep generated model files, `.env` files, local virtualenvs, and frontend build output out of git.
