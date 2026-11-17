import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Disclaimer } from "@/components/site/Disclaimer";
import { PageIntro } from "@/components/site/PageIntro";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About the project | LungScan AI" },
      {
        name: "description",
        content: "Objectives, dataset and technology behind LungScan AI, a final-year project on TB and pneumonia detection from chest X-rays.",
      },
      { property: "og:title", content: "About the project | LungScan AI" },
      { property: "og:description", content: "Objectives, dataset and technology behind the LungScan AI research prototype." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

const objectives = [
  "Detect tuberculosis from chest X-rays using transfer learning.",
  "Benchmark ResNet18, ResNet34 and DenseNet121 on accuracy and ROC-AUC.",
  "Explain predictions with Grad-CAM heatmaps.",
  "Extend screening to pneumonia with an AI second opinion.",
  "Support both JPEG and DICOM inputs.",
  "Keep a secure, per-user history with downloadable reports.",
];

const stack = [
  { group: "Training", items: ["Python", "PyTorch", "Torchvision", "scikit-learn", "pydicom"] },
  { group: "Inference", items: ["ONNX", "ONNX Runtime Web", "Grad-CAM"] },
  { group: "Web app", items: ["React", "TanStack Start", "Tailwind CSS"] },
  { group: "Backend", items: ["Lovable Cloud database", "Private file storage", "Auth", "AI model"] },
];

function About() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-14">
      <PageIntro label="About the project" title="About LungScan AI">
        A final-year academic project applying deep learning and explainable AI to chest X-ray screening for
        tuberculosis and pneumonia.
      </PageIntro>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div className="panel p-6">
          <p className="kicker">Project objectives</p>
          <ul className="mt-4 divide-y divide-border">
            {objectives.map((o, i) => (
              <li key={o} className="flex items-center gap-4 py-3">
                <span className="data text-sm text-primary">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 text-sm">{o}</span>
                <Check className="size-4 text-normal" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-8">
          <div className="panel p-6">
            <p className="kicker">Dataset</p>
            <h2 className="mt-2 text-2xl font-semibold">NITRD, New Delhi</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              278 chest X-rays from the National Institute of Tuberculosis and Respiratory Diseases: 156 JPEG images
              (set DA) and 122 DICOM images (set DB). 125 are TB positive and 153 TB negative, labelled from the file
              name prefix (<span className="data">p</span> = positive, <span className="data">n</span> = negative).
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                ["278", "images"],
                ["125", "TB positive"],
                ["153", "TB negative"],
              ].map(([v, k]) => (
                <div key={k} className="rounded-lg bg-secondary p-3">
                  <div className="data text-2xl">{v}</div>
                  <div className="text-xs text-muted-foreground">{k}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-6">
            <p className="kicker">Technology</p>
            <div className="mt-4 space-y-4">
              {stack.map((s) => (
                <div key={s.group}>
                  <p className="text-xs text-muted-foreground">{s.group}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {s.items.map((i) => (
                      <span key={i} className="data rounded-md border border-border bg-secondary px-2.5 py-1 text-xs">
                        {i}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <Disclaimer />
      </div>
    </section>
  );
}
