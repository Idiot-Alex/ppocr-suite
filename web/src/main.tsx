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
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PP-OCRv6 tiny ONNX</p>
          <h1>Browser OCR workspace</h1>
        </div>
        <label className="upload-button">
          <input type="file" accept="image/*" onChange={onFileChange} />
          <span>{isRunning ? "Running..." : "Select image"}</span>
        </label>
      </header>

      <section className="workspace" onDragOver={onDragOver} onDrop={onDrop}>
        <div className="preview-panel">
          {!imageUrl && (
            <label className="empty-drop">
              <input type="file" accept="image/*" onChange={onFileChange} />
              <span>Drop in an image to run local OCR</span>
            </label>
          )}

          {imageUrl && (
            <div className="image-stage">
              <img src={imageUrl} alt={fileName || "Selected OCR input"} />
              {result?.lines.map((line, index) => (
                <div
                  className="ocr-box"
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

        <aside className="result-panel">
          <div className="status-row">
            <div>
              <p className="label">Status</p>
              <p className="status-text">{statusText(progress, isRunning, result, error)}</p>
            </div>
            {result && <span className="count">{result.lines.length}</span>}
          </div>

          {progress?.stage === "recognizing" && (
            <div className="progress-track">
              <span
                style={{
                  width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          )}

          {error && <pre className="error-box">{error}</pre>}

          {logs.length > 0 && (
            <details className="log-panel" open={Boolean(error) || isRunning}>
              <summary>Diagnostics</summary>
              <ol>
                {logs.map((item, index) => (
                  <li key={`${item.time}-${index}`}>
                    <span>{item.time}</span>
                    <p>{item.message}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}

          {result && (
            <>
              <div className="meta-grid">
                <div>
                  <span>Image</span>
                  <strong>
                    {result.image.width} x {result.image.height}
                  </strong>
                </div>
                <div>
                  <span>Elapsed</span>
                  <strong>{result.elapsedMs} ms</strong>
                </div>
              </div>

              <div className="actions">
                <button type="button" onClick={copyText} disabled={!text}>
                  Copy text
                </button>
                <button type="button" onClick={downloadJson}>
                  JSON
                </button>
              </div>

              <textarea value={text} readOnly aria-label="Recognized text" />

              <div className="line-list">
                {result.lines.map((line, index) => (
                  <article key={`${line.text}-${index}`} className="line-item">
                    <p>{line.text}</p>
                    <span>{Math.round(line.score * 100)}%</span>
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
