import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Plus, Flame, Trophy, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/momentum/AppShell";
import { HabitCard } from "@/components/momentum/HabitCard";
import { Heatmap } from "@/components/momentum/Heatmap";
import { HabitDialog, type HabitDraft } from "@/components/momentum/HabitDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  calcStreak, todayISO, HABIT_TEMPLATES, quoteOfDay, type HabitColor,
} from "@/lib/momentum";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Today — Momentum" }] }),
  component: Dashboard,
});

interface Habit {
  id: string; name: string; description: string | null;
  icon: string; color: HabitColor; frequency: string;
  target_per_period: number; sort_order: number;
}
interface Log { habit_id: string; logged_date: string; }

function Dashboard() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const today = todayISO();

  const load = useCallback(async () => {
    const [{ data: h }, { data: l }] = await Promise.all([
      supabase.from("habits").select("*").eq("archived", false).order("sort_order"),
      supabase.from("habit_logs").select("habit_id, logged_date")
        .gte("logged_date", new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)),
    ]);
    setHabits((h ?? []) as Habit[]);
    setLogs((l ?? []) as Log[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // realtime
  useEffect(() => {
    const ch = supabase.channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "habit_logs" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "habits" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const datesByHabit = new Map<string, Set<string>>();
  for (const h of habits) datesByHabit.set(h.id, new Set());
  for (const log of logs) datesByHabit.get(log.habit_id)?.add(log.logged_date);

  const completedToday = new Set(logs.filter((l) => l.logged_date === today).map((l) => l.habit_id));
  const overallStreak = (() => {
    // Day counts as "on" if user completed >=1 habit that day
    const dayDates = new Set(logs.map((l) => l.logged_date));
    return calcStreak(dayDates);
  })();
  const allDates = new Set(logs.map((l) => l.logged_date));
  const todayDone = completedToday.size;
  const todayTotal = habits.length;
  const pct = todayTotal ? Math.round((todayDone / todayTotal) * 100) : 0;

  async function toggle(h: Habit) {
    const done = completedToday.has(h.id);
    if (done) {
      const { error } = await supabase.from("habit_logs").delete()
        .eq("habit_id", h.id).eq("logged_date", today);
      if (error) toast.error(error.message);
      else setLogs((prev) => prev.filter((l) => !(l.habit_id === h.id && l.logged_date === today)));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("habit_logs").insert({
        habit_id: h.id, user_id: user.id, logged_date: today,
      });
      if (error) toast.error(error.message);
      else setLogs((prev) => [...prev, { habit_id: h.id, logged_date: today }]);
    }
  }

  async function createHabit(d: HabitDraft) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("habits").insert({
      user_id: user.id, name: d.name.trim(), description: d.description.trim() || null,
      icon: d.icon, color: d.color, frequency: d.frequency,
      target_per_period: d.target_per_period, sort_order: habits.length,
    });
    if (error) toast.error(error.message);
    else { toast.success("Habit added"); load(); }
  }

  async function seedDemo() {
    setSeeding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const picks = HABIT_TEMPLATES.slice(0, 4).map((t, i) => ({
        user_id: user.id, name: t.name, description: t.description,
        icon: t.icon, color: t.color, frequency: "daily",
        target_per_period: 1, sort_order: i,
      }));
      const { data: inserted, error } = await supabase.from("habits").insert(picks).select();
      if (error) throw error;
      // Seed some past logs for visualization
      if (inserted?.length) {
        const sampleLogs: { user_id: string; habit_id: string; logged_date: string }[] = [];
        for (const h of inserted) {
          for (let i = 0; i < 21; i++) {
            if (Math.random() > 0.3) {
              const d = new Date(); d.setDate(d.getDate() - i);
              sampleLogs.push({ user_id: user.id, habit_id: h.id, logged_date: d.toISOString().slice(0, 10) });
            }
          }
        }
        await supabase.from("habit_logs").insert(sampleLogs);
      }
      toast.success("Demo data added");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not seed demo");
    } finally { setSeeding(false); }
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Today</h1>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 shrink-0">
          <Plus className="size-4" /> New habit
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <StatCard icon={Flame} tint="warm" label="Current streak" value={`${overallStreak} ${overallStreak === 1 ? "day" : "days"}`} />
        <StatCard icon={Trophy} tint="primary" label="Today" value={`${todayDone}/${todayTotal} (${pct}%)`} />
        <StatCard icon={Calendar} tint="muted" label="Days logged" value={`${allDates.size}`} />
      </div>

      <div className="p-5 md:p-6 rounded-2xl bg-gradient-hero text-primary-foreground shadow-glow mb-6">
        <p className="text-sm opacity-80">Today's note</p>
        <p className="text-lg md:text-xl font-medium mt-1">{quoteOfDay()}</p>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Your habits</h2>
        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] rounded-2xl bg-muted animate-pulse" />
          ))}</div>
        ) : habits.length === 0 ? (
          <EmptyState onSeed={seedDemo} onAdd={() => setOpen(true)} seeding={seeding} />
        ) : (
          <div className="space-y-3">
            {habits.map((h) => {
              const dates = datesByHabit.get(h.id) ?? new Set<string>();
              return (
                <HabitCard
                  key={h.id}
                  name={h.name}
                  description={h.description}
                  icon={h.icon}
                  color={h.color}
                  completed={completedToday.has(h.id)}
                  streak={calcStreak(dates)}
                  onToggle={() => toggle(h)}
                />
              );
            })}
          </div>
        )}
      </section>

      {habits.length > 0 && (
        <section className="p-5 md:p-6 rounded-2xl bg-card border border-border shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Last 12 weeks</h2>
            <span className="text-xs text-muted-foreground">Any habit completed</span>
          </div>
          <Heatmap completedDates={allDates} days={84} />
        </section>
      )}

      <HabitDialog open={open} onOpenChange={setOpen} onSubmit={createHabit} />
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, tint }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string;
  tint: "warm" | "primary" | "muted";
}) {
  const tints = {
    warm: "bg-accent-warm/10 text-accent-warm",
    primary: "bg-primary/10 text-primary",
    muted: "bg-muted text-muted-foreground",
  } as const;
  return (
    <div className="p-4 rounded-2xl bg-card border border-border shadow-soft flex items-center gap-3">
      <div className={"grid place-items-center size-10 rounded-xl " + tints[tint]}>
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ onSeed, onAdd, seeding }: { onSeed: () => void; onAdd: () => void; seeding: boolean }) {
  return (
    <div className="p-8 md:p-12 rounded-2xl border border-dashed border-border bg-card/50 text-center">
      <div className="text-4xl mb-3">🌱</div>
      <h3 className="font-semibold text-lg">Plant your first habit</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        Start with one small thing you'd like to do most days. You can always add more later.
      </p>
      <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
        <Button onClick={onAdd}><Plus className="size-4" /> Add a habit</Button>
        <Button variant="outline" onClick={onSeed} disabled={seeding}>
          {seeding ? "Loading…" : "Try with demo data"}
        </Button>
      </div>
    </div>
  );
}
