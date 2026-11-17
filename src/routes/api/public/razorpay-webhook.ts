import { createFileRoute } from "@tanstack/react-router";

/**
 * Razorpay webhook (payment.captured / order.paid). Backup path that confirms a booking
 * even if the patient closes the tab before the checkout callback reaches us.
 * Callers are verified with the X-Razorpay-Signature header.
 */
export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const raw = await request.text();
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const { isValidWebhookSignature } = await import("@/lib/razorpay");
        if (!signature || !(await isValidWebhookSignature(secret, raw, signature))) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: { event?: string; payload?: { payment?: { entity?: { id?: string } } } };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (event.event !== "payment.captured" && event.event !== "order.paid") {
          return Response.json({ ignored: true });
        }
        const paymentId = event.payload?.payment?.entity?.id;
        if (!paymentId) return Response.json({ ignored: true });

        const { confirmPaidBooking, fetchPayment, SlotTakenError } = await import("@/lib/razorpay.server");
        // Re-read the payment from Razorpay rather than trusting the webhook body.
        const payment = await fetchPayment(paymentId);
        if (!payment.order_id) return Response.json({ ignored: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: booking } = await supabaseAdmin
          .from("consultations")
          .select("*")
          .eq("razorpay_order_id", payment.order_id)
          .maybeSingle();
        if (!booking) return Response.json({ ignored: true });

        try {
          await confirmPaidBooking(supabaseAdmin, booking, payment);
        } catch (e) {
          if (e instanceof SlotTakenError) {
            console.error("Paid booking lost its slot; refund needed", booking.id, payment.id);
            return Response.json({ refund_needed: true });
          }
          console.error("Webhook could not confirm booking", booking.id, e);
          return new Response("Could not confirm", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
