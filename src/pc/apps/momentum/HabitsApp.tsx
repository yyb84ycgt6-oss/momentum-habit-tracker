/**
 * Habits — create, edit, archive and delete, as a desktop app.
 *
 * Carries over the `/habits` route, plus archive/unarchive which the route
 * never exposed: the column existed and the dashboard filtered on it, but
 * nothing in the UI could set it, so an archived habit was unreachable.
 */
import { useState } from "react";
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HabitDialog, type HabitDraft } from "@/components/momentum/HabitDialog";
import { HABIT_TEMPLATES, HABIT_COLORS, iconFor } from "@/lib/momentum";
import { cn } from "@/lib/utils";
import { useHabits, type Habit } from "./useHabits";
import { AppSurface, SurfaceHeader } from "../shared/AppSurface";

export function HabitsApp() {
  const { habits, save, remove, setArchived } = useHabits();
  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);

  async function upsert(d: HabitDraft) {
    const res = await save({
      id: d.id,
      name: d.name,
      description: d.description,
      icon: d.icon,
      color: d.color,
      frequency: d.frequency,
      target_per_period: d.target_per_period,
    });
    if (res.ok) toast.success(d.id ? "Habit updated" : "Habit added");
    else toast.error(res.error ?? "Could not save");
  }

  async function handleRemove(id: string) {
    const res = await remove(id);
    if (res.ok) toast.success("Habit deleted");
    else toast.error(res.error ?? "Could not delete");
  }

  async function toggleArchive(h: Habit) {
    const res = await setArchived(h.id, !h.archived);
    if (res.ok) toast.success(h.archived ? "Habit restored" : "Habit archived");
    else toast.error(res.error ?? "Could not update");
  }

  async function addTemplate(t: (typeof HABIT_TEMPLATES)[number]) {
    const res = await save({
      name: t.name,
      description: t.description,
      icon: t.icon,
      color: t.color,
      frequency: "daily",
      target_per_period: t.target_per_period,
    });
    if (res.ok) toast.success(`Added "${t.name}"`);
    else toast.error(res.error ?? "Could not add");
  }

  return (
    <AppSurface>
      <SurfaceHeader
        title="Habits"
        subtitle="Design the practice you want to live."
        action={
          <Button onClick={() => setCreating(true)} className="gap-2 shrink-0">
            <Plus className="size-4" /> New habit
          </Button>
        }
      />

      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Your habits</h2>
        {habits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No habits yet — add one above or pick a template below.
          </p>
        ) : (
          <div className="grid @2xl:grid-cols-2 gap-3">
            {habits.map((h) => {
              const c = HABIT_COLORS[h.color] ?? HABIT_COLORS.teal;
              const Icon = iconFor(h.icon);
              return (
                <div
                  key={h.id}
                  className={cn(
                    "p-4 rounded-2xl bg-card border border-border shadow-soft flex items-center gap-3",
                    h.archived && "opacity-60",
                  )}
                >
                  <div
                    className={cn(
                      "grid place-items-center size-11 rounded-xl shrink-0",
                      c.soft,
                      c.text,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{h.name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {h.archived
                        ? "Archived"
                        : `${h.frequency === "daily" ? "Daily" : "Weekly"} · target ${h.target_per_period}`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleArchive(h)}
                    aria-label={h.archived ? `Restore ${h.name}` : `Archive ${h.name}`}
                    title={h.archived ? "Restore" : "Archive"}
                  >
                    {h.archived ? (
                      <ArchiveRestore className="size-4" />
                    ) : (
                      <Archive className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(h)}
                    aria-label={`Edit ${h.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick-start templates</h2>
        <div className="grid @2xl:grid-cols-2 gap-3">
          {HABIT_TEMPLATES.map((t) => {
            const c = HABIT_COLORS[t.color];
            const Icon = iconFor(t.icon);
            return (
              <button
                key={t.name}
                onClick={() => addTemplate(t)}
                className="p-4 rounded-2xl bg-card border border-border shadow-soft flex items-center gap-3 text-left hover:shadow-card transition-shadow"
              >
                <div
                  className={cn(
                    "grid place-items-center size-11 rounded-xl shrink-0",
                    c.soft,
                    c.text,
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-sm text-muted-foreground truncate">{t.description}</div>
                </div>
                <span className="text-primary text-sm font-medium shrink-0">Add</span>
              </button>
            );
          })}
        </div>
      </section>

      <HabitDialog open={creating} onOpenChange={setCreating} onSubmit={upsert} />
      <HabitDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        initial={
          editing
            ? {
                id: editing.id,
                name: editing.name,
                description: editing.description ?? "",
                icon: editing.icon,
                color: editing.color,
                frequency: editing.frequency,
                target_per_period: editing.target_per_period,
              }
            : undefined
        }
        onSubmit={upsert}
        onDelete={editing ? () => handleRemove(editing.id) : undefined}
      />
    </AppSurface>
  );
}

export default HabitsApp;
