import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Brain, CircleAlert, Download, Loader2, RefreshCw, Save, Stethoscope, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ProbabilityBar } from "@/components/scan/ProbabilityBar";
import { Disclaimer } from "@/components/site/Disclaimer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { confidenceBand, TB_THRESHOLD } from "@/lib/model/tb-label";
import { detectedConditions } from "@/lib/consult";
import { finalVerdict } from "@/lib/final-verdict";
import { downloadScanReport } from "@/lib/report-pdf";
import { runAiSecondOpinion } from "@/lib/scans.functions";
import { deleteScan, findingsOf, pct, scanQueryOptions, signedUrlsQueryOptions, type Scan } from "@/lib/scans";

export const Route = createFileRoute("/_authenticated/history/$scanId")({
  head: () => ({
    meta: [
      { title: "Scan result | LungScan AI" },
      { name: "description", content: "TB prediction, Grad-CAM heatmap and AI second opinion for a chest X-ray." },
      { property: "og:title", content: "Scan result | LungScan AI" },
      { property: "og:description", content: "TB prediction, Grad-CAM heatmap and AI second opinion for a chest X-ray." },
      { property: "og:type", content: "article" },
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
      <p className="mt-2 text-muted-foreground">It may have been deleted, or it belongs to another account.</p>
      <Button asChild variant="glass" className="mt-6">
        <Link to="/history">Back to history</Link>
      </Button>
    </section>
  ),
  component: ScanResult,
});

const severityTone: Record<string, string> = {
  none: "text-normal",
  mild: "text-pneumonia",
  moderate: "text-pneumonia",
  severe: "text-tb",
};

function ScanResult() {
  const { scanId } = Route.useParams();
  const { data } = useSuspenseQuery(scanQueryOptions(scanId));
  const scan = data as Scan;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const runAi = useServerFn(runAiSecondOpinion);
  const started = useRef(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [view, setView] = useState<"xray" | "heatmap">(scan.heatmap_path ? "heatmap" : "xray");
  const [pdfBusy, setPdfBusy] = useState(false);

  const paths = [scan.image_path, scan.heatmap_path].filter(Boolean) as string[];
  const urls = useQuery(signedUrlsQueryOptions(paths));
  const imageUrl = urls.data?.[scan.image_path];
  const heatmapUrl = scan.heatmap_path ? urls.data?.[scan.heatmap_path] : undefined;

  async function requestAi() {
    setAiBusy(true);
    try {
      const updated = await runAi({ data: { scanId: scan.id } });
      queryClient.setQueryData(scanQueryOptions(scan.id).queryKey, updated);
      queryClient.invalidateQueries({ queryKey: ["scans"], exact: true });
      if (updated.ai_status === "failed") toast.error(updated.ai_error ?? "AI second opinion failed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI second opinion failed.");
      await queryClient.invalidateQueries({ queryKey: ["scans", scan.id] });
    } finally {
      setAiBusy(false);
    }
  }

  // Start the AI second opinion automatically for freshly saved scans.
  useEffect(() => {
    if (started.current) return;
    if (scan.ai_status === "pending") {
      started.current = true;
      void requestAi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.ai_status]);

  const positive = scan.tb_probability >= TB_THRESHOLD;
  const verdict = finalVerdict(scan);
  const verdictTone =
    verdict.label === "Tuberculosis" ? "text-tb" : verdict.label === "Pneumonia" ? "text-pneumonia" : verdict.label === "Normal" ? "text-normal" : "text-muted-foreground";
  const findings = findingsOf(scan);
  const aiRunning = aiBusy || scan.ai_status === "running" || scan.ai_status === "pending";

  async function onDownload() {
    setPdfBusy(true);
    try {
      await downloadScanReport(scan, imageUrl, heatmapUrl);
    } catch {
      toast.error("Could not create the PDF report.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function onDelete() {
    try {
      await deleteScan(scan);
      queryClient.removeQueries({ queryKey: ["scans", scan.id] });
      await queryClient.invalidateQueries({ queryKey: ["scans"], exact: true });
      toast.success("Scan deleted");
      navigate({ to: "/history" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the scan.");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-12">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/history">
            <ArrowLeft aria-hidden="true" /> History
          </Link>
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {detectedConditions(scan).length > 0 && (
            <Button asChild variant="hero">
              <Link to="/consult/$scanId" params={{ scanId: scan.id }}>
                <Stethoscope aria-hidden="true" /> Consult a doctor · ₹499
              </Link>
            </Button>
          )}
          <Button variant="glass" onClick={onDownload} disabled={pdfBusy}>
            {pdfBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />} PDF report
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="glass" aria-label="Delete scan">
                <Trash2 aria-hidden="true" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this scan?</AlertDialogTitle>
                <AlertDialogDescription>
                  The X-ray, heatmap and all results will be permanently removed. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mt-6">
        <p className="kicker">Scan result</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{scan.patient_ref || scan.file_name}</h1>
        <p className="data mt-1 text-sm text-muted-foreground">
          {new Date(scan.created_at).toLocaleString()} · {scan.file_type} · {scan.model_version}
        </p>
      </div>

      <div className="panel mt-8 p-6">
        <p className="kicker text-muted-foreground">Final result · model + AI combined</p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className={`text-3xl font-semibold sm:text-4xl ${verdictTone}`}>
            {verdict.label === "Normal" ? "No TB or pneumonia detected" : verdict.label === "Not a chest X-ray" ? verdict.label : `${verdict.label} detected`}
          </span>
          {aiRunning ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> waiting for AI to confirm
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {verdict.agreement === "agree" ? "Both readers agree" : verdict.agreement === "resolved" ? "Readers differed — resolved by combined score" : "Model only"}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{verdict.explanation}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Image</h2>
            {scan.heatmap_path && (
              <div className="flex rounded-lg border border-border p-1" role="group" aria-label="Image view">
                {(
                  [
                    ["xray", "Original"],
                    ["heatmap", "Grad-CAM"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={view === key}
                    onClick={() => setView(key)}
                    className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors aria-pressed:bg-secondary aria-pressed:text-foreground"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 grid min-h-[380px] place-items-center overflow-hidden rounded-lg bg-background">
            {urls.isLoading ? (
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            ) : (
              <img
                src={view === "heatmap" && heatmapUrl ? heatmapUrl : imageUrl}
                alt={view === "heatmap" ? "Grad-CAM heatmap over the chest X-ray" : "Chest X-ray"}
                className="max-h-[520px] w-full object-contain"
              />
            )}
          </div>
          {view === "heatmap" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Warmer colours show the regions that most influenced the TB score.
            </p>
          )}
        </div>

        <div className="space-y-6">
          <div className="panel p-6">
            <p className="kicker text-muted-foreground">1 · Trained model (ResNet18)</p>
            <div className="mt-3 flex items-baseline gap-3">
              <span className={`text-3xl font-semibold ${positive ? "text-tb" : "text-normal"}`}>{scan.tb_label}</span>
              <span className="text-sm text-muted-foreground">{confidenceBand(scan.tb_probability)} confidence</span>
            </div>
            <div className="mt-5">
              <ProbabilityBar label="TB probability" value={scan.tb_probability} kind="tb" marker={TB_THRESHOLD} />
              <p className="mt-2 text-xs text-muted-foreground">Line marks the {TB_THRESHOLD} decision threshold.</p>
            </div>
          </div>

          <div className="panel p-6">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-primary" aria-hidden="true" />
              <p className="kicker text-muted-foreground">2 · AI second opinion</p>
            </div>

            {scan.ai_status === "done" && !aiBusy ? (
              <>
                <p className="mt-3 text-2xl font-semibold">{scan.ai_label}</p>
                <div className="mt-4 space-y-3">
                  <ProbabilityBar label="Normal" value={scan.ai_normal} kind="normal" />
                  <ProbabilityBar label="Pneumonia" value={scan.ai_pneumonia} kind="pneumonia" />
                  <ProbabilityBar label="Tuberculosis" value={scan.ai_tb} kind="tb" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Image quality: {scan.ai_image_quality ?? "—"} · Likelihoods are independent and need not add up to 100%.
                </p>
              </>
            ) : scan.ai_status === "failed" && !aiBusy ? (
              <div className="mt-3">
                <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                  {scan.ai_error ?? "The AI second opinion failed."}
                </p>
                <Button variant="glass" className="mt-3" onClick={requestAi}>
                  <RefreshCw aria-hidden="true" /> Try again
                </Button>
              </div>
            ) : aiRunning ? (
              <div>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> Reviewing the X-ray… this can take up to a minute.
              </p>
              {!aiBusy && (
                <Button variant="glass" size="sm" className="mt-3" onClick={requestAi}>
                  <RefreshCw aria-hidden="true" /> Restart review
                </Button>
              )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {scan.ai_status === "done" && !aiBusy && (findings.length > 0 || scan.ai_impression) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {findings.length > 0 && (
            <div className="panel p-6">
              <h2 className="text-lg font-semibold">Findings</h2>
              <ul className="mt-4 divide-y divide-border">
                {findings.map((f, i) => (
                  <li key={i} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{f.region}</span>
                      <span className={`data text-xs uppercase ${severityTone[f.severity] ?? "text-muted-foreground"}`}>
                        {f.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{f.observation}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {scan.ai_impression && (
            <div className="panel p-6">
              <h2 className="text-lg font-semibold">Impression</h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">{scan.ai_impression}</p>
            </div>
          )}
        </div>
      )}

      <DetailsEditor scan={scan} />

      <div className="mt-8">
        <Disclaimer />
      </div>
    </section>
  );
}

function DetailsEditor({ scan }: { scan: Scan }) {
  const queryClient = useQueryClient();
  const [patientRef, setPatientRef] = useState(scan.patient_ref ?? "");
  const [notes, setNotes] = useState(scan.notes ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = patientRef !== (scan.patient_ref ?? "") || notes !== (scan.notes ?? "");

  async function save() {
    setSaving(true);
    const { data, error } = await supabase
      .from("scans")
      .update({ patient_ref: patientRef.trim() || null, notes: notes.trim() || null })
      .eq("id", scan.id)
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Could not save the details.");
      return;
    }
    queryClient.setQueryData(scanQueryOptions(scan.id).queryKey, data);
    queryClient.invalidateQueries({ queryKey: ["scans"], exact: true });
    toast.success("Details saved");
  }

  return (
    <div className="panel mt-6 p-6">
      <h2 className="text-lg font-semibold">Case details</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="space-y-1.5">
          <Label htmlFor="edit-ref">Patient / case reference</Label>
          <Input id="edit-ref" value={patientRef} maxLength={80} onChange={(e) => setPatientRef(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-notes">Notes</Label>
          <Textarea id="edit-notes" rows={3} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <Button className="mt-4" variant="glass" disabled={!dirty || saving} onClick={save}>
        {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />} Save details
      </Button>
    </div>
  );
}
