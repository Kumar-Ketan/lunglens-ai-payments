import { describe, expect, it } from "vitest";

import { confidenceBand, normalizePixel, tbLabelFor } from "./tb-label";

describe("TB decision rule", () => {
  it("labels a probability of exactly 0.5 as TB Positive", () => {
    expect(tbLabelFor(0.5)).toBe("TB Positive");
  });
  it("labels a probability just under 0.5 as TB Negative", () => {
    expect(tbLabelFor(0.4999)).toBe("TB Negative");
  });
});

describe("preprocessing", () => {
  it("normalizes pixels to -1..1 like Normalize([0.5],[0.5])", () => {
    expect(normalizePixel(0)).toBe(-1);
    expect(normalizePixel(255)).toBe(1);
  });
});

describe("confidence band", () => {
  it("is High at 0.9 and Low at 0.55", () => {
    expect(confidenceBand(0.9)).toBe("High");
    expect(confidenceBand(0.55)).toBe("Low");
  });
});
