import { describe, expect, it } from "vitest";

import { finalVerdict } from "./final-verdict";

const done = { ai_status: "done", ai_normal: 0.1 };

describe("one final result from the ResNet model and the AI", () => {
  it("uses the model alone while the AI is pending", () => {
    expect(finalVerdict({ tb_probability: 0.8, ai_status: "running", ai_label: null }).label).toBe("Tuberculosis");
  });
  it("agrees on TB when both say TB", () => {
    const v = finalVerdict({ ...done, tb_probability: 0.9, ai_label: "Tuberculosis", ai_tb: 0.8, ai_pneumonia: 0.2 });
    expect(v.label).toBe("Tuberculosis");
    expect(v.agreement).toBe("agree");
  });
  it("keeps TB when the model is strongly positive and the AI leans pneumonia", () => {
    const v = finalVerdict({ ...done, tb_probability: 0.95, ai_label: "Pneumonia", ai_tb: 0.4, ai_pneumonia: 0.6 });
    expect(v.label).toBe("Tuberculosis");
    expect(v.agreement).toBe("resolved");
  });
  it("gives pneumonia when the model is borderline and the AI clearly sees pneumonia", () => {
    const v = finalVerdict({ ...done, tb_probability: 0.55, ai_label: "Pneumonia", ai_tb: 0.1, ai_pneumonia: 0.85 });
    expect(v.label).toBe("Pneumonia");
  });
  it("gives pneumonia when the model is TB negative and the AI sees pneumonia", () => {
    const v = finalVerdict({ ...done, tb_probability: 0.1, ai_label: "Pneumonia", ai_tb: 0.1, ai_pneumonia: 0.8 });
    expect(v.label).toBe("Pneumonia");
    expect(v.agreement).toBe("agree");
  });
  it("is normal when neither finds disease", () => {
    expect(finalVerdict({ ...done, tb_probability: 0.1, ai_label: "Normal", ai_tb: 0.05, ai_pneumonia: 0.1 }).label).toBe("Normal");
  });
  it("gives no diagnosis for a non chest X-ray", () => {
    expect(finalVerdict({ ...done, tb_probability: 0.7, ai_label: "Not a chest X-ray" }).label).toBe("Not a chest X-ray");
  });
});
