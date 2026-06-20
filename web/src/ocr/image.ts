import type { OcrBox } from "./types";

export type RasterImage = {
  bitmap: ImageBitmap;
  imageData: ImageData;
  width: number;
  height: number;
};

export async function decodeImage(file: File): Promise<RasterImage> {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas 2D is not available in this browser.");
  }

  context.drawImage(bitmap, 0, 0);

  return {
    bitmap,
    imageData: context.getImageData(0, 0, bitmap.width, bitmap.height),
    width: bitmap.width,
    height: bitmap.height,
  };
}

export function imageDataToNchw(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number,
  mean: [number, number, number],
  std: [number, number, number],
): Float32Array {
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas 2D is not available in this browser.");
  }

  const source = new OffscreenCanvas(imageData.width, imageData.height);
  const sourceContext = source.getContext("2d");

  if (!sourceContext) {
    throw new Error("Canvas 2D is not available in this browser.");
  }

  sourceContext.putImageData(imageData, 0, 0);
  context.drawImage(source, 0, 0, targetWidth, targetHeight);

  const resized = context.getImageData(0, 0, targetWidth, targetHeight).data;
  const channelSize = targetWidth * targetHeight;
  const tensor = new Float32Array(3 * channelSize);

  for (let pixel = 0; pixel < channelSize; pixel += 1) {
    const offset = pixel * 4;
    tensor[pixel] = (resized[offset] / 255 - mean[0]) / std[0];
    tensor[channelSize + pixel] = (resized[offset + 1] / 255 - mean[1]) / std[1];
    tensor[channelSize * 2 + pixel] = (resized[offset + 2] / 255 - mean[2]) / std[2];
  }

  return tensor;
}

export function cropBoxToNchw(
  image: RasterImage,
  box: OcrBox,
  targetWidth: number,
  targetHeight: number,
): Float32Array {
  const source = new OffscreenCanvas(image.width, image.height);
  const sourceContext = source.getContext("2d");
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!sourceContext || !context) {
    throw new Error("Canvas 2D is not available in this browser.");
  }

  sourceContext.putImageData(image.imageData, 0, 0);
  context.fillStyle = "white";
  context.fillRect(0, 0, targetWidth, targetHeight);

  const cropWidth = Math.max(1, box.width);
  const cropHeight = Math.max(1, box.height);
  const scaledWidth = Math.min(targetWidth, Math.round((cropWidth / cropHeight) * targetHeight));

  context.drawImage(
    source,
    box.x,
    box.y,
    cropWidth,
    cropHeight,
    0,
    0,
    scaledWidth,
    targetHeight,
  );

  const data = context.getImageData(0, 0, targetWidth, targetHeight).data;
  const channelSize = targetWidth * targetHeight;
  const tensor = new Float32Array(3 * channelSize);

  for (let pixel = 0; pixel < channelSize; pixel += 1) {
    const offset = pixel * 4;
    tensor[pixel] = data[offset] / 255;
    tensor[channelSize + pixel] = data[offset + 1] / 255;
    tensor[channelSize * 2 + pixel] = data[offset + 2] / 255;
  }

  return tensor;
}
