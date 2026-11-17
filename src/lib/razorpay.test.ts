import { describe, expect, it } from "vitest";

import { CONSULT_FEE_PAISE } from "./consult";
import { hmacSha256Hex, isValidCheckoutSignature, isValidWebhookSignature, paymentSettlesBooking } from "./razorpay";

const booking = { razorpay_order_id: "order_ABC", amount_paise: CONSULT_FEE_PAISE, currency: "INR" };
const paid = { id: "pay_1", order_id: "order_ABC", amount: 49900, currency: "INR", status: "captured" };

describe("a booking is confirmed only by a full ₹499 payment for its own order", () => {
  it("accepts a captured ₹499 payment for the booking's order", () => {
    expect(paymentSettlesBooking(paid, booking)).toBe(true);
  });
  it("rejects a payment for a different order", () => {
    expect(paymentSettlesBooking({ ...paid, order_id: "order_OTHER" }, booking)).toBe(false);
  });
  it("rejects a partial amount", () => {
    expect(paymentSettlesBooking({ ...paid, amount: 100 }, booking)).toBe(false);
  });
  it("rejects a failed payment", () => {
    expect(paymentSettlesBooking({ ...paid, status: "failed" }, booking)).toBe(false);
  });
  it("rejects when the booking never started a payment", () => {
    expect(paymentSettlesBooking(paid, { ...booking, razorpay_order_id: null })).toBe(false);
  });
});

describe("Razorpay signatures", () => {
  it("accepts the correct checkout signature and rejects a forged one", async () => {
    const sig = await hmacSha256Hex("secret", "order_ABC|pay_1");
    expect(await isValidCheckoutSignature("secret", "order_ABC", "pay_1", sig)).toBe(true);
    expect(await isValidCheckoutSignature("secret", "order_ABC", "pay_2", sig)).toBe(false);
    expect(await isValidCheckoutSignature("wrong", "order_ABC", "pay_1", sig)).toBe(false);
  });
  it("checks webhook bodies against their signature", async () => {
    const body = '{"event":"payment.captured"}';
    const sig = await hmacSha256Hex("whsec", body);
    expect(await isValidWebhookSignature("whsec", body, sig)).toBe(true);
    expect(await isValidWebhookSignature("whsec", body + " ", sig)).toBe(false);
  });
});
