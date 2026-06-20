#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_DIR="${ROOT_DIR}/public/models"
HF_BASE="${HF_BASE:-https://hf-mirror.com}"

mkdir -p "${MODEL_DIR}"

download() {
  local url="$1"
  local output="$2"

  echo "Downloading ${url}"
  curl -L --fail --connect-timeout 20 --max-time 300 -o "${output}" "${url}"
}

download \
  "${HF_BASE}/PaddlePaddle/PP-OCRv6_tiny_det_onnx/resolve/main/inference.onnx" \
  "${MODEL_DIR}/pp-ocrv6-tiny-det.onnx"

download \
  "${HF_BASE}/PaddlePaddle/PP-OCRv6_tiny_rec_onnx/resolve/main/inference.onnx" \
  "${MODEL_DIR}/pp-ocrv6-tiny-rec.onnx"

download \
  "${HF_BASE}/PaddlePaddle/PP-OCRv6_tiny_rec_onnx/resolve/main/inference.yml" \
  "${MODEL_DIR}/pp-ocrv6-tiny-rec.yml"

ls -lh "${MODEL_DIR}"
