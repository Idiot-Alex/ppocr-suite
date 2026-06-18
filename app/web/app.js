const form = document.querySelector("#ocr-form");
const fileInput = document.querySelector("#file-input");
const apiKeyInput = document.querySelector("#api-key");
const submitButton = document.querySelector("#submit-button");
const clearButton = document.querySelector("#clear-button");
const previewImage = document.querySelector("#preview-image");
const previewWrap = document.querySelector("#preview-wrap");
const overlay = document.querySelector("#overlay");
const emptyState = document.querySelector("#empty-state");
const statusBadge = document.querySelector("#status");
const imageMeta = document.querySelector("#image-meta");
const resultMeta = document.querySelector("#result-meta");
const resultList = document.querySelector("#result-list");
const fullText = document.querySelector("#full-text");
const textSummary = document.querySelector("#text-summary");
const errorBox = document.querySelector("#error-box");

let currentImageUrl = null;
let latestResults = [];

const savedApiKey = window.localStorage.getItem("ppocr_api_key");
if (savedApiKey) {
  apiKeyInput.value = savedApiKey;
}

function setStatus(label, state = "idle") {
  statusBadge.textContent = label;
  statusBadge.classList.toggle("is-working", state === "working");
  statusBadge.classList.toggle("is-error", state === "error");
}

function setError(message) {
  errorBox.hidden = !message;
  errorBox.textContent = message || "";
  if (message) {
    setStatus("Error", "error");
  }
}

function clearResults() {
  latestResults = [];
  overlay.innerHTML = "";
  resultList.innerHTML = "";
  fullText.textContent = "";
  textSummary.hidden = true;
  resultMeta.textContent = "Waiting for analysis";
  setError("");
  setStatus("Idle");
}

function resetImage() {
  if (currentImageUrl) {
    URL.revokeObjectURL(currentImageUrl);
    currentImageUrl = null;
  }
  previewImage.hidden = true;
  previewImage.removeAttribute("src");
  emptyState.hidden = false;
  imageMeta.textContent = "No image selected";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "-";
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getImageRectInWrap() {
  const wrapRect = previewWrap.getBoundingClientRect();
  const imageRect = previewImage.getBoundingClientRect();
  return {
    left: imageRect.left - wrapRect.left + previewWrap.scrollLeft,
    top: imageRect.top - wrapRect.top + previewWrap.scrollTop,
    width: imageRect.width,
    height: imageRect.height,
  };
}

function normalizeBox(bbox) {
  if (!Array.isArray(bbox) || bbox.length === 0) {
    return null;
  }

  if (bbox.length === 4 && bbox.every((value) => typeof value === "number")) {
    const [x1, y1, x2, y2] = bbox;
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  const points = bbox
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map((point) => ({ x: Number(point[0]), y: Number(point[1]) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  if (points.length === 0) {
    return null;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

function renderOverlay() {
  overlay.innerHTML = "";

  if (previewImage.hidden || !previewImage.naturalWidth || !previewImage.naturalHeight) {
    return;
  }

  const imageRect = getImageRectInWrap();
  overlay.style.left = `${imageRect.left}px`;
  overlay.style.top = `${imageRect.top}px`;
  overlay.style.width = `${imageRect.width}px`;
  overlay.style.height = `${imageRect.height}px`;

  const scaleX = imageRect.width / previewImage.naturalWidth;
  const scaleY = imageRect.height / previewImage.naturalHeight;

  latestResults.forEach((item, index) => {
    const box = normalizeBox(item.bbox);
    if (!box || box.width <= 0 || box.height <= 0) {
      return;
    }

    const marker = document.createElement("div");
    marker.className = "ocr-box";
    marker.dataset.index = String(index + 1);
    marker.title = item.text || "";
    marker.style.left = `${box.x * scaleX}px`;
    marker.style.top = `${box.y * scaleY}px`;
    marker.style.width = `${box.width * scaleX}px`;
    marker.style.height = `${box.height * scaleY}px`;
    overlay.appendChild(marker);
  });
}

function renderResults(payload) {
  latestResults = Array.isArray(payload.results) ? payload.results : [];
  const texts = Array.isArray(payload.texts) ? payload.texts : [];

  resultMeta.textContent = `${latestResults.length} positioned items, ${texts.length} text lines`;
  fullText.textContent = texts.join("\n");
  textSummary.hidden = texts.length === 0;
  resultList.innerHTML = "";

  latestResults.forEach((item) => {
    const li = document.createElement("li");
    li.className = "result-item";

    const text = document.createElement("div");
    text.className = "result-text";
    text.textContent = item.text || "";

    const data = document.createElement("div");
    data.className = "result-data";
    const score = typeof item.score === "number" ? item.score.toFixed(4) : "-";
    data.innerHTML = `<span>score: ${score}</span><span>bbox: ${JSON.stringify(item.bbox ?? null)}</span>`;

    li.append(text, data);
    resultList.appendChild(li);
  });

  renderOverlay();
}

fileInput.addEventListener("change", () => {
  clearResults();
  resetImage();

  const file = fileInput.files?.[0];
  if (!file) {
    return;
  }

  currentImageUrl = URL.createObjectURL(file);
  previewImage.src = currentImageUrl;
  previewImage.hidden = false;
  emptyState.hidden = true;
  imageMeta.textContent = `${file.name} · ${formatBytes(file.size)}`;
});

previewImage.addEventListener("load", renderOverlay);
window.addEventListener("resize", renderOverlay);
previewWrap.addEventListener("scroll", renderOverlay);

clearButton.addEventListener("click", () => {
  fileInput.value = "";
  resetImage();
  clearResults();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");

  const file = fileInput.files?.[0];
  const apiKey = apiKeyInput.value.trim();

  if (!file) {
    setError("Please select an image first.");
    return;
  }

  window.localStorage.setItem("ppocr_api_key", apiKey);
  submitButton.disabled = true;
  submitButton.textContent = "Running";
  setStatus("Analyzing", "working");
  resultMeta.textContent = "OCR request in progress";
  resultList.innerHTML = "";
  textSummary.hidden = true;
  overlay.innerHTML = "";

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/ocr", {
      method: "POST",
      headers: apiKey ? { "x-api-key": apiKey } : {},
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.detail || `Request failed with HTTP ${response.status}`);
    }

    renderResults(payload);
    setStatus("Done");
  } catch (error) {
    clearResults();
    setError(error instanceof Error ? error.message : "OCR request failed.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Analyze";
  }
});
