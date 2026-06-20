import type { OcrBox } from "./types";

const DET_THRESHOLD = 0.3;
const MIN_BOX_AREA = 16;

function outputToProbabilityMap(data: Float32Array | number[], dims: readonly number[]) {
  const height = dims[dims.length - 2] ?? 1;
  const width = dims[dims.length - 1] ?? data.length;
  return {
    data,
    width,
    height,
  };
}

export function boxesFromDetOutput(
  data: Float32Array | number[],
  dims: readonly number[],
  imageWidth: number,
  imageHeight: number,
): OcrBox[] {
  const map = outputToProbabilityMap(data, dims);
  const visited = new Uint8Array(map.width * map.height);
  const boxes: OcrBox[] = [];

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const start = y * map.width + x;
      if (visited[start] || map.data[start] < DET_THRESHOLD) {
        continue;
      }

      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let count = 0;
      const stack = [start];
      visited[start] = 1;

      while (stack.length > 0) {
        const index = stack.pop()!;
        const cx = index % map.width;
        const cy = Math.floor(index / map.width);
        count += 1;
        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx);
        maxY = Math.max(maxY, cy);

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) {
            continue;
          }
          const neighborIndex = ny * map.width + nx;
          if (!visited[neighborIndex] && map.data[neighborIndex] >= DET_THRESHOLD) {
            visited[neighborIndex] = 1;
            stack.push(neighborIndex);
          }
        }
      }

      if (count < MIN_BOX_AREA) {
        continue;
      }

      const scaleX = imageWidth / map.width;
      const scaleY = imageHeight / map.height;
      const paddingX = Math.max(2, (maxX - minX + 1) * scaleX * 0.08);
      const paddingY = Math.max(2, (maxY - minY + 1) * scaleY * 0.18);
      const left = Math.max(0, Math.floor(minX * scaleX - paddingX));
      const top = Math.max(0, Math.floor(minY * scaleY - paddingY));
      const right = Math.min(imageWidth, Math.ceil((maxX + 1) * scaleX + paddingX));
      const bottom = Math.min(imageHeight, Math.ceil((maxY + 1) * scaleY + paddingY));

      if ((right - left) * (bottom - top) >= MIN_BOX_AREA) {
        boxes.push({
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        });
      }
    }
  }

  return mergeAndSortBoxes(boxes);
}

function mergeAndSortBoxes(boxes: OcrBox[]): OcrBox[] {
  const sorted = boxes
    .filter((box) => box.width > 2 && box.height > 2)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const merged: OcrBox[] = [];

  for (const box of sorted) {
    const last = merged.at(-1);
    if (!last) {
      merged.push(box);
      continue;
    }

    const sameLine = Math.abs(box.y - last.y) < Math.max(box.height, last.height) * 0.6;
    const closeGap = box.x - (last.x + last.width) < Math.max(box.height, last.height) * 1.5;

    if (sameLine && closeGap) {
      const left = Math.min(last.x, box.x);
      const top = Math.min(last.y, box.y);
      const right = Math.max(last.x + last.width, box.x + box.width);
      const bottom = Math.max(last.y + last.height, box.y + box.height);
      merged[merged.length - 1] = {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      };
    } else {
      merged.push(box);
    }
  }

  return merged;
}
