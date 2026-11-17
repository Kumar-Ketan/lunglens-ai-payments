import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, Trophy } from "lucide-react";

import { PageIntro } from "@/components/site/PageIntro";
import evaluation from "@/data/model-evaluation.json";

export const Route = createFileRoute("/metrics")({
  head: () => ({
    meta: [
      { title: "Model metrics & benchmarking | LungScan AI" },
      {
        name: "description",
        content: "Accuracy, ROC-AUC, precision, recall, confusion matrix and ResNet18 vs ResNet34 vs DenseNet121 benchmarking for TB detection.",
      },
      { property: "og:title", content: "Model metrics & benchmarking | LungScan AI" },
      { property: "og:description", content: "ROC-AUC 0.92 ResNet18 TB classifier — full evaluation and model comparison." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Metrics,
});

type EvalKey = keyof typeof evaluation;

const sets: { key: EvalKey; label: string; note: string }[] = [
  { key: "all", label: "All images", note: "All 278 NITRD X-rays (JPEG + DICOM)" },
  { key: "test_split", label: "Dataset test files", note: "102 files the dataset names as test_*" },
  { key: "da_jpeg", label: "JPEG (DA)", note: "156 JPEG images" },
  { key: "db_dicom", label: "DICOM (DB)", note: "122 DICOM images" },
];

// From the training notebook's Step 9 benchmark (10 epochs each, 56-image validation split).
const benchmark = [
  { model: "ResNet18", auc: 0.9192, best: true },
  { model: "ResNet34", auc: 0.8615 },
  { model: "DenseNet121", auc: 0.8449 },
];

function RocChart({ points, auc }: { points: number[][]; auc: number }) {
  const size = 260;
  const pad = 32;
  const inner = size - pad * 1.5;
  const path = points.map(([x = 0, y = 0], i) => `${i ? "L" : "M"}${pad + x * inner},${pad / 2 + (1 - y) * inner}`).join(" ");
  const area = `${path} L${pad + inner},${pad / 2 + inner} L${pad},${pad / 2 + inner} Z`;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm" role="img" aria-label={`ROC curve, AUC ${auc.toFixed(3)}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={pad} x2={pad + inner} y1={pad / 2 + (1 - t) * inner} y2={pad / 2 + (1 - t) * inner} className="stroke-border" strokeWidth={0.5} />
          <line y1={pad / 2} y2={pad / 2 + inner} x1={pad + t * inner} x2={pad + t * inner} className="stroke-border" strokeWidth={0.5} />
          <text x={pad - 6} y={pad / 2 + (1 - t) * inner + 3} textAnchor="end" className="fill-muted-foreground data" fontSize={8}>{t}</text>
          <text x={pad + t * inner} y={pad / 2 + inner + 12} textAnchor="middle" className="fill-muted-foreground data" fontSize={8}>{t}</text>
        </g>
      ))}
      <line x1={pad} y1={pad / 2 + inner} x2={pad + inner} y2={pad / 2} className="stroke-muted-foreground" strokeDasharray="3 3" strokeWidth={0.8} />
      <path d={area} className="fill-primary/10" />
      <path d={path} className="stroke-primary" fill="none" strokeWidth={2} />
      <text x={pad + inner - 4} y={pad / 2 + inner - 8} textAnchor="end" className="fill-foreground data" fontSize={11}>AUC = {auc.toFixed(3)}</text>
      <text x={pad + inner / 2} y={size - 2} textAnchor="middle" className="fill-muted-foreground" fontSize={8}>False positive rate</text>
      <text x={8} y={pad / 2 + inner / 2} textAnchor="middle" className="fill-muted-foreground" fontSize={8} transform={`rotate(-90 8 ${pad / 2 + inner / 2})`}>True positive rate</text>
    </svg>
  );
}

