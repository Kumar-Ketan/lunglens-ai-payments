import { createFileRoute, Link } from "@tanstack/react-router";
import { BrainCircuit, ChevronRight, Database, Eye, FileImage, ScanLine, Sparkles } from "lucide-react";

import { Disclaimer } from "@/components/site/Disclaimer";
import { PageIntro } from "@/components/site/PageIntro";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works | LungScan AI" },
      {
        name: "description",
        content: "The LungScan AI pipeline: preprocessing, ResNet18 TB classification, Grad-CAM explainability, AI second opinion and secure storage.",
      },
      { property: "og:title", content: "How it works | LungScan AI" },
      { property: "og:description", content: "From X-ray upload to TB probability, Grad-CAM heatmap and AI second opinion." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorks,
});

const steps = [
  {
    icon: FileImage,
    title: "Image upload",
    body: "Choose a JPEG, PNG or uncompressed DICOM chest X-ray. DICOM pixel data is min–max scaled to 8-bit greyscale exactly like the original read_dicom() function.",
  },
  {
    icon: ScanLine,
    title: "Preprocessing",
    body: "The image is resized to 224 × 224, converted to a 3-channel tensor and normalised with mean 0.5 / std 0.5 — the same transform used in training.",
  },
  {
    icon: BrainCircuit,
    title: "ResNet18 classification",
    body: "An ImageNet-pretrained ResNet18 with a custom head (512→128→ReLU→Dropout→1→Sigmoid) outputs the TB probability. A score ≥ 0.5 is labelled TB Positive.",
  },
  {
    icon: Eye,
    title: "Grad-CAM explainability",
    body: "Gradients of the TB logit with respect to the last convolutional block weight its 512 feature maps. The resulting 7 × 7 map is upsampled and overlaid as a heatmap.",
  },
  {
    icon: Sparkles,
    title: "AI second opinion",
    body: "A vision-capable AI model reads the same image and scores Normal, Pneumonia and TB independently, with region-by-region findings and an impression.",
  },
  {
    icon: Database,
    title: "Secure record & report",
    body: "The X-ray, heatmap and both readings are stored privately in your account. Reopen any scan from History and download a PDF report.",
  },
];

function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-14">
      <PageIntro label="System workflow" title="How it works">
        The full pipeline behind each analysis — from pixels to an explainable result.
      </PageIntro>

      <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="panel relative p-6">
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/30">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="data text-3xl text-border">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <p className="kicker mt-6">Step {String(i + 1).padStart(2, "0")}</p>
            <h2 className="mt-1 text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>

      <div className="panel mt-10 grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="text-xl font-semibold">Where does each part run?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The trained ResNet18 was exported from PyTorch to ONNX and runs on your device with ONNX Runtime Web — the
            X-ray never leaves your browser for this step. The AI second opinion, storage and accounts run on the
            backend.
          </p>
        </div>
        <Button variant="hero" size="lg" asChild>
          <Link to="/detect">
            Try it now <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="mt-8">
        <Disclaimer />
      </div>
    </section>
  );
}
