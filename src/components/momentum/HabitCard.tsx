import { Check } from "lucide-react";
import { useState } from "react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { HABIT_COLORS, iconFor, type HabitColor } from "@/lib/momentum";

export interface HabitCardProps {
  name: string;
  description?: string | null;
  icon: string;
  color: HabitColor;
  completed: boolean;
  streak: number;
  onToggle: () => void | Promise<void>;
}

export function HabitCard({ name, description, icon, color, completed, streak, onToggle }: HabitCardProps) {
  const c = HABIT_COLORS[color] ?? HABIT_COLORS.teal;
  const Icon = iconFor(icon);
  const [animating, setAnimating] = useState(false);

  async function handle() {
    const wasCompleted = completed;
    setAnimating(true);
    setTimeout(() => setAnimating(false), 420);
    await onToggle();
    if (!wasCompleted && streak > 0 && (streak + 1) % 7 === 0) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 },
        colors: ["#0F766E", "#F97316", "#14B8A6"],
        scalar: 0.9,
      });
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-soft hover:shadow-card transition-shadow">
      <div className={cn("grid place-items-center size-11 rounded-xl shrink-0", c.soft, c.text)}>
        <Icon className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{name}</div>
        {description && <div className="text-sm text-muted-foreground truncate">{description}</div>}
      </div>
      {streak > 0 && (
        <div className="hidden sm:flex items-center gap-1 text-sm text-accent-warm font-medium">
          <span aria-hidden>🔥</span>
          {streak}
        </div>
      )}
      <button
        onClick={handle}
        aria-pressed={completed}
        aria-label={completed ? `Mark ${name} as not done` : `Complete ${name}`}
        className={cn(
          "size-11 rounded-full grid place-items-center border-2 transition-all",
          animating && "animate-pop",
          completed
            ? cn(c.bg, "border-transparent text-white shadow-soft")
            : "border-border text-transparent hover:border-primary/60",
        )}
      >
        <Check className="size-5" strokeWidth={3} />
      </button>
    </div>
  );
}
