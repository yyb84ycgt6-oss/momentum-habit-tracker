import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s.mode === "signup" ? "signup" : "signin",
  }),
  head: () => ({ meta: [{ title: "Sign in — Momentum" }] }),
  component: Auth,
});

function Auth() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        toast.success("Account created — welcome!");
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    if (!email) { toast.error("Enter your email first"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + "/dashboard" },
      });
      if (error) throw error;
      toast.success("Magic link sent — check your email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send link");
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (res.error) {
      toast.error(res.error.message || "Google sign‑in failed");
      setBusy(false);
      return;
    }
    if (!res.redirected) {
      navigate({ to: "/dashboard", replace: true });
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-calm px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <div className="bg-card border border-border rounded-3xl shadow-card p-7">
          <div className="flex items-center gap-2 mb-1">
            <span className="grid place-items-center size-9 rounded-xl bg-gradient-hero text-primary-foreground shadow-glow">
              <Sparkles className="size-5" />
            </span>
            <span className="font-semibold text-lg tracking-tight">Momentum</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup"
              ? "Start with one habit. Build calm consistency."
              : "Pick up where you left off."}
          </p>

          <Button variant="outline" className="w-full mt-6 gap-2" onClick={google} disabled={busy}>
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground">or use email</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <form onSubmit={signInWithEmail} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} autoComplete="email"
                onChange={(e) => setEmail(e.target.value)} placeholder="you@work.com" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" minLength={6} value={password}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <Button variant="ghost" className="w-full mt-2 gap-2" onClick={magicLink} disabled={busy || !email}>
            <Mail className="size-4" /> Email me a magic link instead
          </Button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "signup" ? (
              <>Already have an account?{" "}
                <Link to="/auth" search={{ mode: "signin" }} className="text-primary font-medium">Sign in</Link>
              </>
            ) : (
              <>New to Momentum?{" "}
                <Link to="/auth" search={{ mode: "signup" }} className="text-primary font-medium">Create one</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.95l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
