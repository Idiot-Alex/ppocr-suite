# PP-OCR Web

Browser-side OCR app for PP-OCRv6 tiny ONNX models.

## Intended Stack

- Vite
- React
- Tailwind CSS
- TanStack Router
- TanStack Query
- onnxruntime-web
- Web Worker + Canvas
- Cloudflare Pages / Workers static assets

## Development

```bash
npm install
npm run dev
```

## Cloudflare Workers Deployment

The app is configured for Cloudflare Workers Static Assets through `wrangler.jsonc`.

```bash
npm run build
npm run deploy
```

For local Workers preview:

```bash
npm run cf:dev
```

## OCR Flow

```text
image file
 -> canvas decode and resize
 -> tiny_det_onnx inference
 -> text box postprocessing
 -> crop text regions
 -> tiny_rec_onnx inference
 -> text decoding
 -> render text and boxes
```

The app loads PP-OCRv6 tiny detection and recognition ONNX models in a Web Worker with
`onnxruntime-web`. Model URLs are centralized in `src/ocr/modelConfig.ts`.

Download the model assets:

```bash
./scripts/download_models.sh
```

Default local asset paths:

- `public/models/pp-ocrv6-tiny-det.onnx`
- `public/models/pp-ocrv6-tiny-rec.onnx`
- `public/models/pp-ocrv6-tiny-rec.yml`

The script defaults to `https://hf-mirror.com`. To use Hugging Face directly:

```bash
HF_BASE=https://huggingface.co ./scripts/download_models.sh
```

Keep `.onnx` model files outside git and deploy them as static assets or R2-backed assets.

The first implementation uses DB-style thresholding and connected components for text region
extraction, then CTC decoding for recognition. Rotated polygon boxes can be added later without
changing the UI or Worker protocol.
