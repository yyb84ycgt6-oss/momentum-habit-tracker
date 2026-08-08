import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HABIT_COLORS, ICON_KEYS, iconFor, type HabitColor } from "@/lib/momentum";
import { cn } from "@/lib/utils";

export interface HabitDraft {
  id?: string;
  name: string;
  description: string;
  icon: string;
  color: HabitColor;
  frequency: "daily" | "weekly";
  target_per_period: number;
}

const empty: HabitDraft = {
  name: "",
  description: "",
  icon: "sparkles",
  color: "teal",
  frequency: "daily",
  target_per_period: 1,
};

export function HabitDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<HabitDraft>;
  onSubmit: (draft: HabitDraft) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<HabitDraft>({ ...empty, ...initial });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft({ ...empty, ...initial });
  }, [open, initial]);

  async function save() {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(draft);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit habit" : "New habit"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={draft.name}
              maxLength={60}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Morning walk"
            />
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={draft.description}
              rows={2}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="A short reminder of why this matters"
            />
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {(Object.keys(HABIT_COLORS) as HabitColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={cn(
                    "size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition",
                    HABIT_COLORS[c].bg,
                    draft.color === c ? HABIT_COLORS[c].ring : "ring-transparent",
                  )}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-1.5 mt-1.5">
              {ICON_KEYS.map((k) => {
                const Icon = iconFor(k);
                const active = draft.icon === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft({ ...draft, icon: k })}
                    className={cn(
                      "aspect-square grid place-items-center rounded-lg border transition",
                      active
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="freq">Frequency</Label>
              <select
                id="freq"
                value={draft.frequency}
                onChange={(e) =>
                  setDraft({ ...draft, frequency: e.target.value as "daily" | "weekly" })
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <Label htmlFor="target">Target / period</Label>
              <Input
                id="target"
                type="number"
                min={1}
                max={20}
                value={draft.target_per_period}
                onChange={(e) =>
                  setDraft({ ...draft, target_per_period: Number(e.target.value) || 1 })
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter className="flex sm:justify-between gap-2">
          {initial?.id && onDelete ? (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={async () => {
                await onDelete();
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !draft.name.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
