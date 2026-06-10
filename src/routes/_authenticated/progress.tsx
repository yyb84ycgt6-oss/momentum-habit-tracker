import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Download } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { AppShell } from "@/components/momentum/AppShell";
import { Button } from "@/components/ui/button";
import { Heatmap } from "@/components/momentum/Heatmap";
import { supabase } from "@/integrations/supabase/client";
import { dateISO, calcStreak, calcLongestStreak, iconFor, HABIT_COLORS, type HabitColor } from "@/lib/momentum";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progress — Momentum" }] }),
  component: Progress,
});

interface Habit { id: string; name: string; icon: string; color: HabitColor; }
interface Log { habit_id: string; logged_date: string; }

function Progress() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [range, setRange] = useState<30 | 90 | 365>(90);

  useEffect(() => {
    (async () => {
      const [{ data: h }, { data: l }] = await Promise.all([
        supabase.from("habits").select("id, name, icon, color").eq("archived", false).order("sort_order"),
        supabase.from("habit_logs").select("habit_id, logged_date"),
      ]);
      setHabits((h ?? []) as Habit[]);
      setLogs((l ?? []) as Log[]);
    })();
  }, []);

  const allDates = useMemo(() => new Set(logs.map((l) => l.logged_date)), [logs]);

  const trend = useMemo(() => {
    const days: { date: string; completed: number; rate: number }[] = [];
    const today = new Date();
    const totalHabits = habits.length || 1;
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const iso = dateISO(d);
      const done = logs.filter((l) => l.logged_date === iso).length;
      days.push({
        date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        completed: done,
        rate: Math.round((done / totalHabits) * 100),
      });
    }
    return days;
  }, [logs, habits.length, range]);

  const perHabit = useMemo(() => {
    return habits.map((h) => {
      const dates = new Set(logs.filter((l) => l.habit_id === h.id).map((l) => l.logged_date));
      const current = calcStreak(dates);
      const longest = calcLongestStreak(dates);
      const last30 = (() => {
        let n = 0;
        for (let i = 0; i < 30; i++) {
          const d = new Date(); d.setDate(d.getDate() - i);
          if (dates.has(dateISO(d))) n++;
        }
        return Math.round((n / 30) * 100);
      })();
      return { habit: h, current, longest, last30 };
    });
  }, [habits, logs]);

  function exportCSV() {
    const rows = [["habit_id", "habit_name", "logged_date"]];
    const map = new Map(habits.map((h) => [h.id, h.name]));
    for (const l of logs) rows.push([l.habit_id, map.get(l.habit_id) ?? "", l.logged_date]);
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `momentum-${dateISO(new Date())}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Progress</h1>
          <p className="text-muted-foreground mt-1">The quiet story of your consistency.</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2 shrink-0">
          <Download className="size-4" /> Export
        </Button>
      </div>

      <div className="inline-flex rounded-full bg-muted p-1 mb-6">
        {([30, 90, 365] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={
              "px-4 py-1.5 rounded-full text-sm transition-colors " +
              (range === r ? "bg-background text-foreground shadow-soft" : "text-muted-foreground")
            }>
            {r === 30 ? "30 days" : r === 90 ? "90 days" : "1 year"}
          </button>
        ))}
      </div>

      <section className="p-5 md:p-6 rounded-2xl bg-card border border-border shadow-soft mb-6">
        <h2 className="font-semibold mb-4">Completion rate</h2>
        <div className="h-64 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5}
                interval={Math.max(0, Math.floor(trend.length / 8))} />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} unit="%" />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="rate" stroke="#0F766E" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="p-5 md:p-6 rounded-2xl bg-card border border-border shadow-soft mb-6">
        <h2 className="font-semibold mb-4">Habits completed per day</h2>
        <div className="h-56 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5}
                interval={Math.max(0, Math.floor(trend.length / 8))} />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="completed" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="p-5 md:p-6 rounded-2xl bg-card border border-border shadow-soft mb-6">
        <h2 className="font-semibold mb-4">All activity</h2>
        <Heatmap completedDates={allDates} days={range === 30 ? 35 : range === 90 ? 91 : 365} />
      </section>

      <section>
        <h2 className="font-semibold mb-3">By habit</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {perHabit.map(({ habit, current, longest, last30 }) => {
            const c = HABIT_COLORS[habit.color] ?? HABIT_COLORS.teal;
            const Icon = iconFor(habit.icon);
            return (
              <div key={habit.id} className="p-4 rounded-2xl bg-card border border-border shadow-soft">
                <div className="flex items-center gap-3 mb-3">
                  <div className={"grid place-items-center size-10 rounded-xl " + c.soft + " " + c.text}>
                    <Icon className="size-5" />
                  </div>
                  <div className="font-medium">{habit.name}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Current" value={`${current}d`} />
                  <Stat label="Longest" value={`${longest}d`} />
                  <Stat label="30‑day" value={`${last30}%`} />
                </div>
              </div>
            );
          })}
          {perHabit.length === 0 && (
            <p className="text-sm text-muted-foreground">Add habits to see breakdowns.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-muted/50">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
