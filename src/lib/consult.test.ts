import { describe, expect, it } from "vitest";

import {
  CONSULT_FEE_PAISE,
  demoQrPayload,
  detectedConditions,
  doctorById,
  formatInr,
  isBookableSlot,
  normalizeIndianPhone,
  upcomingDays,
} from "./consult";

const base = { tb_probability: 0.2, ai_status: "done", ai_label: "Normal" };

describe("consultation fee", () => {
  it("is ₹499", () => {
    expect(CONSULT_FEE_PAISE).toBe(49900);
    expect(formatInr(CONSULT_FEE_PAISE)).toBe("₹499");
  });
});

describe("consult a doctor is offered only when TB or pneumonia is detected", () => {
  it("offers it when the TB model is positive", () => {
    expect(detectedConditions({ ...base, tb_probability: 0.886 })).toEqual(["Tuberculosis"]);
  });
  it("offers it when the AI second opinion says pneumonia", () => {
    expect(detectedConditions({ ...base, ai_label: "Pneumonia" })).toEqual(["Pneumonia"]);
  });
  it("offers it when the AI second opinion says tuberculosis", () => {
    expect(detectedConditions({ ...base, ai_label: "Tuberculosis" })).toEqual(["Tuberculosis"]);
  });
  it("does not offer it for a normal scan", () => {
    expect(detectedConditions(base)).toEqual([]);
  });
  it("ignores an AI label that is not finished yet", () => {
    expect(detectedConditions({ ...base, ai_status: "running", ai_label: "Pneumonia" })).toEqual([]);
  });
});

describe("demo payment never takes real money", () => {
  it("QR is not a payable UPI link", () => {
    const payload = demoQrPayload("abc", CONSULT_FEE_PAISE);
    expect(payload.startsWith("upi:")).toBe(false);
    expect(payload).toContain("₹499");
  });
});

describe("slot booking", () => {
  // Monday 2026-11-16, 09:00 IST
  const now = new Date("2026-11-16T03:30:00Z");
  it("does not offer Sundays", () => {
    const days = upcomingDays(doctorById("dr-ananya-sharma")!, now);
    expect(days).not.toContain("2026-11-22");
    expect(days[0]).toBe("2026-11-16");
  });
  it("accepts a real future slot and rejects past or made-up times", () => {
    expect(isBookableSlot("dr-ananya-sharma", "2026-11-16T10:30:00+05:30", now)).toBe(true);
    expect(isBookableSlot("dr-ananya-sharma", "2026-11-16T09:15:00+05:30", now)).toBe(false);
    expect(isBookableSlot("dr-ananya-sharma", "2026-11-16T10:15:00+05:30", now)).toBe(false);
    expect(isBookableSlot("dr-unknown", "2026-11-16T10:30:00+05:30", now)).toBe(false);
  });
});

describe("phone numbers", () => {
  it("accepts Indian mobiles and rejects others", () => {
    expect(normalizeIndianPhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizeIndianPhone("09876543210")).toBe("9876543210");
    expect(normalizeIndianPhone("12345")).toBeNull();
    expect(normalizeIndianPhone("5876543210")).toBeNull();
  });
});
