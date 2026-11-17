import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronRight, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatInr, formatSlot } from "@/lib/consult";
import { consultationsQueryOptions, statusLabel, statusTone } from "@/lib/consultations";

export const Route = createFileRoute("/_authenticated/consultations/")({
  head: () => ({
    meta: [
      { title: "My consultations | LungScan AI" },
      { name: "description", content: "Your doctor consultation bookings and their payment status." },
      { property: "og:title", content: "My consultations | LungScan AI" },
      { property: "og:description", content: "Your doctor consultation bookings and their payment status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(consultationsQueryOptions()),
  component: ConsultationsPage,
});

function ConsultationsPage() {
  const { data } = useSuspenseQuery(consultationsQueryOptions());

  return (
    <section className="mx-auto max-w-5xl px-5 py-12">
      <p className="kicker">Doctor consultations</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">My consultations</h1>
      <p className="mt-2 text-muted-foreground">
        When a scan shows TB or pneumonia, you can book a specialist from the scan result page.
      </p>

      {data.length === 0 ? (
        <div className="panel mt-8 p-10 text-center">
          <Stethoscope className="mx-auto size-8 text-primary" aria-hidden="true" />
          <p className="mt-3 font-medium">No consultations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Open a scan with a TB or pneumonia result to book a doctor.</p>
          <Button asChild variant="glass" className="mt-5">
            <Link to="/history">Go to history</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {data.map((c) => (
            <li key={c.id}>
              <Link
                to="/consultations/$consultationId"
                params={{ consultationId: c.id }}
                className="panel flex items-center gap-4 p-5 transition-colors hover:border-primary/40"
              >
                <span className="hidden size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary sm:grid">
                  <CalendarClock className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.doctor_name}</span>
                    <span className={`data rounded-full border px-2 py-0.5 text-xs ${statusTone[c.status] ?? ""}`}>
                      {statusLabel[c.status] ?? c.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatSlot(c.slot_at)} IST · {c.patient_name} · {c.detected_condition}
                  </p>
                </div>
                <span className="data hidden text-sm font-medium sm:block">{formatInr(c.amount_paise)}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
