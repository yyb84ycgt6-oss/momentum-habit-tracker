import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Check, Flame, BarChart3, Bell, Lock, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/momentum/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Momentum — Calm habit tracking for busy professionals" },
      {
        name: "description",
        content:
          "Build daily habits with beautiful streaks, heatmaps, and gentle motivation. Free to start.",
      },
      { property: "og:title", content: "Momentum — Calm habit tracking" },
      {
        property: "og:description",
        content:
          "Beautiful, calm habit tracking. Streaks, heatmaps and gentle nudges for busy professionals.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-calm text-foreground">
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center size-9 rounded-xl bg-gradient-hero shadow-glow text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <span className="font-semibold text-lg tracking-tight">Momentum</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/auth">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 md:pt-24 md:pb-28 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6 animate-fade-up">
          <Sparkles className="size-3.5" /> Calm consistency, not gamified streaks
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight animate-fade-up">
          Small habits.
          <br />
          <span className="bg-gradient-hero bg-clip-text text-transparent">
            Compounding momentum.
          </span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-up">
          A calm, beautiful habit tracker for busy professionals. One‑tap check‑ins, quiet streaks,
          and the visualizations you actually want to come back to.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-up">
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button variant="hero" size="lg" className="px-8">
              Get started free
            </Button>
          </Link>
          <Link to="/auth">
            <Button variant="ghost" size="lg">
              I already have an account
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          No credit card. Email or Google sign‑in.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-20 grid md:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="p-6 rounded-2xl bg-card border border-border shadow-soft">
            <div className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary mb-4">
              <f.icon className="size-5" />
            </div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-center text-2xl md:text-3xl font-semibold tracking-tight mb-10">
          Loved by people who tried everything else
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="p-6 rounded-2xl bg-card border border-border shadow-soft"
            >
              <blockquote className="text-sm leading-relaxed">"{t.quote}"</blockquote>
              <figcaption className="mt-4 text-sm">
                <div className="font-medium">{t.name}</div>
                <div className="text-muted-foreground">{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="p-10 rounded-3xl bg-gradient-hero text-primary-foreground shadow-glow">
          <h2 className="text-3xl font-semibold tracking-tight">Start your streak today</h2>
          <p className="mt-3 opacity-90">
            It takes 30 seconds. Bring one habit; we'll handle the rest.
          </p>
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button variant="accent" size="lg" className="mt-6 px-8">
              Get started free
            </Button>
          </Link>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-sm text-muted-foreground flex flex-col sm:flex-row gap-2 justify-between">
        <div>© {new Date().getFullYear()} Momentum</div>
        <div className="flex gap-4">
          <span>Privacy‑first</span>
          <span>No social pressure</span>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: Check,
    title: "One‑tap check‑ins",
    body: "Mark today done in a single calm tap. No friction, no guilt.",
  },
  {
    icon: Flame,
    title: "Quiet streaks",
    body: "See momentum build with beautiful streak counters and 12‑week heatmaps.",
  },
  {
    icon: BarChart3,
    title: "Honest progress",
    body: "Trend lines, completion rates, and exports — your data, your story.",
  },
  {
    icon: Sun,
    title: "Light & dark themes",
    body: "Built for early mornings and late nights. Follows your system.",
  },
  { icon: Bell, title: "Gentle reminders", body: "Opt‑in notifications that nudge, never nag." },
  {
    icon: Lock,
    title: "Yours alone",
    body: "Private by default. Export or delete your data anytime.",
  },
];

const TESTIMONIALS = [
  {
    quote: "Finally a tracker that feels like a deep breath, not a leaderboard.",
    name: "Maya R.",
    role: "Product designer",
  },
  {
    quote: "I've kept a 90‑day reading streak — first time anything has stuck.",
    name: "Daniel K.",
    role: "Founder",
  },
  {
    quote: "It looks beautiful and it just works. That's a rare combo.",
    name: "Priya S.",
    role: "Senior engineer",
  },
];
