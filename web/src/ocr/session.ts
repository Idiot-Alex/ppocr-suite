import * as ort from "onnxruntime-web";
import ortWasmMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";

ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 1);
ort.env.wasm.proxy = true;
ort.env.wasm.wasmPaths = {
  wasm: ortWasmUrl,
  mjs: ortWasmMjsUrl,
};

export type SessionLoadResult = {
  session: ort.InferenceSession;
  url: string;
};

export async function createSession(urls: string[]): Promise<SessionLoadResult> {
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const session = await ort.InferenceSession.create(url, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      return { session, url };
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Unable to load ONNX model. Tried:\n${errors.join("\n")}`);
}

export function firstInputName(session: ort.InferenceSession): string {
  const inputName = session.inputNames[0];
  if (!inputName) {
    throw new Error("ONNX model has no input.");
  }
  return inputName;
}

export function firstOutput(session: ort.InferenceSession, output: ort.InferenceSession.OnnxValueMapType) {
  const outputName = session.outputNames[0];
  const tensor = outputName ? output[outputName] : Object.values(output)[0];

  if (!tensor || !("data" in tensor) || !("dims" in tensor)) {
    throw new Error("ONNX model returned no tensor output.");
  }

  return tensor as ort.Tensor;
}
