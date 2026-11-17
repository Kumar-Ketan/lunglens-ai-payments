// Browser-side DICOM decoding for uncompressed chest X-rays (mirrors the repo's read_dicom min-max scaling).
const UNCOMPRESSED = new Set(["1.2.840.10008.1.2", "1.2.840.10008.1.2.1", "1.2.840.10008.1.2.2"]);

export async function dicomToCanvas(file: File): Promise<HTMLCanvasElement> {
  const mod = await import("dicom-parser");
  const dicomParser = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let dataSet;
  try {
    dataSet = dicomParser.parseDicom(bytes);
  } catch {
    throw new Error("This file could not be read as a DICOM image.");
  }
  const transferSyntax = dataSet.string("x00020010") ?? "1.2.840.10008.1.2";
  if (!UNCOMPRESSED.has(transferSyntax)) {
    throw new Error("Compressed DICOM files are not supported yet. Please export the image as uncompressed DICOM or JPEG.");
  }
  const rows = dataSet.uint16("x00280010");
  const cols = dataSet.uint16("x00280011");
  const bitsAllocated = dataSet.uint16("x00280100") ?? 16;
  const pixelRepresentation = dataSet.uint16("x00280103") ?? 0;
  const samples = dataSet.uint16("x00280002") ?? 1;
  const photometric = (dataSet.string("x00280004") ?? "MONOCHROME2").trim();
  const pixelElement = dataSet.elements["x7fe00010"];
  if (!rows || !cols || !pixelElement) throw new Error("The DICOM file has no readable image data.");
  if (samples !== 1) throw new Error("Only greyscale DICOM X-rays are supported.");

  const count = rows * cols;
  const offset = pixelElement.dataOffset;
  let pixels: ArrayLike<number>;
  if (bitsAllocated === 16) {
    const buffer = bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + count * 2);
    pixels = pixelRepresentation === 1 ? new Int16Array(buffer) : new Uint16Array(buffer);
  } else if (bitsAllocated === 8) {
    pixels = bytes.subarray(offset, offset + count);
  } else {
    throw new Error(`Unsupported DICOM bit depth: ${bitsAllocated}.`);
  }

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const v = pixels[i] ?? 0;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(cols, rows);
  const invert = photometric === "MONOCHROME1";
  for (let i = 0; i < count; i++) {
    let g = Math.round((((pixels[i] ?? 0) - min) / range) * 255);
    if (invert) g = 255 - g;
    const j = i * 4;
    image.data[j] = g;
    image.data[j + 1] = g;
    image.data[j + 2] = g;
    image.data[j + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
