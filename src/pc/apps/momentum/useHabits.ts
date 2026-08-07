/**
 * useHabits — the habit tracker's data layer, shared by every surface.
 *
 * As routes, each habit screen owned a private copy of this query logic and
 * only the dashboard subscribed to realtime. On a desktop that breaks down
 * immediately: Today, Progress and Habits can all be on screen at once, so
 * checking a habit in one window has to move the streak in another. One
 * hook, one subscription, one cache — every window reads the same rows.
 *
 * Mutations also announce themselves on the PC bus, which is what lets
 * non-habit apps (the Terminal's `habit` command, the Activity Center)
 * react to real progress instead of polling.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bus } from "@/pc/lib/bus";
import { calcStreak, todayISO, type HabitColor } from "@/lib/momentum";

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: HabitColor;
  frequency: "daily" | "weekly";
  target_per_period: number;
  archived: boolean;
  sort_order: number;
}

export interface HabitLog {
  habit_id: string;
  logged_date: string;
}

export interface HabitDraftInput {
  id?: string;
  name: string;
  description: string;
  icon: string;
  color: HabitColor;
  frequency: "daily" | "weekly";
  target_per_period: number;
}

/**
 * Module-level cache shared by every mounted instance.
 *
 * Without it, opening four habit windows means four identical table scans
 * and four realtime channels. The store is deliberately tiny — a snapshot
 * plus a listener set — rather than a state library, because the desktop
 * only ever has one user's habits in memory.
 */
interface Snapshot {
  habits: Habit[];
  logs: HabitLog[];
  loading: boolean;
}

let snapshot: Snapshot = { habits: [], logs: [], loading: true };
const listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;
let channelRefs = 0;
let channel: ReturnType<typeof supabase.channel> | null = null;

function publish(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

async function loadAll(): Promise<void> {
  const [{ data: h }, { data: l }] = await Promise.all([
    supabase.from("habits").select("*").order("sort_order"),
    supabase.from("habit_logs").select("habit_id, logged_date"),
  ]);
  publish({
    habits: (h ?? []) as Habit[],
    logs: (l ?? []) as HabitLog[],
    loading: false,
  });
}

/** Coalesces concurrent refreshes — four windows mounting at once issue one query. */
function refresh(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = loadAll().finally(() => {
    loadPromise = null;
  });
  return loadPromise;
}

export function useHabits() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);

    if (snapshot.loading) void refresh();

    // One realtime channel for the whole desktop, reference-counted so the
    // last window to close is the one that tears it down.
    channelRefs += 1;
    if (channelRefs === 1 && !channel) {
      channel = supabase
        .channel("pc-habits-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "habit_logs" },
          () => void refresh(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "habits" },
          () => void refresh(),
        )
        .subscribe();
    }

    return () => {
      listeners.delete(listener);
      channelRefs -= 1;
      if (channelRefs === 0 && channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, []);

  const { habits, logs, loading } = snapshot;
  const today = todayISO();

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);

  /** habit id → the set of dates it was completed on. */
  const datesByHabit = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const h of habits) map.set(h.id, new Set());
    for (const log of logs) map.get(log.habit_id)?.add(log.logged_date);
    return map;
  }, [habits, logs]);

  const completedToday = useMemo(
    () => new Set(logs.filter((l) => l.logged_date === today).map((l) => l.habit_id)),
    [logs, today],
  );

  /** Every date on which at least one habit was completed. */
  const allDates = useMemo(() => new Set(logs.map((l) => l.logged_date)), [logs]);

  const overallStreak = useMemo(() => calcStreak(allDates), [allDates]);

  const toggle = useCallback(
    async (habit: Habit): Promise<{ ok: boolean; error?: string }> => {
      const done = snapshot.logs.some((l) => l.habit_id === habit.id && l.logged_date === today);

      // Optimistic: the checkbox must respond to the tap, not to the network.
      // Reverted below if the write is rejected.
      const previous = snapshot.logs;
      publish({
        logs: done
          ? previous.filter((l) => !(l.habit_id === habit.id && l.logged_date === today))
          : [...previous, { habit_id: habit.id, logged_date: today }],
      });

      try {
        if (done) {
          const { error } = await supabase
            .from("habit_logs")
            .delete()
            .eq("habit_id", habit.id)
            .eq("logged_date", today);
          if (error) throw error;
        } else {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error("You are signed out.");
          const { error } = await supabase
            .from("habit_logs")
            .insert({ habit_id: habit.id, user_id: user.id, logged_date: today });
          if (error) throw error;
        }
        bus.emit("habit-logged", { habitId: habit.id, date: today, logged: !done });
        return { ok: true };
      } catch (err) {
        publish({ logs: previous });
        return { ok: false, error: err instanceof Error ? err.message : "Could not save" };
      }
    },
    [today],
  );

  const save = useCallback(
    async (draft: HabitDraftInput): Promise<{ ok: boolean; error?: string }> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("You are signed out.");

        const fields = {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          icon: draft.icon,
          color: draft.color,
          frequency: draft.frequency,
          target_per_period: draft.target_per_period,
        };

        if (draft.id) {
          const { error } = await supabase.from("habits").update(fields).eq("id", draft.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("habits")
            .insert({ ...fields, user_id: user.id, sort_order: snapshot.habits.length });
          if (error) throw error;
        }
        await refresh();
        bus.emit("habits-changed");
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Could not save" };
      }
    },
    [],
  );

  const remove = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
      await refresh();
      bus.emit("habits-changed");
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not delete" };
    }
  }, []);

  const setArchived = useCallback(async (id: string, archived: boolean) => {
    const { error } = await supabase.from("habits").update({ archived }).eq("id", id);
    if (!error) {
      await refresh();
      bus.emit("habits-changed");
    }
    return { ok: !error, error: error?.message };
  }, []);

  return {
    habits,
    activeHabits,
    logs,
    loading,
    today,
    datesByHabit,
    completedToday,
    allDates,
    overallStreak,
    toggle,
    save,
    remove,
    setArchived,
    refresh,
  };
}

/** Imperative refresh for non-React callers (the Terminal's habit command). */
export { refresh as refreshHabits };

/** Snapshot read for non-React callers. */
export function habitsSnapshot(): Snapshot {
  return snapshot;
}
