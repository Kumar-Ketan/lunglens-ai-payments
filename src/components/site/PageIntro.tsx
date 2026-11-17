import type { ReactNode } from "react";
import { Cpu } from "lucide-react";

export function PageIntro({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-3xl animate-rise">
      <div className="eyebrow">
        <Cpu aria-hidden="true" /> {label}
      </div>
      <h1 className="mt-5 text-4xl font-semibold sm:text-5xl">{title}</h1>
      {children && <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{children}</p>}
    </div>
  );
}
