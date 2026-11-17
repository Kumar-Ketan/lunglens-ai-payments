import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { isTestKey, paymentMethodLabel, paymentSettlesBooking, type RazorpayPayment } from "@/lib/razorpay";

const API = "https://api.razorpay.com/v1";

export function razorpayKeys() {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) throw new Error("Payments are not set up yet. Please try again later.");
  return { keyId, keySecret };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const { keyId, keySecret } = razorpayKeys();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => null)) as T & { error?: { description?: string } };
  if (!res.ok) {
    console.error("Razorpay API error", res.status, body?.error?.description);
    throw new Error("The payment service could not be reached. Please try again.");
  }
  return body;
}

export function createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }) {
  return call<{ id: string; amount: number; currency: string; status: string }>("/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchPayment(paymentId: string) {
  return call<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

type Admin = SupabaseClient<Database>;
type Booking = Database["public"]["Tables"]["consultations"]["Row"];

export class SlotTakenError extends Error {}

/**
 * Marks a pending booking as paid after the payment was verified with Razorpay.
 * Idempotent: an already-confirmed booking is returned unchanged.
 */
export async function confirmPaidBooking(admin: Admin, booking: Booking, payment: RazorpayPayment) {
  if (booking.status === "confirmed") return booking;
  if (booking.status !== "pending_payment") throw new Error("This booking was cancelled.");
  if (!paymentSettlesBooking(payment, booking)) throw new Error("The payment does not match this booking.");

  const { keyId } = razorpayKeys();
  const { data: updated, error } = await admin
    .from("consultations")
    .update({
      status: "confirmed",
      payment_method: paymentMethodLabel(payment.method, isTestKey(keyId)),
      payment_ref: payment.id,
      paid_at: new Date().toISOString(),
      is_test_payment: isTestKey(keyId),
    })
    .eq("id", booking.id)
    .eq("status", "pending_payment")
    .select("*")
    .maybeSingle();
  if (error?.code === "23505") throw new SlotTakenError("Someone else just booked this time.");
  if (error) throw new Error("Could not confirm the payment.");
  if (!updated) {
    // Another request (checkout callback or webhook) confirmed it first.
    const { data: current } = await admin.from("consultations").select("*").eq("id", booking.id).single();
    if (current?.status === "confirmed") return current;
    throw new Error("Could not confirm the payment.");
  }
  return updated;
}
