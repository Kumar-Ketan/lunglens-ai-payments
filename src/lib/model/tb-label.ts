/** Decision threshold used by the original Streamlit app and notebook (sigmoid output >= 0.5). */
export const TB_THRESHOLD = 0.5;

export type TbLabel = "TB Positive" | "TB Negative";

export function tbLabelFor(probability: number): TbLabel {
  return probability >= TB_THRESHOLD ? "TB Positive" : "TB Negative";
}

/** Mirrors torchvision Normalize([0.5],[0.5]) applied after ToTensor(): maps 0..255 to -1..1. */
export function normalizePixel(value: number) {
  return (value / 255 - 0.5) / 0.5;
}

export type ConfidenceBand = "High" | "Moderate" | "Low";

/** How far the score sits from the 0.5 decision boundary. */
export function confidenceBand(probability: number): ConfidenceBand {
  const distance = Math.abs(probability - TB_THRESHOLD);
  if (distance >= 0.3) return "High";
  if (distance >= 0.15) return "Moderate";
  return "Low";
}
