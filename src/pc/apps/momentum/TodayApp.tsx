/**
 * Today — the habit tracker's dashboard, as a desktop app.
 *
 * Same job the `/dashboard` route did, minus the AppShell chrome: inside a
 * window the sidebar and bottom nav are the taskbar's job, so the app is
 * only its content. Layout is container-driven rather than breakpoint-driven
 * because a window is resizable independently of the viewport — a narrow
 * window on a wide screen still has to stack.
 */
import { useState } from "react";
import { Plus, Flame, Trophy, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HabitCard } from "@/components/momentum/HabitCard";
import { Heatmap } from "@/components/momentum/Heatmap";
import { HabitDialog, type HabitDraft } from "@/components/momentum/HabitDialog";
import { supabase } from "@/integrations/supabase/client";
import { calcStreak, HABIT_TEMPLATES, quoteOfDay } from "@/lib/momentum";
import { useHabits } from "./useHabits";
import { AppSurface, SurfaceHeader } from "../shared/AppSurface";

export function TodayApp() {
  const {
    activeHabits,
    loading,
    datesByHabit,
    completedToday,
    allDates,
    overallStreak,
    toggle,
    save,
    refresh,
  } = useHabits();
  const [open, setOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const todayDone = completedToday.size;
  const todayTotal = activeHabits.length;
  const pct = todayTotal ? Math.round((todayDone / todayTotal) * 100) : 0;

  async function handleToggle(habitId: string) {
    const habit = activeHabits.find((h) => h.id === habitId);
    if (!habit) return;
    const res = await toggle(habit);
    if (!res.ok) toast.error(res.error ?? "Could not save");
  }

  async function createHabit(d: HabitDraft) {
    const res = await save({
      id: d.id,
      name: d.name,
      description: d.description,
      icon: d.icon,
      color: d.color,
      frequency: d.frequency,
      target_per_period: d.target_per_period,
    });
    if (res.ok) toast.success("Habit added");
    else toast.error(res.error ?? "Could not save");
  }

  async function seedDemo() {
    setSeeding(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You are signed out.");
      const picks = HABIT_TEMPLATES.slice(0, 4).map((t, i) => ({
        user_id: user.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        color: t.color,
        frequency: "daily",
        target_per_period: 1,
        sort_order: i,
      }));
      const { data: inserted, error } = await supabase.from("habits").insert(picks).select();
      if (error) throw error;
      if (inserted?.length) {
        const sampleLogs: { user_id: string; habit_id: string; logged_date: string }[] = [];
        for (const h of inserted) {
          for (let i = 0; i < 21; i++) {
            if (Math.random() > 0.3) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              sampleLogs.push({
                user_id: user.id,
                habit_id: h.id,
                logged_date: d.toISOString().slice(0, 10),
              });
            }
          }
        }
        await supabase.from("habit_logs").insert(sampleLogs);
      }
      toast.success("Demo data added");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not seed demo");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <AppSurface>
      <SurfaceHeader
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        title="Today"
        action={
          <Button onClick={() => setOpen(true)} className="gap-2 shrink-0">
            <Plus className="size-4" /> New habit
          </Button>
        }
      />

      <div className="grid @2xl:grid-cols-3 gap-3 mb-6">
        <StatCard
          icon={Flame}
          tint="warm"
          label="Current streak"
          value={`${overallStreak} ${overallStreak === 1 ? "day" : "days"}`}
        />
        <StatCard
          icon={Trophy}
          tint="primary"
          label="Today"
          value={`${todayDone}/${todayTotal} (${pct}%)`}
        />
        <StatCard icon={Calendar} tint="muted" label="Days logged" value={`${allDates.size}`} />
      </div>

      <div className="p-5 rounded-2xl bg-gradient-hero text-primary-foreground shadow-glow mb-6">
        <p className="text-sm opacity-80">Today's note</p>
        <p className="text-lg font-medium mt-1">{quoteOfDay()}</p>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Your habits</h2>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[76px] rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : activeHabits.length === 0 ? (
          <EmptyState onSeed={seedDemo} onAdd={() => setOpen(true)} seeding={seeding} />
        ) : (
          <div className="space-y-3">
            {activeHabits.map((h) => {
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
                  onToggle={() => handleToggle(h.id)}
                />
              );
            })}
          </div>
        )}
      </section>

      {activeHabits.length > 0 && (
        <section className="p-5 rounded-2xl bg-card border border-border shadow-soft">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="font-semibold">Last 12 weeks</h2>
            <span className="text-xs text-muted-foreground">Any habit completed</span>
          </div>
          <Heatmap completedDates={allDates} days={84} />
        </section>
      )}

      <HabitDialog open={open} onOpenChange={setOpen} onSubmit={createHabit} />
    </AppSurface>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tint: "warm" | "primary" | "muted";
}) {
  const tints = {
    warm: "bg-accent-warm/10 text-accent-warm",
    primary: "bg-primary/10 text-primary",
    muted: "bg-muted text-muted-foreground",
  } as const;
  return (
    <div className="p-4 rounded-2xl bg-card border border-border shadow-soft flex items-center gap-3">
      <div className={"grid place-items-center size-10 rounded-xl shrink-0 " + tints[tint]}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({
  onSeed,
  onAdd,
  seeding,
}: {
  onSeed: () => void;
  onAdd: () => void;
  seeding: boolean;
}) {
  return (
    <div className="p-8 rounded-2xl border border-dashed border-border bg-card/50 text-center">
      <div className="text-4xl mb-3">🌱</div>
      <h3 className="font-semibold text-lg">Plant your first habit</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        Start with one small thing you'd like to do most days. You can always add more later.
      </p>
      <div className="mt-5 flex flex-col @md:flex-row gap-2 justify-center">
        <Button onClick={onAdd}>
          <Plus className="size-4" /> Add a habit
        </Button>
        <Button variant="outline" onClick={onSeed} disabled={seeding}>
          {seeding ? "Loading…" : "Try with demo data"}
        </Button>
      </div>
    </div>
  );
}

export default TodayApp;
