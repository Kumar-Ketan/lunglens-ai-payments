/**
 * Combines the ResNet18 TB model and the AI second opinion into ONE final result,
 * so the app never shows two conflicting answers. Pure module (safe to unit test).
 */
export const VERDICT_THRESHOLD = 0.5;

export type FinalLabel = "Tuberculosis" | "Pneumonia" | "Normal" | "Not a chest X-ray";

export type VerdictSignals = {
  tb_probability: number;
  ai_status: string;
  ai_label: string | null;
  ai_tb?: number | null;
  ai_pneumonia?: number | null;
  ai_normal?: number | null;
};

export type FinalVerdict = {
  label: FinalLabel;
  /** Combined TB score: average of the trained model and the AI (model only while the AI is pending). */
  tbScore: number;
  pneumoniaScore: number;
  /** "agree" when both readers reach the same conclusion, "resolved" when they differed and the rule decided. */
  agreement: "agree" | "resolved" | "model-only";
  explanation: string;
};

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function finalVerdict(scan: VerdictSignals): FinalVerdict {
  const model = n(scan.tb_probability);
  const modelPositive = model >= VERDICT_THRESHOLD;

  if (scan.ai_status !== "done") {
    return {
      label: modelPositive ? "Tuberculosis" : "Normal",
      tbScore: model,
      pneumoniaScore: 0,
      agreement: "model-only",
      explanation: "Based on the trained model only — the AI second opinion has not finished yet.",
    };
  }

  if (scan.ai_label === "Not a chest X-ray") {
    return {
      label: "Not a chest X-ray",
      tbScore: 0,
      pneumoniaScore: 0,
      agreement: "resolved",
      explanation: "The AI found this is not a frontal chest X-ray, so no diagnosis is given.",
    };
  }

  const aiTb = n(scan.ai_tb);
  const pneumonia = n(scan.ai_pneumonia);
  const tbScore = (model + aiTb) / 2;

  let label: FinalLabel;
  if (tbScore >= VERDICT_THRESHOLD && tbScore >= pneumonia) label = "Tuberculosis";
  else if (pneumonia >= VERDICT_THRESHOLD) label = "Pneumonia";
  else if (tbScore >= VERDICT_THRESHOLD) label = "Tuberculosis";
  else label = "Normal";

  const aiSaysTb = scan.ai_label === "Tuberculosis";
  const modelLabel: FinalLabel = modelPositive ? "Tuberculosis" : "Normal";
  const aiLabel = (scan.ai_label as FinalLabel | null) ?? "Normal";
  const agree = modelPositive === aiSaysTb && (modelPositive || aiLabel === label);

  const explanation = agree
    ? `Both the trained model and the AI point to ${label.toLowerCase()}.`
    : `The two readers differed (model: ${modelLabel}, AI: ${aiLabel}). Combined TB score ${Math.round(
        tbScore * 100,
      )}% vs pneumonia ${Math.round(pneumonia * 100)}% → ${label}.`;

  return { label, tbScore, pneumoniaScore: pneumonia, agreement: agree ? "agree" : "resolved", explanation };
}
