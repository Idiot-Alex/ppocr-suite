import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="shell">
      <section className="panel">
        <div>
          <p className="eyebrow">PP-OCR Web</p>
          <h1>Browser OCR workspace</h1>
          <p className="copy">
            This subproject is reserved for the ONNX browser OCR pipeline. Drop PP-OCRv6
            tiny det/rec models into the model asset path, then implement preprocessing,
            inference, postprocessing, and decoding in isolated OCR modules.
          </p>
        </div>
        <label className="dropzone">
          <input type="file" accept="image/*" />
          <span>Select an image</span>
        </label>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
