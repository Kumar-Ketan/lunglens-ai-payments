import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarDays, Clock, Languages, Loader2, ShieldCheck, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  bookableSlotsOn,
  CONSULT_FEE_PAISE,
  detectedConditions,
  DOCTORS,
  formatDateKey,
  formatInr,
  formatSlot,
  formatSlotTime,
  normalizeIndianPhone,
  upcomingDays,
} from "@/lib/consult";
import { createConsultation, getBookedSlots } from "@/lib/consult.functions";
import { scanQueryOptions, type Scan } from "@/lib/scans";

export const Route = createFileRoute("/_authenticated/consult/$scanId")({
  head: () => ({
    meta: [
      { title: "Consult a doctor | LungScan AI" },
      { name: "description", content: "Book a chest specialist to review your X-ray after TB or pneumonia is detected." },
      { property: "og:title", content: "Consult a doctor | LungScan AI" },
      { property: "og:description", content: "Book a chest specialist to review your X-ray after TB or pneumonia is detected." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params }) => {
    const scan = await context.queryClient.ensureQueryData(scanQueryOptions(params.scanId));
    if (!scan) throw notFound();
  },
  notFoundComponent: () => (
    <section className="mx-auto max-w-3xl px-5 py-24 text-center">
      <h1 className="text-3xl font-semibold">Scan not found</h1>
      <Button asChild variant="glass" className="mt-6">
        <Link to="/history">Back to history</Link>
      </Button>
    </section>
  ),
  component: ConsultPage,
});

function ConsultPage() {
  const { scanId } = Route.useParams();
  const { data } = useSuspenseQuery(scanQueryOptions(scanId));
  const scan = data as Scan;
  const conditions = detectedConditions(scan);

  if (conditions.length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h1 className="text-3xl font-semibold">No consultation needed for this scan</h1>
        <p className="mt-3 text-muted-foreground">
          Consultations are offered when TB or pneumonia is detected. This scan did not show either.
        </p>
        <Button asChild variant="glass" className="mt-6">
          <Link to="/history/$scanId" params={{ scanId }}>
            Back to the scan
          </Link>
        </Button>
      </section>
    );
  }

  return <BookingForm scan={scan} conditions={conditions} />;
}

function BookingForm({ scan, conditions }: { scan: Scan; conditions: string[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useServerFn(createConsultation);
  const fetchBooked = useServerFn(getBookedSlots);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const suitable = DOCTORS.filter((d) => conditions.some((c) => d.treats.includes(c as never)));
  const [doctorId, setDoctorId] = useState(suitable[0]?.id ?? DOCTORS[0].id);
  const doctor = DOCTORS.find((d) => d.id === doctorId)!;
  const days = useMemo(() => upcomingDays(doctor, now), [doctor, now]);
  const [dateKey, setDateKey] = useState<string>(days[0] ?? "");
  const [slotAt, setSlotAt] = useState<string | null>(null);
  const [name, setName] = useState(scan.patient_ref ?? "");
  const [phone, setPhone] = useState("");
  const [concern, setConcern] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!days.includes(dateKey)) setDateKey(days[0] ?? "");
  }, [days, dateKey]);
  useEffect(() => setSlotAt(null), [doctorId, dateKey]);

  const booked = useQuery({
    queryKey: ["booked-slots", doctorId, dateKey],
    enabled: !!dateKey,
    queryFn: () => fetchBooked({ data: { doctorId, dateKey } }),
  });
  const slots = dateKey ? bookableSlotsOn(doctor, dateKey, now) : [];
  const bookedSet = new Set(booked.data ?? []);

  const phoneOk = normalizeIndianPhone(phone) !== null;
  const canSubmit = !!slotAt && name.trim().length >= 2 && phoneOk && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slotAt) return;
    setSubmitting(true);
    try {
      const { id } = await create({
        data: { scanId: scan.id, doctorId, slotAt, patientName: name, patientPhone: phone, concern },
      });
      await queryClient.invalidateQueries({ queryKey: ["consultations"] });
      navigate({ to: "/consultations/$consultationId", params: { consultationId: id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the booking.");
      void booked.refetch();
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-12">
      <Button asChild variant="ghost" size="sm">
        <Link to="/history/$scanId" params={{ scanId: scan.id }}>
          <ArrowLeft aria-hidden="true" /> Back to scan
        </Link>
      </Button>
      <div className="mt-6">
        <p className="kicker">Consult a doctor</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Book a chest specialist</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          This scan showed signs of <span className="font-medium text-tb">{conditions.join(" and ")}</span>. A doctor can
          review the X-ray and report with you and advise on next steps.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <fieldset className="panel p-6">
            <legend className="sr-only">Choose a doctor</legend>
            <p className="kicker text-muted-foreground">1 · Choose a doctor</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {DOCTORS.map((d) => {
                const selected = d.id === doctorId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDoctorId(d.id)}
                    className="rounded-xl border border-border bg-card/40 p-4 text-left transition-colors hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary/10"
                  >
                    <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
                      <Stethoscope className="size-4" aria-hidden="true" />
                    </span>
                    <span className="mt-3 block font-semibold">{d.name}</span>
                    <span className="block text-sm text-muted-foreground">{d.specialty}</span>
                    <span className="data mt-2 block text-xs text-muted-foreground">{d.experienceYears} yrs experience</span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Languages className="size-3" aria-hidden="true" /> {d.languages.join(", ")}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="panel p-6">
            <legend className="sr-only">Choose a date and time</legend>
            <p className="kicker text-muted-foreground">2 · Pick a date and time (India time)</p>
            {days.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No free days this week. Please choose another doctor.</p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Date">
                  {days.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={d === dateKey}
                      onClick={() => setDateKey(d)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary/10"
                    >
                      <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden="true" /> {formatDateKey(d)}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Time">
                  {booked.isLoading ? (
                    <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
                  ) : (
                    slots.map((s) => {
                      const taken = bookedSet.has(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={taken}
                          aria-pressed={s === slotAt}
                          onClick={() => setSlotAt(s)}
                          className="data rounded-lg border border-border px-2 py-2 text-sm transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                        >
                          {formatSlotTime(s)}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </fieldset>

          <fieldset className="panel p-6">
            <legend className="sr-only">Patient details</legend>
            <p className="kicker text-muted-foreground">3 · Patient details</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="patient-name">Patient name</Label>
                <Input id="patient-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="patient-phone">Mobile number</Label>
                <Input
                  id="patient-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={phone.length > 0 && !phoneOk}
                  required
                />
                {phone.length > 0 && !phoneOk && (
                  <p className="text-xs text-destructive">Enter a 10-digit Indian mobile number.</p>
                )}
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="patient-concern">Symptoms or questions (optional)</Label>
                <Textarea
                  id="patient-concern"
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. cough for 3 weeks, mild fever in the evenings"
                  value={concern}
                  onChange={(e) => setConcern(e.target.value)}
                />
              </div>
            </div>
          </fieldset>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-6">
            <h2 className="text-lg font-semibold">Booking summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Doctor</dt>
                <dd className="text-right font-medium">{doctor.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">When</dt>
                <dd className="flex items-center gap-1.5 text-right font-medium">
                  <Clock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {slotAt ? formatSlot(slotAt) : "Pick a time"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Reason</dt>
                <dd className="text-right font-medium">{conditions.join(" & ")} detected</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Shared with doctor</dt>
                <dd className="text-right font-medium">X-ray, heatmap & AI report</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
                <dt className="font-medium">Consultation fee</dt>
                <dd className="data text-2xl font-semibold">{formatInr(CONSULT_FEE_PAISE)}</dd>
              </div>
            </dl>
            <Button type="submit" variant="hero" className="mt-6 w-full" disabled={!canSubmit}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null} Continue to payment
            </Button>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
              Test mode: you will pay through Razorpay test checkout, so no money is debited.
            </p>
          </div>
        </aside>
      </form>
    </section>
  );
}
