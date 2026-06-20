import * as ort from "onnxruntime-web";
import { DET_INPUT_SIZE, DET_MODEL_URLS, REC_CHAR_DICT_URLS, REC_IMAGE_HEIGHT, REC_IMAGE_WIDTH, REC_MODEL_URLS } from "./modelConfig";
import { cropBoxToNchw, decodeImage, imageDataToNchw } from "./image";
import { boxesFromDetOutput } from "./postprocess";
import { decodeCtc, loadCharacterDict } from "./recognizer";
import { createSession, firstInputName, firstOutput } from "./session";
import type { OcrLine, OcrProgress, WorkerRequest, WorkerResponse } from "./types";

let detSessionPromise: ReturnType<typeof createSession> | undefined;
let recSessionPromise: ReturnType<typeof createSession> | undefined;
let dictPromise: Promise<string[]> | undefined;

function post(message: WorkerResponse) {
  self.postMessage(message);
}

function progress(progress: OcrProgress) {
  post({ type: "progress", progress });
}

function log(message: string) {
  post({ type: "log", message });
}

async function run(file: File) {
  const startedAt = performance.now();

  progress({ stage: "loading", message: "Decoding image" });
  const image = await decodeImage(file);
  log(`Decoded ${file.name || "image"} (${image.width} x ${image.height})`);

  progress({ stage: "loading", message: "Loading PP-OCRv6 tiny ONNX models" });
  detSessionPromise ??= createSession(DET_MODEL_URLS);
  recSessionPromise ??= createSession(REC_MODEL_URLS);
  dictPromise ??= loadCharacterDict(REC_CHAR_DICT_URLS);

  const [detLoad, recLoad, characters] = await Promise.all([
    detSessionPromise,
    recSessionPromise,
    dictPromise,
  ]);
  const detSession = detLoad.session;
  const recSession = recLoad.session;
  log(`Detection model: ${detLoad.url}`);
  log(`Recognition model: ${recLoad.url}`);
  log(`Recognition dictionary characters: ${characters.length}`);
  log(`Detection inputs: ${detSession.inputNames.join(", ")} outputs: ${detSession.outputNames.join(", ")}`);
  log(`Recognition inputs: ${recSession.inputNames.join(", ")} outputs: ${recSession.outputNames.join(", ")}`);

  progress({ stage: "detecting", message: "Detecting text regions" });
  const detTensor = imageDataToNchw(
    image.imageData,
    DET_INPUT_SIZE,
    DET_INPUT_SIZE,
    [0.485, 0.456, 0.406],
    [0.229, 0.224, 0.225],
  );
  const detInput = new ort.Tensor("float32", detTensor, [1, 3, DET_INPUT_SIZE, DET_INPUT_SIZE]);
  const detOutput = firstOutput(
    detSession,
    await detSession.run({ [firstInputName(detSession)]: detInput }),
  );
  log(`Detection output dims: ${detOutput.dims.join(" x ")}`);
  const boxes = boxesFromDetOutput(
    detOutput.data as Float32Array,
    detOutput.dims,
    image.width,
    image.height,
  ).slice(0, 120);
  log(`Detected boxes: ${boxes.length}`);

  const lines: OcrLine[] = [];
  let emptyRecognitions = 0;
  const recInputName = firstInputName(recSession);

  for (let index = 0; index < boxes.length; index += 1) {
    progress({
      stage: "recognizing",
      message: "Recognizing text",
      completed: index,
      total: boxes.length,
    });

    const recTensor = cropBoxToNchw(image, boxes[index], REC_IMAGE_WIDTH, REC_IMAGE_HEIGHT);
    const recInput = new ort.Tensor("float32", recTensor, [
      1,
      3,
      REC_IMAGE_HEIGHT,
      REC_IMAGE_WIDTH,
    ]);
    const recOutput = firstOutput(recSession, await recSession.run({ [recInputName]: recInput }));
    const decoded = decodeCtc(recOutput.data as Float32Array, recOutput.dims, characters);

    if (decoded.text.trim()) {
      lines.push({
        text: decoded.text,
        score: decoded.score,
        box: boxes[index],
      });
    } else {
      emptyRecognitions += 1;
    }
  }
  log(`Recognized lines: ${lines.length}; empty crops: ${emptyRecognitions}`);

  progress({
    stage: "done",
    message: "OCR complete",
  });

  post({
    type: "result",
    result: {
      lines,
      elapsedMs: Math.round(performance.now() - startedAt),
      image: {
        width: image.width,
        height: image.height,
      },
    },
  });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== "run") {
    return;
  }

  run(event.data.file).catch((error) => {
    post({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  });
};