function Metrics() {
  const [active, setActive] = useState<EvalKey>("all");
  const m = evaluation[active];
  const c = m.confusion;
  const cards = [
    { k: "Accuracy", v: m.accuracy },
    { k: "ROC-AUC", v: m.auc },
    { k: "Precision", v: m.precision },
    { k: "Recall (sensitivity)", v: m.recall },
    { k: "Specificity", v: m.specificity },
    { k: "F1-score", v: m.f1 },
  ];

  return (
    <section className="mx-auto max-w-7xl px-5 py-14">
      <PageIntro label="Evaluation" title="Model metrics & benchmarking">
        Performance of the deployed ResNet18 TB classifier (best_tb_detection_model.pth), measured by running the exact
        model this app uses on the NITRD dataset. Decision threshold: 0.5.
      </PageIntro>

      <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="Evaluation set">
        {sets.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={active === s.key}
            onClick={() => setActive(s.key)}
            className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground aria-selected:border-primary/50 aria-selected:bg-primary/10 aria-selected:text-foreground"
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {sets.find((s) => s.key === active)?.note} · {m.positives} TB positive / {m.negatives} TB negative
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div key={card.k} className="panel p-4">
            <p className="text-xs text-muted-foreground">{card.k}</p>
            <p className="data mt-2 text-2xl">{(card.v * 100).toFixed(1)}<span className="text-sm text-muted-foreground">%</span></p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <p className="kicker">ROC curve</p>
          <div className="mt-4 flex justify-center">
            <RocChart points={m.roc} auc={m.auc} />
          </div>
        </div>
        <div className="panel p-6">
          <p className="kicker">Confusion matrix</p>
          <div className="mt-6 grid grid-cols-[auto_1fr_1fr] gap-2 text-sm">
            <span />
            <span className="text-center text-xs text-muted-foreground">Predicted negative</span>
            <span className="text-center text-xs text-muted-foreground">Predicted positive</span>
            <span className="self-center pr-2 text-right text-xs text-muted-foreground">Actual negative</span>
            <Cell value={c.tn} label="True negative" good />
            <Cell value={c.fp} label="False positive" />
            <span className="self-center pr-2 text-right text-xs text-muted-foreground">Actual positive</span>
            <Cell value={c.fn} label="False negative" />
            <Cell value={c.tp} label="True positive" good />
          </div>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            At the 0.5 threshold the model is conservative: very few false alarms (high specificity) but it misses some
            TB cases. For screening, a lower threshold would trade specificity for sensitivity.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel p-6">
          <p className="kicker">Architecture benchmark</p>
          <h2 className="mt-2 text-xl font-semibold">ResNet18 vs ResNet34 vs DenseNet121</h2>
          <table className="mt-5 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-normal">Model</th>
                <th className="pb-2 font-normal">Validation ROC-AUC</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {benchmark.map((b) => (
                <tr key={b.model} className="border-t border-border">
                  <td className="py-3 font-medium">{b.model}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-40 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${b.auc * 100}%` }} />
                      </div>
                      <span className="data">{b.auc.toFixed(4)}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    {b.best && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-normal/15 px-2 py-0.5 text-xs text-normal">
                        <Trophy className="size-3" aria-hidden="true" /> Selected
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground">
            Source: training notebook, Step 9 (10 epochs each, frozen backbone, 80/20 split). ResNet18 was then retrained
            for 20 epochs and saved as the deployed model.
          </p>
        </div>

        <div className="panel border-pneumonia/30 p-6">
          <div className="flex items-center gap-2 text-pneumonia">
            <CircleAlert className="size-5" aria-hidden="true" />
            <p className="kicker text-pneumonia">Notes for the viva</p>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Accuracy bug in the notebook.</strong> The benchmark table prints
              accuracy ≈ 0.50 for every model because <span className="data">preds</span> has shape (56,) and{" "}
              <span className="data">true_labels</span> has shape (56, 1), so the comparison broadcasts to a 56 × 56
              matrix. The classification report in the same notebook shows the real validation accuracy of 0.86. Fix:
              <span className="data"> true_labels.ravel()</span>.
            </li>
            <li>
              <strong className="text-foreground">Optimistic numbers.</strong> The notebook used an unseeded random
              80/20 split, so the exact validation images are unknown and most images above were seen in training.
              Treat these as an upper bound; a held-out external set is needed for a fair estimate.
            </li>
            <li>
              <strong className="text-foreground">Small dataset.</strong> 278 images is small for deep learning; results
              will vary between runs.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Cell({ value, label, good }: { value: number; label: string; good?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 text-center ${good ? "border-normal/30 bg-normal/10" : "border-tb/30 bg-tb/10"}`}>
      <div className="data text-3xl">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
