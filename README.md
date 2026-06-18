# PP-OCRv6 FastAPI OCR API

一个基于 `uv + FastAPI + PaddleOCR + PaddlePaddle CPU` 的轻量 OCR HTTP API 服务。

## 功能

- `GET /health` 健康检查
- `POST /api/ocr` 上传图片 OCR 识别
- 返回识别文本、文本框、置信度和 PaddleOCR 原始结果
- API Key 鉴权
- 默认 CPU 推理，无需 GPU / CUDA
- 支持 Docker 和 docker compose 部署

## 环境

推荐使用 Python 3.11。

```bash
uv python install 3.11
uv venv --python 3.11
source .venv/bin/activate
uv sync
```

复制环境变量：

```bash
cp .env.example .env
```

## 本地开发

```bash
uv run uvicorn app.main:app --reload
```

或：

```bash
./scripts/run_dev.sh
```

访问文档：

```text
http://127.0.0.1:8000/docs
```

健康检查：

```bash
curl http://127.0.0.1:8000/health
```

OCR 请求：

```bash
curl -X POST "http://127.0.0.1:8000/api/ocr" \
  -H "x-api-key: change-me" \
  -F "file=@test.png"
```

## 配置

主要配置在 `.env`：

```env
APP_NAME=PP-OCRv6 API
APP_ENV=dev
APP_HOST=0.0.0.0
APP_PORT=8000
OCR_LANG=ch
OCR_MODEL_SIZE=tiny
OCR_USE_GPU=false
OCR_PRELOAD_ON_STARTUP=true
MAX_UPLOAD_SIZE_MB=10
API_KEY=change-me
```

如果 `API_KEY` 为空字符串，则关闭 API Key 鉴权。

默认 `OCR_PRELOAD_ON_STARTUP=true`，服务启动时会初始化 PaddleOCR 并下载/加载模型。这样启动完成后第一个 OCR 请求可以直接使用。开发调试时如果只想跑健康检查或避免启动下载模型，可以设为 `false`，此时会在第一次 OCR 请求时加载。

## 生产启动

低配 2C2G 服务器建议只使用 1 个 worker，避免每个 worker 重复加载 OCR 模型导致内存不足。

```bash
./scripts/run_prod.sh
```

## Docker

```bash
docker compose up -d --build
docker compose logs -f
```

## 测试和检查

```bash
uv run pytest
uv run ruff check .
```
