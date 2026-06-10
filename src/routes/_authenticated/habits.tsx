import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil } from "lucide-react";
import { AppShell } from "@/components/momentum/AppShell";
import { Button } from "@/components/ui/button";
import { HabitDialog, type HabitDraft } from "@/components/momentum/HabitDialog";
import { supabase } from "@/integrations/supabase/client";
import { HABIT_TEMPLATES, HABIT_COLORS, iconFor, type HabitColor } from "@/lib/momentum";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({ meta: [{ title: "Habits — Momentum" }] }),
  component: Habits,
});

interface Habit {
  id: string; name: string; description: string | null;
  icon: string; color: HabitColor; frequency: "daily" | "weekly";
  target_per_period: number; archived: boolean; sort_order: number;
}

function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("habits").select("*").order("sort_order");
    setHabits((data ?? []) as Habit[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function upsert(d: HabitDraft) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (d.id) {
      const { error } = await supabase.from("habits").update({
        name: d.name.trim(), description: d.description.trim() || null,
        icon: d.icon, color: d.color, frequency: d.frequency,
        target_per_period: d.target_per_period,
      }).eq("id", d.id);
      if (error) return toast.error(error.message);
      toast.success("Habit updated");
    } else {
      const { error } = await supabase.from("habits").insert({
        user_id: user.id, name: d.name.trim(), description: d.description.trim() || null,
        icon: d.icon, color: d.color, frequency: d.frequency,
        target_per_period: d.target_per_period, sort_order: habits.length,
      });
      if (error) return toast.error(error.message);
      toast.success("Habit added");
    }
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Habit deleted"); load(); }
  }

  async function addTemplate(t: typeof HABIT_TEMPLATES[number]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("habits").insert({
      user_id: user.id, name: t.name, description: t.description,
      icon: t.icon, color: t.color, frequency: "daily",
      target_per_period: t.target_per_period, sort_order: habits.length,
    });
    if (error) return toast.error(error.message);
    toast.success(`Added "${t.name}"`);
    load();
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Habits</h1>
          <p className="text-muted-foreground mt-1">Design the practice you want to live.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2 shrink-0">
          <Plus className="size-4" /> New habit
        </Button>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Your habits</h2>
        {habits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No habits yet — add one above or pick a template below.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {habits.map((h) => {
              const c = HABIT_COLORS[h.color] ?? HABIT_COLORS.teal;
              const Icon = iconFor(h.icon);
              return (
                <div key={h.id} className={cn(
                  "p-4 rounded-2xl bg-card border border-border shadow-soft flex items-center gap-3",
                  h.archived && "opacity-50",
                )}>
                  <div className={cn("grid place-items-center size-11 rounded-xl shrink-0", c.soft, c.text)}>
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{h.name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {h.frequency === "daily" ? "Daily" : "Weekly"} · target {h.target_per_period}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(h)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick‑start templates</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {HABIT_TEMPLATES.map((t) => {
            const c = HABIT_COLORS[t.color];
            const Icon = iconFor(t.icon);
            return (
              <button key={t.name} onClick={() => addTemplate(t)}
                className="p-4 rounded-2xl bg-card border border-border shadow-soft flex items-center gap-3 text-left hover:shadow-card transition-shadow">
                <div className={cn("grid place-items-center size-11 rounded-xl shrink-0", c.soft, c.text)}>
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-sm text-muted-foreground truncate">{t.description}</div>
                </div>
                <span className="text-primary text-sm font-medium">Add</span>
              </button>
            );
          })}
        </div>
      </section>

      <HabitDialog
        open={creating}
        onOpenChange={setCreating}
        onSubmit={upsert}
      />
      <HabitDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        initial={editing ? {
          id: editing.id, name: editing.name, description: editing.description ?? "",
          icon: editing.icon, color: editing.color,
          frequency: editing.frequency, target_per_period: editing.target_per_period,
        } : undefined}
        onSubmit={upsert}
        onDelete={editing ? () => remove(editing.id) : undefined}
      />
    </AppShell>
  );
}
