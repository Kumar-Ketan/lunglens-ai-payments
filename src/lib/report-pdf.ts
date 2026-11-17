import { confidenceBand, TB_THRESHOLD } from "@/lib/model/tb-label";
import { findingsOf, pct, type Scan } from "@/lib/scans";
import { finalVerdict } from "@/lib/final-verdict";

async function toDataUrl(url: string) {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function imageSize(dataUrl: string) {
  return new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = dataUrl;
  });
}

/** Builds and downloads a one-page A4 research report for a scan. */
export async function downloadScanReport(scan: Scan, imageUrl?: string, heatmapUrl?: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 15;
  let y = 0;

  // Header band
  doc.setFillColor(18, 28, 40);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(120, 220, 235);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("LungScan AI", M, 13);
  doc.setTextColor(230, 238, 245);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Chest X-ray research report  ·  TB (ResNet18 + Grad-CAM) and AI second opinion", M, 20);
  y = 36;

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  const meta = [
    ["Scan ID", scan.id],
    ["Date", new Date(scan.created_at).toLocaleString()],
    ["Patient / reference", scan.patient_ref || "—"],
    ["Source file", `${scan.file_name} (${scan.file_type})`],
    ["Model", scan.model_version],
  ];
  meta.forEach(([k, v], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(String(k), M, y + i * 5);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), M + 38, y + i * 5);
  });
  y += meta.length * 5 + 4;

  // Images
  const imgW = (W - 2 * M - 6) / 2;
  let imgH = 0;
  try {
    if (imageUrl) {
      const a = await toDataUrl(imageUrl);
      const { w, h } = await imageSize(a);
      imgH = Math.min(80, (imgW * h) / w);
      const drawW = (imgH * w) / h;
      doc.addImage(a, "JPEG", M + (imgW - drawW) / 2, y, drawW, imgH);
      if (heatmapUrl) {
        const b = await toDataUrl(heatmapUrl);
        doc.addImage(b, "JPEG", M + imgW + 6 + (imgW - drawW) / 2, y, drawW, imgH);
      }
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text("Original X-ray", M + imgW / 2, y + imgH + 4, { align: "center" });
      doc.text("Grad-CAM: regions driving the TB score", M + imgW + 6 + imgW / 2, y + imgH + 4, { align: "center" });
      y += imgH + 10;
    }
  } catch {
    /* images are optional in the report */
  }

  // TB model
  doc.setDrawColor(220, 220, 220);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const verdict = finalVerdict(scan);
  doc.text(`Final result: ${verdict.label}`, M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(verdict.explanation, 180), M, y);
  y += 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("1. Trained model — tuberculosis", M, y);
  y += 6;
  doc.setFontSize(10);
  const positive = scan.tb_probability >= TB_THRESHOLD;
  doc.setTextColor(positive ? 200 : 30, positive ? 50 : 140, positive ? 60 : 80);
  doc.text(`${scan.tb_label}`, M, y);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.text(
    `TB probability ${pct(scan.tb_probability)}  ·  threshold ${TB_THRESHOLD}  ·  confidence ${confidenceBand(scan.tb_probability)}`,
    M + 32,
    y,
  );
  y += 9;

  // AI
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("2. AI second opinion", M, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (scan.ai_status === "done") {
    doc.text(
      `Most likely: ${scan.ai_label ?? "—"}   ·   Normal ${pct(scan.ai_normal)}   ·   Pneumonia ${pct(scan.ai_pneumonia)}   ·   TB ${pct(scan.ai_tb)}   ·   Image quality: ${scan.ai_image_quality ?? "—"}`,
      M,
      y,
    );
    y += 6;
    const findings = findingsOf(scan);
    if (findings.length) {
      doc.setFont("helvetica", "bold");
      doc.text("Findings", M, y);
      doc.setFont("helvetica", "normal");
      y += 5;
      findings.forEach((f) => {
        const lines = doc.splitTextToSize(`• ${f.region} (${f.severity}): ${f.observation}`, W - 2 * M);
        doc.text(lines, M, y);
        y += lines.length * 4.2;
      });
      y += 2;
    }
    if (scan.ai_impression) {
      doc.setFont("helvetica", "bold");
      doc.text("Impression", M, y);
      doc.setFont("helvetica", "normal");
      y += 5;
      const lines = doc.splitTextToSize(scan.ai_impression, W - 2 * M);
      doc.text(lines, M, y);
      y += lines.length * 4.2 + 2;
    }
  } else {
    doc.text(scan.ai_status === "failed" ? `Not available: ${scan.ai_error ?? "AI analysis failed"}` : "Not available yet.", M, y);
    y += 6;
  }

  if (scan.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes", M, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    const lines = doc.splitTextToSize(scan.notes, W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 4.2;
  }

  // Disclaimer footer
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  const disclaimer = doc.splitTextToSize(
    "Research use only. Generated by an academic prototype; not a medical device and not validated for clinical diagnosis or treatment decisions. Always consult a qualified radiologist.",
    W - 2 * M,
  );
  doc.text(disclaimer, M, 285);

  doc.save(`lungscan-report-${scan.id.slice(0, 8)}.pdf`);
}
