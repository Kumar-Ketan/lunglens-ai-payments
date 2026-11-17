// Runs the GitHub project's trained ResNet18 TB classifier in the browser (ONNX Runtime Web).
// The exported graph returns both the sigmoid probability and an exact 7x7 Grad-CAM map
// (gradient of the TB logit w.r.t. layer4 activations, computed analytically inside the graph).
import modelAsset from "@/assets/tb_resnet18_gradcam.onnx.asset.json";

import { normalizePixel, tbLabelFor, type TbLabel } from "./tb-label";

type OrtModule = typeof import("onnxruntime-web");
type Session = import("onnxruntime-web").InferenceSession;

export const MODEL_VERSION = "resnet18-tb-v1";
export const MODEL_SIZE_BYTES = modelAsset.size;

let sessionPromise: Promise<{ ort: OrtModule; session: Session }> | null = null;
const listeners = new Set<(fraction: number) => void>();
let lastProgress = 0;

export function onModelProgress(cb: (fraction: number) => void) {
  listeners.add(cb);
  cb(lastProgress);
  return () => listeners.delete(cb);
}

function emit(fraction: number) {
  lastProgress = fraction;
  listeners.forEach((cb) => cb(fraction));
}

async function fetchWithProgress(url: string) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error("The model file could not be downloaded.");
  const total = Number(response.headers.get("content-length")) || modelAsset.size;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    emit(Math.min(0.99, received / total));
  }
  const out = new Uint8Array(received);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export function loadTbModel() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
      ort.env.wasm.numThreads = 1;
      const bytes = await fetchWithProgress(modelAsset.url);
      const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
      emit(1);
      return { ort, session };
    })().catch((error) => {
      sessionPromise = null;
      emit(0);
      throw error;
    });
  }
  return sessionPromise;
}

export type TbPrediction = {
  probability: number;
  label: TbLabel;
  cam: Float32Array; // 7x7, normalized 0..1
  camMax: number;
  inferenceMs: number;
};

/** Resize to 224x224, scale to 0..1, Normalize(0.5, 0.5) and lay out as NCHW, like the training transform. */
function toTensorData(source: CanvasImageSource) {
  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 224;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, 224, 224);
  const { data } = ctx.getImageData(0, 0, 224, 224);
  const plane = 224 * 224;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    out[i] = normalizePixel(data[i * 4] ?? 0);
    out[plane + i] = normalizePixel(data[i * 4 + 1] ?? 0);
    out[2 * plane + i] = normalizePixel(data[i * 4 + 2] ?? 0);
  }
  return out;
}

export async function predictTb(source: CanvasImageSource): Promise<TbPrediction> {
  const { ort, session } = await loadTbModel();
  const input = new ort.Tensor("float32", toTensorData(source), [1, 3, 224, 224]);
  const started = performance.now();
  const outputs = await session.run({ input });
  const inferenceMs = performance.now() - started;
  const probOut = outputs["prob"];
  const camOut = outputs["cam"];
  if (!probOut || !camOut) throw new Error("The model returned an unexpected output.");
  const probability = (probOut.data as Float32Array)[0] ?? 0;
  const raw = camOut.data as Float32Array;
  let camMax = 0;
  for (const v of raw) camMax = Math.max(camMax, v);
  const cam = new Float32Array(49);
  for (let i = 0; i < 49; i++) cam[i] = camMax > 0 ? (raw[i] ?? 0) / camMax : 0;
  return { probability, label: tbLabelFor(probability), cam, camMax, inferenceMs };
}

function jet(t: number): [number, number, number] {
  const r = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 3)));
  const g = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 2)));
  const b = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 1)));
  return [r * 255, g * 255, b * 255];
}

/** Bilinear-upsamples the 7x7 Grad-CAM and blends a jet colour map over the X-ray. */
export function renderHeatmapOverlay(source: HTMLCanvasElement, cam: Float32Array) {
  const w = source.width;
  const h = source.height;
  const overlay = document.createElement("canvas");
  overlay.width = w;
  overlay.height = h;
  const ctx = overlay.getContext("2d")!;
  ctx.drawImage(source, 0, 0);

  const size = 224;
  const heat = document.createElement("canvas");
  heat.width = size;
  heat.height = size;
  const hctx = heat.getContext("2d")!;
  const img = hctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const gy = Math.min(6, Math.max(0, ((y + 0.5) / size) * 7 - 0.5));
    const y0 = Math.floor(gy);
    const y1 = Math.min(6, y0 + 1);
    const fy = gy - y0;
    for (let x = 0; x < size; x++) {
      const gx = Math.min(6, Math.max(0, ((x + 0.5) / size) * 7 - 0.5));
      const x0 = Math.floor(gx);
      const x1 = Math.min(6, x0 + 1);
      const fx = gx - x0;
      const v =
        (cam[y0 * 7 + x0] ?? 0) * (1 - fx) * (1 - fy) +
        (cam[y0 * 7 + x1] ?? 0) * fx * (1 - fy) +
        (cam[y1 * 7 + x0] ?? 0) * (1 - fx) * fy +
        (cam[y1 * 7 + x1] ?? 0) * fx * fy;
      const [r, g, b] = jet(v);
      const j = (y * size + x) * 4;
      img.data[j] = r;
      img.data[j + 1] = g;
      img.data[j + 2] = b;
      img.data[j + 3] = v < 0.15 ? 0 : Math.round(Math.min(0.6, v * 0.65) * 255);
    }
  }
  hctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(heat, 0, 0, w, h);
  return overlay;
}

/** Downscales an image so the longest side is at most `max` px (keeps uploads and AI payloads small). */
export function fitCanvas(source: CanvasImageSource & { width: number; height: number }, max = 1024) {
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: "image/jpeg" | "image/png", quality = 0.9) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), type, quality),
  );
}

export async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const isDicom = file.name.toLowerCase().endsWith(".dcm") || file.type === "application/dicom";
  if (isDicom) {
    const { dicomToCanvas } = await import("./dicom");
    return dicomToCanvas(file);
  }
  if (!file.type.startsWith("image/")) throw new Error("Please choose a JPG, PNG or DICOM (.dcm) chest X-ray.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This image could not be opened.");
  });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}
