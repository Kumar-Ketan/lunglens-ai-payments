import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronRight, CircleAlert, Cpu, FileImage, Loader2, Upload, X } from "lucide-react";

import { Disclaimer } from "@/components/site/Disclaimer";
import { PageIntro } from "@/components/site/PageIntro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  MODEL_SIZE_BYTES,
  MODEL_VERSION,
  canvasToBlob,
  fileToCanvas,
  fitCanvas,
  loadTbModel,
  onModelProgress,
  predictTb,
  renderHeatmapOverlay,
} from "@/lib/model/tb-model";
import { BUCKET } from "@/lib/scans";
import nx12 from "@/assets/samples/da_test_nx12.jpg.asset.json";
import nx3 from "@/assets/samples/da_test_nx3.jpg.asset.json";
import px46 from "@/assets/samples/da_test_px46.jpg.asset.json";
import px48 from "@/assets/samples/da_test_px48.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/detect")({
  head: () => ({
    meta: [
      { title: "Analyse a chest X-ray | LungScan AI" },
      { name: "description", content: "Upload a JPEG, PNG or DICOM chest X-ray for TB detection with Grad-CAM and an AI second opinion." },
      { property: "og:title", content: "Analyse a chest X-ray | LungScan AI" },
      { property: "og:description", content: "Upload a chest X-ray for TB detection with Grad-CAM and an AI second opinion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Detect,
});

const samples = [
  { asset: px46, label: "Sample A", hint: "TB positive (dataset label)" },
  { asset: px48, label: "Sample B", hint: "TB positive (dataset label)" },
  { asset: nx3, label: "Sample C", hint: "TB negative (dataset label)" },
  { asset: nx12, label: "Sample D", hint: "TB negative (dataset label)" },
];

type Stage = "idle" | "model" | "predict" | "save";
const stageText: Record<Stage, string> = {
  idle: "",
  model: "Loading ResNet18 model…",
  predict: "Running ResNet18 + Grad-CAM…",
  save: "Saving scan securely…",
};

function Detect() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [patientRef, setPatientRef] = useState("");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [modelProgress, setModelProgress] = useState(0);
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    const off = onModelProgress(setModelProgress);
    loadTbModel().catch((e) => setModelError(e instanceof Error ? e.message : "Model failed to load"));
    return () => {
      off();
    };
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function accept(next?: File) {
    setError(null);
    if (!next) return;
    setDecoding(true);
    try {
      const decoded = await fileToCanvas(next);
      const fitted = fitCanvas(decoded, 1024);
      const blob = await canvasToBlob(fitted, "image/jpeg", 0.92);
      setFile(next);
      setCanvas(fitted);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setFile(null);
      setCanvas(null);
      setPreview(null);
      setError(e instanceof Error ? e.message : "This file could not be opened.");
    } finally {
      setDecoding(false);
    }
  }

  async function useSample(url: string, name: string) {
    const blob = await (await fetch(url)).blob();
    await accept(new File([blob], name, { type: "image/jpeg" }));
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    void accept(e.currentTarget.files?.[0]);
    e.currentTarget.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void accept(e.dataTransfer.files[0]);
  }

  function clear() {
    setFile(null);
    setCanvas(null);
    setPreview(null);
    setError(null);
  }

  async function analyse() {
    if (!canvas || !file) return;
    setError(null);
    try {
      setStage("model");
      await loadTbModel();
      setStage("predict");
      const prediction = await predictTb(canvas);
      const overlay = renderHeatmapOverlay(canvas, prediction.cam);

      setStage("save");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Your session expired. Please sign in again.");
      const id = crypto.randomUUID();
      const imagePath = `${uid}/${id}/xray.jpg`;
      const heatmapPath = `${uid}/${id}/gradcam.jpg`;
      const [imageBlob, heatBlob] = await Promise.all([
        canvasToBlob(canvas, "image/jpeg", 0.92),
        canvasToBlob(overlay, "image/jpeg", 0.9),
      ]);
      const up1 = await supabase.storage.from(BUCKET).upload(imagePath, imageBlob, { contentType: "image/jpeg" });
      if (up1.error) throw up1.error;
      const up2 = await supabase.storage.from(BUCKET).upload(heatmapPath, heatBlob, { contentType: "image/jpeg" });
      if (up2.error) throw up2.error;

      const isDicom = file.name.toLowerCase().endsWith(".dcm");
      const { error: insertError } = await supabase.from("scans").insert({
        id,
        user_id: uid,
        file_name: file.name,
        file_type: isDicom ? "DICOM" : file.type.replace("image/", "").toUpperCase() || "IMAGE",
        image_path: imagePath,
        heatmap_path: prediction.camMax > 0 ? heatmapPath : null,
        model_version: MODEL_VERSION,
        tb_probability: prediction.probability,
        tb_label: prediction.label,
        patient_ref: patientRef.trim() || null,
        notes: notes.trim() || null,
        ai_status: "pending",
      });
      if (insertError) throw insertError;
      await queryClient.invalidateQueries({ queryKey: ["scans"] });
      navigate({ to: "/history/$scanId", params: { scanId: id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setStage("idle");
    }
  }

  const busy = stage !== "idle";
  const modelReady = modelProgress >= 1;

  return (
    <section className="mx-auto max-w-7xl px-5 py-14">
      <PageIntro label="Analysis workspace" title="Chest X-ray detection">
        Upload a chest X-ray. The trained ResNet18 runs on your device; the scan is then saved to your history and
        reviewed by the AI second opinion.
      </PageIntro>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="panel p-6">
          <div className="flex items-start gap-4">
            <span className="data text-sm text-primary">01</span>
            <div>
              <h2 className="text-lg font-semibold">Image upload</h2>
              <p className="text-sm text-muted-foreground">JPG, PNG or uncompressed DICOM (.dcm), up to 20 MB.</p>
            </div>
          </div>

          <div
            className="upload-zone relative mt-5 grid min-h-[380px] place-items-center overflow-hidden p-4"
            data-dragging={dragging}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {preview ? (
              <div className="relative w-full">
                <img src={preview} alt="Uploaded chest X-ray preview" className="mx-auto max-h-[460px] rounded-lg object-contain" />
                {busy && stage === "predict" && <div className="scan-line pointer-events-none absolute inset-x-0 top-0 animate-scan" />}
                {!busy && (
                  <Button variant="glass" size="icon" className="absolute right-2 top-2" aria-label="Remove image" onClick={clear}>
                    <X />
                  </Button>
                )}
              </div>
            ) : decoding ? (
              <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" /> Reading image…
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/30">
                  <Upload className="size-6" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">Drop an X-ray image here</h3>
                <p className="text-sm text-muted-foreground">or browse files on your device</p>
                <Button variant="glass" className="mt-5" onClick={() => inputRef.current?.click()}>
                  Browse files <ChevronRight aria-hidden="true" />
                </Button>
                <span className="data mt-4 text-xs text-muted-foreground">JPG · PNG · DCM</span>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,.dcm,application/dicom"
              aria-label="Choose an X-ray image"
              onChange={onChange}
            />
          </div>

          {file && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <FileImage className="size-4 text-primary" aria-hidden="true" />
              <span className="truncate">{file.name}</span>
              {canvas && <span className="data ml-auto text-xs">{canvas.width} × {canvas.height}</span>}
            </p>
          )}
          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /> {error}
            </p>
          )}

          <div className="mt-6">
            <p className="kicker text-muted-foreground">Or try a sample from the NITRD dataset</p>
            <div className="mt-3 grid grid-cols-4 gap-3">
              {samples.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={busy}
                  onClick={() => useSample(s.asset.url, s.asset.original_filename)}
                  className="group overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-primary/50 disabled:opacity-50"
                  title={s.hint}
                >
                  <img src={s.asset.url} alt={`${s.label}: ${s.hint}`} loading="lazy" className="aspect-square w-full object-cover opacity-80 group-hover:opacity-100" />
                  <span className="block px-2 py-1.5 text-[11px] text-muted-foreground">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6">
            <div className="flex items-start gap-4">
              <span className="data text-sm text-primary">02</span>
              <div>
                <h2 className="text-lg font-semibold">Scan details</h2>
                <p className="text-sm text-muted-foreground">Optional — shown in history and the PDF report.</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ref">Patient / case reference</Label>
                <Input id="ref" placeholder="e.g. Case-014 (avoid real names)" value={patientRef} onChange={(e) => setPatientRef(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={3} placeholder="Clinical context, symptoms…" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
              </div>
            </div>
          </div>

          <div className="panel p-6">
            <div className="flex items-start gap-4">
              <span className="data text-sm text-primary">03</span>
              <div>
                <h2 className="text-lg font-semibold">Run analysis</h2>
                <p className="text-sm text-muted-foreground">ResNet18 TB classifier · Grad-CAM · AI second opinion</p>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-secondary/60 p-3 text-sm">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-primary" aria-hidden="true" />
                <span>Model</span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  {modelError ? (
                    <span className="text-destructive">Failed to load</span>
                  ) : modelReady ? (
                    <><Check className="size-3.5 text-normal" aria-hidden="true" /> Ready on this device</>
                  ) : (
                    <>Downloading {Math.round(modelProgress * 100)}% of {(MODEL_SIZE_BYTES / 1e6).toFixed(0)} MB</>
                  )}
                </span>
              </div>
              {!modelReady && !modelError && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-background">
                  <div className="h-full bg-primary transition-[width]" style={{ width: `${modelProgress * 100}%` }} />
                </div>
              )}
              {modelError && (
                <button className="mt-2 text-xs text-primary hover:underline" onClick={() => { setModelError(null); loadTbModel().catch((e) => setModelError(e.message)); }}>
                  Retry download
                </button>
              )}
            </div>

            <Button variant="hero" size="xl" className="mt-5 w-full" disabled={!canvas || busy || decoding} onClick={analyse}>
              {busy ? (
                <><Loader2 className="animate-spin" aria-hidden="true" /> {stageText[stage]}</>
              ) : (
                <>Analyse X-ray <ArrowRight aria-hidden="true" /></>
              )}
            </Button>
            {!canvas && <p className="mt-2 text-center text-xs text-muted-foreground">Upload an image to begin.</p>}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Disclaimer />
      </div>
    </section>
  );
}
