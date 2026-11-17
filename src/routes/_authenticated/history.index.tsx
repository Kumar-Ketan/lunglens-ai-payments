import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, FileImage, Search, Upload } from "lucide-react";

import { PageIntro } from "@/components/site/PageIntro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TB_THRESHOLD } from "@/lib/model/tb-label";
import { pct, scansQueryOptions, signedUrlsQueryOptions, type Scan } from "@/lib/scans";
import { finalVerdict } from "@/lib/final-verdict";

export const Route = createFileRoute("/_authenticated/history/")({
  head: () => ({
    meta: [
      { title: "Scan history | LungScan AI" },
      { name: "description", content: "Every chest X-ray you analysed, with TB results and AI second opinions." },
      { property: "og:title", content: "Scan history | LungScan AI" },
      { property: "og:description", content: "Every chest X-ray you analysed, with TB results and AI second opinions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(scansQueryOptions()),
  component: History,
});

type Filter = "all" | "positive" | "negative";

function History() {
  const { data: scans } = useSuspenseQuery(scansQueryOptions());
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scans.filter((s) => {
      const positive = s.tb_probability >= TB_THRESHOLD;
      if (filter === "positive" && !positive) return false;
      if (filter === "negative" && positive) return false;
      if (!term) return true;
      return [s.patient_ref, s.file_name, s.notes, s.ai_label].some((v) => v?.toLowerCase().includes(term));
    });
  }, [scans, filter, q]);

  const thumbs = useQuery(signedUrlsQueryOptions(visible.slice(0, 60).map((s) => s.image_path)));
  const positives = scans.filter((s) => s.tb_probability >= TB_THRESHOLD).length;
  const aiDone = scans.filter((s) => s.ai_status === "done").length;

  return (
    <section className="mx-auto max-w-7xl px-5 py-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <PageIntro label="Your records" title="Scan history">
          Every X-ray you analysed is stored privately in your account. Only you can see these scans.
        </PageIntro>
        <Button asChild variant="hero" size="lg">
          <Link to="/detect">
            <Upload aria-hidden="true" /> New analysis
          </Link>
        </Button>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Stat label="Total scans" value={scans.length} />
        <Stat label="TB positive (model)" value={positives} tone="text-tb" />
        <Stat label="AI second opinions" value={aiDone} />
      </div>

      {scans.length === 0 ? (
        <div className="panel mt-8 flex flex-col items-center p-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/30">
            <FileImage className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-xl font-semibold">No scans yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Analyse your first chest X-ray — or try one of the sample images — and it will appear here.
          </p>
          <Button asChild variant="hero" className="mt-6">
            <Link to="/detect">
              Analyse an X-ray <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Search scans"
                placeholder="Search by reference, file name or notes"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex rounded-lg border border-border p-1" role="group" aria-label="Filter by TB result">
              {(
                [
                  ["all", "All"],
                  ["positive", "TB positive"],
                  ["negative", "TB negative"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors aria-pressed:bg-secondary aria-pressed:text-foreground"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="mt-10 text-center text-sm text-muted-foreground">No scans match your search.</p>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((s) => (
                <li key={s.id}>
                  <ScanCard scan={s} thumb={thumbs.data?.[s.image_path]} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value, tone = "text-foreground" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="panel p-5">
      <p className="kicker text-muted-foreground">{label}</p>
      <p className={`data mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function ScanCard({ scan, thumb }: { scan: Scan; thumb: string | undefined }) {
  const positive = scan.tb_probability >= TB_THRESHOLD;
  return (
    <Link
      to="/history/$scanId"
      params={{ scanId: scan.id }}
      className="panel group flex gap-4 p-4 transition-colors hover:border-primary/50"
    >
      <div className="size-24 shrink-0 overflow-hidden rounded-lg bg-secondary">
        {thumb && <img src={thumb} alt="" loading="lazy" className="size-full object-cover opacity-85 group-hover:opacity-100" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`marker ${positive ? "marker-tb" : "marker-normal"}`} />
          <span className={`text-sm font-semibold ${positive ? "text-tb" : "text-normal"}`}>{scan.tb_label}</span>
          <span className="data ml-auto text-xs text-muted-foreground">{pct(scan.tb_probability)}</span>
        </div>
        <p className="mt-1 truncate text-sm">{scan.patient_ref || scan.file_name}</p>
        <p className="text-xs text-muted-foreground">{new Date(scan.created_at).toLocaleString()}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Final:{" "}
          {scan.ai_status === "done"
            ? finalVerdict(scan).label
            : scan.ai_status === "failed"
              ? "failed"
              : scan.ai_status === "running"
                ? "analysing…"
                : "pending"}
        </p>
      </div>
    </Link>
  );
}
