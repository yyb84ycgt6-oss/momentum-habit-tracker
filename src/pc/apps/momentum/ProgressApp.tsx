/**
 * Progress — streaks, trends and the heatmap, as a desktop app.
 *
 * Carries over the `/progress` route. The recharts axes there were styled
 * with `hsl(var(--border))`, which never resolved: this project's tokens are
 * oklch and already complete colors, so the grid silently fell back to the
 * default. They read the token directly here.
 */
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Heatmap } from "@/components/momentum/Heatmap";
import { dateISO, calcStreak, calcLongestStreak, iconFor, HABIT_COLORS } from "@/lib/momentum";
import { useHabits } from "./useHabits";
import { AppSurface, SurfaceHeader } from "../shared/AppSurface";

export function ProgressApp() {
  const { activeHabits, logs, allDates } = useHabits();
  const [range, setRange] = useState<30 | 90 | 365>(90);

  const trend = useMemo(() => {
    const days: { date: string; completed: number; rate: number }[] = [];
    const today = new Date();
    const totalHabits = activeHabits.length || 1;
    // Counting per day out of a Map is O(logs); the route filtered the whole
    // log array once per day rendered, which is O(range × logs) — visible at
    // the 365-day range once a few months of history exist.
    const byDate = new Map<string, number>();
    for (const l of logs) byDate.set(l.logged_date, (byDate.get(l.logged_date) ?? 0) + 1);

    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = dateISO(d);
      const done = byDate.get(iso) ?? 0;
      days.push({
        date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        completed: done,
        rate: Math.round((done / totalHabits) * 100),
      });
    }
    return days;
  }, [logs, activeHabits.length, range]);

  const perHabit = useMemo(() => {
    return activeHabits.map((h) => {
      const dates = new Set(logs.filter((l) => l.habit_id === h.id).map((l) => l.logged_date));
      const current = calcStreak(dates);
      const longest = calcLongestStreak(dates);
      let hits = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (dates.has(dateISO(d))) hits += 1;
      }
      return { habit: h, current, longest, last30: Math.round((hits / 30) * 100) };
    });
  }, [activeHabits, logs]);

  function exportCSV() {
    const rows = [["habit_id", "habit_name", "logged_date"]];
    const map = new Map(activeHabits.map((h) => [h.id, h.name]));
    for (const l of logs) rows.push([l.habit_id, map.get(l.habit_id) ?? "", l.logged_date]);
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `momentum-${dateISO(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tooltipStyle = {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--color-card-foreground)",
  };

  return (
    <AppSurface>
      <SurfaceHeader
        title="Progress"
        subtitle="The quiet story of your consistency."
        action={
          <Button variant="outline" onClick={exportCSV} className="gap-2 shrink-0">
            <Download className="size-4" /> Export
          </Button>
        }
      />

      <div className="inline-flex rounded-full bg-muted p-1 mb-6">
        {([30, 90, 365] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={
              "px-4 py-1.5 rounded-full text-sm transition-colors " +
              (range === r ? "bg-background text-foreground shadow-soft" : "text-muted-foreground")
            }
          >
            {r === 30 ? "30 days" : r === 90 ? "90 days" : "1 year"}
          </button>
        ))}
      </div>

      <section className="p-5 rounded-2xl bg-card border border-border shadow-soft mb-6">
        <h2 className="font-semibold mb-4">Completion rate</h2>
        <div className="h-64 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                opacity={0.5}
                interval={Math.max(0, Math.floor(trend.length / 8))}
              />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} unit="%" />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="p-5 rounded-2xl bg-card border border-border shadow-soft mb-6">
        <h2 className="font-semibold mb-4">Habits completed per day</h2>
        <div className="h-56 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                opacity={0.5}
                interval={Math.max(0, Math.floor(trend.length / 8))}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                opacity={0.5}
                allowDecimals={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="completed" fill="var(--color-accent-warm)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="p-5 rounded-2xl bg-card border border-border shadow-soft mb-6">
        <h2 className="font-semibold mb-4">All activity</h2>
        <Heatmap completedDates={allDates} days={range === 30 ? 35 : range === 90 ? 91 : 365} />
      </section>

      <section>
        <h2 className="font-semibold mb-3">By habit</h2>
        <div className="grid @2xl:grid-cols-2 gap-3">
          {perHabit.map(({ habit, current, longest, last30 }) => {
            const c = HABIT_COLORS[habit.color] ?? HABIT_COLORS.teal;
            const Icon = iconFor(habit.icon);
            return (
              <div
                key={habit.id}
                className="p-4 rounded-2xl bg-card border border-border shadow-soft"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={
                      "grid place-items-center size-10 rounded-xl shrink-0 " + c.soft + " " + c.text
                    }
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="font-medium truncate">{habit.name}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Current" value={`${current}d`} />
                  <Stat label="Longest" value={`${longest}d`} />
                  <Stat label="30-day" value={`${last30}%`} />
                </div>
              </div>
            );
          })}
          {perHabit.length === 0 && (
            <p className="text-sm text-muted-foreground">Add habits to see breakdowns.</p>
          )}
        </div>
      </section>
    </AppSurface>
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

export default ProgressApp;
