import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BrainCircuit,
  ChartNoAxesColumnIncreasing,
  Cpu,
  Eye,
  FileStack,
  Layers3,
  PlayCircle,
  ShieldCheck,
  Upload,
} from "lucide-react";

import chestScan from "@/assets/chestx-lung-scan.jpg";
import { Disclaimer } from "@/components/site/Disclaimer";
import { Button } from "@/components/ui/button";
import evaluation from "@/data/model-evaluation.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LungScan AI | TB & Pneumonia Detection from Chest X-ray" },
      {
        name: "description",
        content:
          "Upload a chest X-ray to run a trained ResNet18 tuberculosis classifier with Grad-CAM heatmaps and an AI second opinion for pneumonia.",
      },
      { property: "og:title", content: "LungScan AI | TB & Pneumonia Detection from Chest X-ray" },
      {
        property: "og:description",
        content: "Trained ResNet18 TB classifier, Grad-CAM explainability and an AI second opinion — a final-year research prototype.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const features = [
  { icon: Activity, title: "Real trained model", text: "ResNet18 transfer-learning weights from the research notebook, run directly in your browser." },
  { icon: Eye, title: "Grad-CAM heatmaps", text: "See which lung regions pushed the TB score up, computed from the network's own gradients." },
  { icon: Layers3, title: "Three conditions", text: "TB from the trained model, plus an AI second opinion covering Normal, Pneumonia and TB." },
  { icon: FileStack, title: "JPEG, PNG & DICOM", text: "Upload standard images or uncompressed DICOM files straight from imaging systems." },
];

function Home() {
  const m = evaluation.all;
  return (
    <>
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div className="animate-rise">
          <div className="eyebrow">
            <Cpu aria-hidden="true" /> Deep learning · Explainable AI
          </div>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] sm:text-6xl xl:text-7xl">
            Tuberculosis &amp; pneumonia detection from <span className="text-gradient">chest X-ray</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Upload a radiograph and a trained ResNet18 network scores it for tuberculosis, highlights the regions behind
            its decision, and an AI radiology assistant adds a second opinion on pneumonia.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="hero" size="xl" asChild>
              <Link to="/detect">
                <Upload aria-hidden="true" /> Upload X-ray
              </Link>
            </Button>
            <Button variant="glass" size="xl" asChild>
              <Link to="/how-it-works">
                <PlayCircle aria-hidden="true" /> How it works
              </Link>
            </Button>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            {[
              { k: "ROC-AUC", v: m.auc.toFixed(2) },
              { k: "Accuracy", v: `${Math.round(m.accuracy * 100)}%` },
              { k: "Specificity", v: `${Math.round(m.specificity * 100)}%` },
            ].map((s) => (
              <div key={s.k} className="border-l border-primary/40 pl-3">
                <dt className="kicker text-muted-foreground">{s.k}</dt>
                <dd className="data mt-1 text-2xl text-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Measured on all {m.n} X-rays of the NITRD dataset ·{" "}
            <Link to="/metrics" className="text-primary hover:underline">
              see full metrics
            </Link>
          </p>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[560px]">
          <div className="scan-grid absolute -inset-8" aria-hidden="true" />
          <div className="relative h-full overflow-hidden rounded-3xl border border-primary/25 shadow-glow">
            <img
              src={chestScan}
              alt="Luminous chest X-ray illustration"
              width={1200}
              height={1200}
              fetchPriority="high"
              className="h-full w-full object-cover opacity-90"
            />
            <div className="scan-line pointer-events-none absolute inset-x-0 top-0 animate-scan" aria-hidden="true" />
            <span className="scan-corner absolute left-4 top-4 rounded-tl-lg border-l-2 border-t-2" aria-hidden="true" />
            <span className="scan-corner absolute bottom-4 right-4 rounded-br-lg border-b-2 border-r-2" aria-hidden="true" />
            <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs backdrop-blur">
              <span className="size-2 animate-pulse-dot rounded-full bg-signal" /> ResNet18 · Grad-CAM
            </div>
          </div>
          <div className="panel absolute -bottom-6 -left-4 w-64 p-4 sm:-left-10">
            <p className="kicker">Detection classes</p>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5"><span className="marker marker-normal" /> Normal</li>
              <li className="flex items-center gap-2.5"><span className="marker marker-pneumonia" /> Pneumonia <span className="ml-auto text-[10px] text-muted-foreground">AI</span></li>
              <li className="flex items-center gap-2.5"><span className="marker marker-tb" /> Tuberculosis <span className="ml-auto text-[10px] text-muted-foreground">CNN + AI</span></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-10" aria-label="Key features">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="bg-card p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 grid max-w-7xl gap-6 px-5 md:grid-cols-3">
        {[
          { icon: BrainCircuit, n: "01", t: "Analyse", d: "Upload a JPEG, PNG or DICOM chest X-ray and get a TB probability in seconds." },
          { icon: ChartNoAxesColumnIncreasing, n: "02", t: "Explain", d: "Grad-CAM heatmap plus an AI reading with region-by-region findings." },
          { icon: ShieldCheck, n: "03", t: "Keep a record", d: "Every scan is saved privately to your account with a downloadable PDF report." },
        ].map(({ icon: Icon, n, t, d }) => (
          <div key={n} className="panel p-6">
            <div className="flex items-center justify-between">
              <Icon className="size-6 text-primary" aria-hidden="true" />
              <span className="data text-sm text-muted-foreground">{n}</span>
            </div>
            <h3 className="mt-6 text-xl font-semibold">{t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <div className="mx-auto mt-12 max-w-7xl px-5">
        <Disclaimer />
      </div>
    </>
  );
}
