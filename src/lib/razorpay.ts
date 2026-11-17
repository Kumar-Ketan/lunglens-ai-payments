/**
 * Razorpay rules shared by server functions, the webhook and tests.
 * Pure module: no secrets, env reads or Supabase imports.
 */

/** HMAC-SHA256 of `message` with `secret`, hex encoded (Razorpay's signature format). */
export async function hmacSha256Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare so signature checks don't leak timing. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checkout signature: HMAC(order_id + "|" + payment_id) with the key secret. */
export async function isValidCheckoutSignature(
  secret: string,
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const expected = await hmacSha256Hex(secret, `${orderId}|${paymentId}`);
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC(raw body) with the webhook secret. */
export async function isValidWebhookSignature(secret: string, rawBody: string, signature: string) {
  const expected = await hmacSha256Hex(secret, rawBody);
  return safeEqual(expected, signature);
}

export type RazorpayPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  method?: string;
};

/** A payment confirms a booking only if it is for that order, in full, and actually paid. */
export function paymentSettlesBooking(
  payment: RazorpayPayment,
  booking: { razorpay_order_id: string | null; amount_paise: number; currency: string },
) {
  return (
    !!booking.razorpay_order_id &&
    payment.order_id === booking.razorpay_order_id &&
    payment.amount === booking.amount_paise &&
    payment.currency === booking.currency &&
    (payment.status === "captured" || payment.status === "authorized")
  );
}

const METHOD_LABELS: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  wallet: "Wallet",
  emi: "EMI",
  paylater: "Pay later",
};

export function paymentMethodLabel(method: string | undefined, isTest: boolean) {
  const label = (method && METHOD_LABELS[method]) || "Razorpay";
  return isTest ? `${label} (Razorpay test mode)` : `${label} (Razorpay)`;
}

export const isTestKey = (keyId: string) => keyId.startsWith("rzp_test_");
