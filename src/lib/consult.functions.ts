import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CONSULT_CURRENCY,
  CONSULT_FEE_PAISE,
  detectedConditions,
  doctorById,
  isBookableSlot,
  normalizeIndianPhone,
} from "@/lib/consult";

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

function dayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00+05:30`);
  return { from: start.toISOString(), to: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString() };
}

/** Times already confirmed for a doctor on an IST date (only times, never who booked them). */
export const getBookedSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { doctorId: string; dateKey: string }) => {
    if (!input || !doctorById(input.doctorId)) throw new Error("Unknown doctor");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKey)) throw new Error("Invalid date");
    return { doctorId: input.doctorId, dateKey: input.dateKey };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { from, to } = dayRange(data.dateKey);
    const { data: rows, error } = await supabaseAdmin
      .from("consultations")
      .select("slot_at")
      .eq("doctor_id", data.doctorId)
      .eq("status", "confirmed")
      .gte("slot_at", from)
      .lt("slot_at", to);
    if (error) throw new Error("Could not load availability.");
    return (rows ?? []).map((r) => new Date(r.slot_at).toISOString());
  });

type CreateInput = {
  scanId: string;
  doctorId: string;
  slotAt: string;
  patientName: string;
  patientPhone: string;
  concern?: string;
};

/** Creates a booking awaiting payment, for a scan the caller owns where TB or pneumonia was detected. */
export const createConsultation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateInput) => {
    if (!input || !isId(input.scanId)) throw new Error("Invalid scan");
    if (!doctorById(input.doctorId)) throw new Error("Please choose a doctor.");
    const name = String(input.patientName ?? "").trim();
    if (name.length < 2 || name.length > 80) throw new Error("Please enter the patient's name.");
    const phone = normalizeIndianPhone(String(input.patientPhone ?? ""));
    if (!phone) throw new Error("Please enter a valid 10-digit Indian mobile number.");
    const concern = String(input.concern ?? "").trim().slice(0, 500);
    return { ...input, patientName: name, patientPhone: phone, concern: concern || null };
  })
  .handler(async ({ data, context }) => {
    const { data: scan, error } = await context.supabase
      .from("scans")
      .select("id, tb_probability, ai_status, ai_label")
      .eq("id", data.scanId)
      .maybeSingle();
    if (error || !scan) throw new Error("Scan not found.");
    const conditions = detectedConditions(scan);
    if (conditions.length === 0) throw new Error("A consultation is only offered when TB or pneumonia is detected.");

    if (!isBookableSlot(data.doctorId, data.slotAt, new Date())) {
      throw new Error("That time is no longer available. Please pick another slot.");
    }
    const slotAt = new Date(data.slotAt).toISOString();
    const doctor = doctorById(data.doctorId)!;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: taken } = await supabaseAdmin
      .from("consultations")
      .select("id")
      .eq("doctor_id", doctor.id)
      .eq("slot_at", slotAt)
      .eq("status", "confirmed")
      .limit(1);
    if (taken && taken.length > 0) throw new Error("That time was just booked. Please pick another slot.");

    const { data: created, error: insertError } = await supabaseAdmin
      .from("consultations")
      .insert({
        user_id: context.userId,
        scan_id: scan.id,
        doctor_id: doctor.id,
        doctor_name: doctor.name,
        specialty: doctor.specialty,
        slot_at: slotAt,
        patient_name: data.patientName,
        patient_phone: data.patientPhone,
        concern: data.concern,
        detected_condition: conditions.join(" & "),
        amount_paise: CONSULT_FEE_PAISE,
        currency: CONSULT_CURRENCY,
        status: "pending_payment",
        is_test_payment: true,
      })
      .select("id")
      .single();
    if (insertError || !created) throw new Error("Could not create the booking.");
    return { id: created.id };
  });

function testPaymentRef() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `TEST-UPI-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * Demo payment confirmation. No money moves: this stands in for the step where a real
 * gateway would verify the payment before the booking is confirmed.
 */
export const confirmTestPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { consultationId: string }) => {
    if (!input || !isId(input.consultationId)) throw new Error("Invalid booking");
    return { consultationId: input.consultationId };
  })
  .handler(async ({ data, context }) => {
    const { data: booking, error } = await context.supabase
      .from("consultations")
      .select("*")
      .eq("id", data.consultationId)
      .maybeSingle();
    if (error || !booking) throw new Error("Booking not found.");
    if (booking.status === "confirmed") return booking;
    if (booking.status !== "pending_payment") throw new Error("This booking was cancelled.");
    if (new Date(booking.slot_at).getTime() <= Date.now()) {
      throw new Error("This time slot has passed. Please book a new time.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error: upError } = await supabaseAdmin
      .from("consultations")
      .update({
        status: "confirmed",
        payment_method: "UPI QR (test mode)",
        payment_ref: testPaymentRef(),
        paid_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("user_id", context.userId)
      .eq("status", "pending_payment")
      .select("*")
      .single();
    if (upError?.code === "23505") {
      throw new Error("Someone else just booked this time. No money was taken. Please pick another slot.");
    }
    if (upError || !updated) throw new Error("Could not confirm the payment.");
    return updated;
  });

/** Cancels the caller's booking if the appointment has not started yet. */
export const cancelConsultation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { consultationId: string }) => {
    if (!input || !isId(input.consultationId)) throw new Error("Invalid booking");
    return { consultationId: input.consultationId };
  })
  .handler(async ({ data, context }) => {
    const { data: booking, error } = await context.supabase
      .from("consultations")
      .select("id, status, slot_at")
      .eq("id", data.consultationId)
      .maybeSingle();
    if (error || !booking) throw new Error("Booking not found.");
    if (booking.status === "cancelled") throw new Error("This booking is already cancelled.");
    if (new Date(booking.slot_at).getTime() <= Date.now()) throw new Error("Past appointments cannot be cancelled.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error: upError } = await supabaseAdmin
      .from("consultations")
      .update({ status: "cancelled" })
      .eq("id", booking.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (upError || !updated) throw new Error("Could not cancel the booking.");
    return updated;
  });
