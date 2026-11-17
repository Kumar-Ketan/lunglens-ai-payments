import { ShieldCheck } from "lucide-react";

export function Disclaimer({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-pneumonia/30 bg-pneumonia/5 p-4 text-sm text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-pneumonia" aria-hidden="true" />
      <p>
        <strong className="text-foreground">Research use only.</strong>{" "}
        {children ??
          "This prototype is not a medical device and is not validated for clinical diagnosis or treatment decisions. Always consult a qualified radiologist."}
      </p>
    </div>
  );
}
