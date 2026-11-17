import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, LogOut, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/", label: "Home" },
  { to: "/detect", label: "Detection" },
  { to: "/history", label: "History" },
  { to: "/metrics", label: "Model metrics" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/about", label: "About" },
] as const;

export function SiteHeader() {
  const { session, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/40">
            <Activity className="size-4" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            LungScan <span className="text-primary">AI</span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Main navigation">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          {ready && session ? (
            <>
              <span className="max-w-44 truncate text-xs text-muted-foreground" title={session.user.email ?? ""}>
                {session.user.email}
              </span>
              <Button variant="glass" size="sm" onClick={signOut}>
                <LogOut aria-hidden="true" /> Sign out
              </Button>
            </>
          ) : (
            <Button variant="glass" size="sm" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
          <Button variant="hero" size="sm" asChild>
            <Link to="/detect">
              Analyse X-ray <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open && (
        <nav className="border-t border-border bg-background px-5 py-3 lg:hidden" aria-label="Mobile navigation">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm text-muted-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-2 border-t border-border pt-3">
            {session ? (
              <Button variant="glass" className="w-full" onClick={signOut}>
                <LogOut aria-hidden="true" /> Sign out
              </Button>
            ) : (
              <Button variant="hero" className="w-full" asChild>
                <Link to="/auth" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
