# PP-OCR Web

Browser-side OCR app for PP-OCRv6 ONNX models.

## Intended Stack

- Vite
- React
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

## Planned Flow

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

Models should live outside git and be deployed as static assets or R2-backed assets.
