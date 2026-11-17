const tone = {
  normal: "bg-normal",
  pneumonia: "bg-pneumonia",
  tb: "bg-tb",
  primary: "bg-primary",
} as const;

export function ProbabilityBar({
  label,
  value,
  kind,
  marker,
}: {
  label: string;
  value: number | null | undefined;
  kind: keyof typeof tone;
  marker?: number;
}) {
  const v = value == null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          {kind !== "primary" && <span className={`marker marker-${kind}`} />}
          {label}
        </span>
        <span className="data">{value == null ? "—" : `${(v * 100).toFixed(1)}%`}</span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${tone[kind]} transition-[width] duration-700`} style={{ width: `${v * 100}%` }} />
        {marker != null && <span className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${marker * 100}%` }} />}
      </div>
    </div>
  );
}
