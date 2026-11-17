import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

type Search = { redirect?: string };
const REDIRECT_KEY = "lungscan.redirect";

function safePath(value: string | undefined | null) {
  if (!value) return null;
  try {
    const url = new URL(value, "http://x");
    if (value.startsWith("/") && !value.startsWith("//")) return url.pathname + url.search;
    if (typeof window !== "undefined" && url.origin === window.location.origin) return url.pathname + url.search;
  } catch {
    return null;
  }
  return null;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Sign in | LungScan AI" },
      { name: "description", content: "Sign in to LungScan AI to analyse chest X-rays and keep a private scan history." },
      { property: "og:title", content: "Sign in | LungScan AI" },
      { property: "og:description", content: "Sign in to analyse chest X-rays and keep a private scan history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { session, ready } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);

  useEffect(() => {
    const target = safePath(redirect);
    if (target) sessionStorage.setItem(REDIRECT_KEY, target);
  }, [redirect]);

  useEffect(() => {
    if (ready && session) {
      const target = safePath(sessionStorage.getItem(REDIRECT_KEY)) ?? "/detect";
      sessionStorage.removeItem(REDIRECT_KEY);
      navigate({ to: target, replace: true });
    }
  }, [ready, session, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        if (!data.session) setSent("confirm");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("reset");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/auth` });
    if (result.error) toast.error(result.error.message ?? "Sign-in failed");
  }

  return (
    <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-md place-items-center px-5 py-12">
      <div className="panel w-full p-7 animate-rise">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/40">
          <Activity className="size-5" aria-hidden="true" />
        </span>
        {sent ? (
          <div className="mt-6">
            <MailCheck className="size-8 text-normal" aria-hidden="true" />
            <h1 className="mt-3 text-2xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {sent === "confirm"
                ? `We sent a confirmation link to ${email}. Open it to activate your account.`
                : `We sent a password reset link to ${email}.`}
            </p>
            <Button variant="glass" className="mt-6 w-full" onClick={() => { setSent(null); setMode("signin"); }}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-semibold">
              {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "forgot" ? "Enter your email and we'll send a reset link." : "Sign in to analyse X-rays and keep a private scan history."}
            </p>

            {mode !== "forgot" && (
              <div className="mt-6 space-y-2.5">
                <button type="button" className="google-button flex h-10 w-full items-center justify-center gap-2.5 rounded-md px-3 text-sm" onClick={() => oauth("google")}>
                  <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
                  Continue with Google
                </button>
                <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
                  Continue with Lovable
                </button>
                <div className="auth-divider pt-2">or with email</div>
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setMode("forgot")}>
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
              <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>New here? <button className="text-primary hover:underline" onClick={() => setMode("signup")}>Create an account</button></>
              ) : (
                <>Already have an account? <button className="text-primary hover:underline" onClick={() => setMode("signin")}>Sign in</button></>
              )}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
