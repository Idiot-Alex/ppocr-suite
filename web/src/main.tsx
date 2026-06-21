import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { OcrLog, OcrProgress, OcrResult, WorkerResponse } from "./ocr/types";
import "./styles.css";

function App() {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [result, setResult] = useState<OcrResult | null>(null);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [logs, setLogs] = useState<OcrLog[]>([]);
  const [error, setError] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const imageUrlRef = useRef<string>("");
  const runTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
      }
      if (runTimeoutRef.current !== null) {
        window.clearTimeout(runTimeoutRef.current);
      }
      workerRef.current?.terminate();
    };
  }, []);

  const text = useMemo(() => result?.lines.map((line) => line.text).join("\n") ?? "", [result]);

  function ensureWorker() {
    workerRef.current ??= new Worker(new URL("./ocr/worker.ts", import.meta.url), {
      type: "module",
    });

    return workerRef.current;
  }

  function runOcr(file: File) {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
    }

    const nextImageUrl = URL.createObjectURL(file);
    imageUrlRef.current = nextImageUrl;
    setImageUrl(nextImageUrl);
    setFileName(file.name);
    setResult(null);
    setError("");
    setLogs([]);
    setIsRunning(true);
    setProgress({ stage: "loading", message: "Starting OCR" });
    setLogs((items) => appendLog(items, "Creating OCR worker"));

    if (runTimeoutRef.current !== null) {
      window.clearTimeout(runTimeoutRef.current);
    }
    runTimeoutRef.current = window.setTimeout(() => {
      setLogs((items) => appendLog(items, "OCR is still running after 30 seconds"));
    }, 30000);

    const worker = ensureWorker();
    worker.onerror = (event) => {
      setIsRunning(false);
      setError(event.message || "OCR worker failed before it could report an error.");
      setLogs((items) => appendLog(items, "Worker error event received"));
    };
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;

      if (message.type === "log") {
        setLogs((items) => appendLog(items, message.message));
        return;
      }

      if (message.type === "progress") {
        setProgress(message.progress);
        setLogs((items) => appendLog(items, message.progress.message));
        return;
      }

      setIsRunning(false);
      if (runTimeoutRef.current !== null) {
        window.clearTimeout(runTimeoutRef.current);
        runTimeoutRef.current = null;
      }

      if (message.type === "result") {
        setResult(message.result);
        return;
      }

      setError(message.message);
    };

    worker.postMessage({ type: "run", file });
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      runOcr(file);
    }
    event.target.value = "";
  }

  function onDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
  }

  function onDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((item) =>
      item.type.startsWith("image/"),
    );
    if (file) {
      runOcr(file);
    }
  }

  function copyText() {
    void navigator.clipboard.writeText(text);
  }

  function downloadJson() {
    if (!result) {
      return;
    }

    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName || "ocr-result"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#eef1f4] p-4 text-[#151719] md:p-6">
      <header className="mx-auto mb-5 flex min-h-24 flex-col items-stretch justify-between gap-5 md:flex-row md:items-center">
        <div>
          <p className="mb-2 text-xs font-extrabold tracking-normal text-[#68707a] uppercase">
            PP-OCRv6 tiny ONNX
          </p>
          <h1 className="m-0 text-[clamp(32px,5vw,56px)] leading-[0.95] font-bold">
            Browser OCR workspace
          </h1>
        </div>
        <label className="grid min-h-11 min-w-[148px] cursor-pointer place-items-center border border-[#151719] bg-[#151719] px-[18px] font-extrabold text-white">
          <input className="hidden" type="file" accept="image/*" onChange={onFileChange} />
          <span>{isRunning ? "Running..." : "Select image"}</span>
        </label>
      </header>

      <section
        className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div className="grid min-h-0 place-items-center overflow-hidden border border-[#d6dbe1] bg-white lg:min-h-[calc(100vh-140px)]">
          {!imageUrl && (
            <label className="grid min-h-60 w-[min(520px,calc(100%-40px))] cursor-pointer place-items-center border border-dashed border-[#151719] bg-[#f8fafc] font-extrabold text-[#151719]">
              <input className="hidden" type="file" accept="image/*" onChange={onFileChange} />
              <span>Drop in an image to run local OCR</span>
            </label>
          )}

          {imageUrl && (
            <div className="relative max-h-[70vh] max-w-full lg:max-h-[calc(100vh-140px)]">
              <img
                className="block max-h-[70vh] max-w-full object-contain lg:max-h-[calc(100vh-140px)]"
                src={imageUrl}
                alt={fileName || "Selected OCR input"}
              />
              {result?.lines.map((line, index) => (
                <div
                  className="pointer-events-none absolute border-2 border-[#00a676] bg-[#00a6761f]"
                  key={`${line.box.x}-${line.box.y}-${index}`}
                  style={{
                    left: `${(line.box.x / result.image.width) * 100}%`,
                    top: `${(line.box.y / result.image.height) * 100}%`,
                    width: `${(line.box.width / result.image.width) * 100}%`,
                    height: `${(line.box.height / result.image.height) * 100}%`,
                  }}
                  title={line.text}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-4 overflow-auto border border-[#d6dbe1] bg-white p-[18px] lg:min-h-[calc(100vh-140px)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-extrabold tracking-normal text-[#68707a] uppercase">
                Status
              </p>
              <p className="m-0 text-xl font-extrabold">
                {statusText(progress, isRunning, result, error)}
              </p>
            </div>
            {result && (
              <span className="grid min-h-10 min-w-10 place-items-center border border-[#151719] font-black">
                {result.lines.length}
              </span>
            )}
          </div>

          {progress?.stage === "recognizing" && (
            <div className="h-2 bg-[#e4e8ed]">
              <span
                className="block h-full bg-[#00a676] transition-[width] duration-150 ease-in-out"
                style={{
                  width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          )}

          {error && (
            <pre className="m-0 max-h-[260px] overflow-auto whitespace-pre-wrap border border-red-600 bg-rose-50 p-3 text-red-800">
              {error}
            </pre>
          )}

          {logs.length > 0 && (
            <details
              className="border border-[#d6dbe1] bg-[#f8fafc]"
              open={Boolean(error) || isRunning}
            >
              <summary className="cursor-pointer px-3 py-2.5 font-black text-[#151719]">
                Diagnostics
              </summary>
              <ol className="m-0 max-h-[260px] list-none overflow-auto px-3 pb-3">
                {logs.map((item, index) => (
                  <li
                    className="grid grid-cols-[84px_minmax(0,1fr)] gap-2.5 border-t border-[#e4e8ed] py-[7px]"
                    key={`${item.time}-${index}`}
                  >
                    <span className="text-xs text-[#68707a] tabular-nums">{item.time}</span>
                    <p className="m-0 [overflow-wrap:anywhere] text-xs leading-[1.4] text-[#2f363d]">
                      {item.message}
                    </p>
                  </li>
                ))}
              </ol>
            </details>
          )}

          {result && (
            <>
              <div className="grid grid-cols-2 border border-[#d6dbe1]">
                <div className="grid gap-1.5 p-3">
                  <span className="text-xs font-extrabold text-[#68707a] uppercase">Image</span>
                  <strong className="text-[15px]">
                    {result.image.width} x {result.image.height}
                  </strong>
                </div>
                <div className="grid gap-1.5 border-l border-[#d6dbe1] p-3">
                  <span className="text-xs font-extrabold text-[#68707a] uppercase">Elapsed</span>
                  <strong className="text-[15px]">{result.elapsedMs} ms</strong>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_92px] gap-2.5">
                <button
                  className="min-h-10 cursor-pointer border border-[#151719] bg-[#151719] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  type="button"
                  onClick={copyText}
                  disabled={!text}
                >
                  Copy text
                </button>
                <button
                  className="min-h-10 cursor-pointer border border-[#151719] bg-[#151719] font-extrabold text-white"
                  type="button"
                  onClick={downloadJson}
                >
                  JSON
                </button>
              </div>

              <textarea
                className="min-h-[180px] resize-y border border-[#d6dbe1] p-3 leading-normal text-[#151719]"
                value={text}
                readOnly
                aria-label="Recognized text"
              />

              <div className="grid gap-2">
                {result.lines.map((line, index) => (
                  <article
                    key={`${line.text}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_48px] gap-3 border-t border-[#e4e8ed] py-2.5"
                  >
                    <p className="m-0 break-words">{line.text}</p>
                    <span className="text-right text-[13px] font-extrabold text-[#68707a]">
                      {Math.round(line.score * 100)}%
                    </span>
                  </article>
                ))}
              </div>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}

function appendLog(logs: OcrLog[], message: string): OcrLog[] {
  return [
    ...logs,
    {
      time: new Date().toLocaleTimeString(),
      message,
    },
  ].slice(-80);
}

function statusText(
  progress: OcrProgress | null,
  isRunning: boolean,
  result: OcrResult | null,
  error: string,
) {
  if (error) {
    return "Failed";
  }
  if (progress?.stage === "recognizing") {
    return `${progress.message} ${progress.completed}/${progress.total}`;
  }
  if (progress) {
    return progress.message;
  }
  if (result) {
    return "Complete";
  }
  return isRunning ? "Working" : "Idle";
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
