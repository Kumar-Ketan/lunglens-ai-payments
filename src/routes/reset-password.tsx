import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password | LungScan AI" },
      { name: "description", content: "Choose a new password for your LungScan AI account." },
      { property: "og:title", content: "Set a new password | LungScan AI" },
      { property: "og:description", content: "Choose a new password for your LungScan AI account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setIsRecovery(true);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/detect", replace: true });
  }

  return (
    <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-md place-items-center px-5 py-12">
      <form onSubmit={onSubmit} className="panel w-full space-y-4 p-7">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        {!isRecovery && (
          <p className="text-sm text-muted-foreground">Open this page from the reset link in your email.</p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" minLength={6} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" variant="hero" className="w-full" disabled={busy || !isRecovery}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />} Update password
        </Button>
      </form>
    </section>
  );
}
