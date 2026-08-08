import {
  Activity,
  BookOpen,
  Brain,
  Coffee,
  Droplet,
  Dumbbell,
  Heart,
  Leaf,
  Moon,
  Pencil,
  Sparkles,
  Sun,
  Wind,
  Apple,
  Music,
  Code,
  type LucideIcon,
} from "lucide-react";

export type HabitColor =
  | "teal"
  | "orange"
  | "violet"
  | "rose"
  | "emerald"
  | "amber"
  | "sky"
  | "slate";

export const HABIT_COLORS: Record<
  HabitColor,
  { bg: string; ring: string; text: string; soft: string }
> = {
  teal: { bg: "bg-primary", ring: "ring-primary/30", text: "text-primary", soft: "bg-primary/10" },
  orange: {
    bg: "bg-accent-warm",
    ring: "ring-accent-warm/30",
    text: "text-accent-warm",
    soft: "bg-accent-warm/10",
  },
  violet: {
    bg: "bg-violet-500",
    ring: "ring-violet-300",
    text: "text-violet-500",
    soft: "bg-violet-500/10",
  },
  rose: { bg: "bg-rose-500", ring: "ring-rose-300", text: "text-rose-500", soft: "bg-rose-500/10" },
  emerald: {
    bg: "bg-emerald-500",
    ring: "ring-emerald-300",
    text: "text-emerald-500",
    soft: "bg-emerald-500/10",
  },
  amber: {
    bg: "bg-amber-500",
    ring: "ring-amber-300",
    text: "text-amber-500",
    soft: "bg-amber-500/10",
  },
  sky: { bg: "bg-sky-500", ring: "ring-sky-300", text: "text-sky-500", soft: "bg-sky-500/10" },
  slate: {
    bg: "bg-slate-500",
    ring: "ring-slate-300",
    text: "text-slate-500",
    soft: "bg-slate-500/10",
  },
};

export const HABIT_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  droplet: Droplet,
  dumbbell: Dumbbell,
  book: BookOpen,
  brain: Brain,
  leaf: Leaf,
  moon: Moon,
  sun: Sun,
  wind: Wind,
  heart: Heart,
  pencil: Pencil,
  coffee: Coffee,
  activity: Activity,
  apple: Apple,
  music: Music,
  code: Code,
};

export const ICON_KEYS = Object.keys(HABIT_ICONS);

export function iconFor(key: string): LucideIcon {
  return HABIT_ICONS[key] ?? Sparkles;
}

export interface HabitTemplate {
  name: string;
  description: string;
  icon: string;
  color: HabitColor;
  target_per_period: number;
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    name: "Drink water",
    description: "Stay hydrated through the day",
    icon: "droplet",
    color: "sky",
    target_per_period: 1,
  },
  {
    name: "Move your body",
    description: "20 minutes of any movement",
    icon: "dumbbell",
    color: "orange",
    target_per_period: 1,
  },
  {
    name: "Read",
    description: "Read 10 pages of a book",
    icon: "book",
    color: "amber",
    target_per_period: 1,
  },
  {
    name: "Meditate",
    description: "5 quiet minutes",
    icon: "brain",
    color: "violet",
    target_per_period: 1,
  },
  {
    name: "Walk outside",
    description: "A mindful walk in fresh air",
    icon: "leaf",
    color: "emerald",
    target_per_period: 1,
  },
  {
    name: "Sleep before 11pm",
    description: "Wind down and rest",
    icon: "moon",
    color: "slate",
    target_per_period: 1,
  },
  {
    name: "Journal",
    description: "Three lines about today",
    icon: "pencil",
    color: "rose",
    target_per_period: 1,
  },
  {
    name: "Stretch",
    description: "Loosen up for 5 minutes",
    icon: "activity",
    color: "teal",
    target_per_period: 1,
  },
  {
    name: "Eat a fruit",
    description: "One piece of fresh fruit",
    icon: "apple",
    color: "rose",
    target_per_period: 1,
  },
  {
    name: "Deep work",
    description: "One 50-minute focused block",
    icon: "code",
    color: "teal",
    target_per_period: 1,
  },
];

export const QUOTES = [
  "Small steps. Every day.",
  "Consistency beats intensity.",
  "The chain you don't break is the one that builds you.",
  "Discipline is choosing what you want most over what you want now.",
  "How you spend your days is how you spend your life.",
  "Calm mind, steady progress.",
  "Showing up is the work.",
  "You don't need motivation. You need a system.",
];

export function quoteOfDay(): string {
  const day = Math.floor(Date.now() / 86_400_000);
  return QUOTES[day % QUOTES.length];
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calculate current streak (consecutive days ending today or yesterday) */
export function calcStreak(dates: Set<string>): number {
  let streak = 0;
  const today = new Date();
  // If not logged today, start from yesterday so we don't punish before EOD
  const start = dates.has(dateISO(today)) ? today : new Date(today.getTime() - 86_400_000);
  const cursor = new Date(start);
  while (dates.has(dateISO(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function calcLongestStreak(dates: Set<string>): number {
  const sorted = [...dates].sort();
  let best = 0,
    run = 0;
  let prev: Date | null = null;
  for (const iso of sorted) {
    const d = new Date(iso + "T00:00:00");
    if (prev && d.getTime() - prev.getTime() === 86_400_000) run += 1;
    else run = 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}
