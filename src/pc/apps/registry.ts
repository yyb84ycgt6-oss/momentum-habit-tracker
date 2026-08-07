/**
 * App registry — the single source of truth for what the desktop can open.
 *
 * Jackie's PC dispatched apps from a ~200-line switch inside App.tsx and
 * imported all 130 components eagerly at the top of the same file, so every
 * app's code shipped in the first chunk whether or not it was ever opened.
 * Here an app is data: id, presentation, default window size, and a lazy
 * loader. That buys three things the switch could not.
 *
 *   • Code splitting. `React.lazy` means an app's bundle arrives when the
 *     window opens, so the desktop boots on the shell alone.
 *   • One list, many consumers. The Start menu, the command palette, the
 *     App Browser, the desktop icons and the Terminal's `open` command all
 *     read this array instead of maintaining parallel copies.
 *   • Compile-time safety. `AppId` is a union, so a Start-menu entry that
 *     names a missing app fails the build rather than opening a blank frame.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  Activity,
  BarChart3,
  Binary,
  Bot,
  Boxes,
  Calculator as CalculatorIcon,
  Clock as ClockIcon,
  Cloud,
  Cpu,
  Database,
  FileText,
  FolderOpen,
  Gamepad2,
  Gauge,
  Github,
  Grid2X2,
  HardDrive,
  Key,
  Layers,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Monitor,
  Network,
  Package,
  Palette,
  Presentation,
  Rocket,
  Server,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Target,
  Terminal as TerminalIcon,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppId } from "../types";

/** Grouping used by the Start menu and the App Browser. */
export type AppCategory = "momentum" | "system" | "productivity" | "games" | "ai" | "data" | "dev";

export interface AppDefinition {
  id: AppId;
  name: string;
  /** One line shown in the App Browser and the command palette. */
  description: string;
  icon: LucideIcon;
  category: AppCategory;
  /** Tailwind classes painting the desktop/Start tile. */
  bgColor: string;
  defaultSize: { width: number; height: number };
  /** Pinned to the desktop surface for a brand-new user. */
  defaultOnDesktop?: boolean;
  component: LazyExoticComponent<ComponentType<Record<string, never>>>;
}

/** Narrows a module with any export shape down to what `lazy` expects. */
type AnyComponent = ComponentType<Record<string, never>>;
function pick(loader: () => Promise<Record<string, unknown>>, exportName: string) {
  return lazy(async () => {
    const mod = await loader();
    const found = (mod[exportName] ?? mod.default) as AnyComponent | undefined;
    if (!found) throw new Error(`App module has no "${exportName}" or default export`);
    return { default: found };
  });
}

export const APPS: AppDefinition[] = [
  /* ── Momentum: the habit tracker, as first-class desktop apps ───────── */
  {
    id: "momentum_today",
    name: "Today",
    description: "Check off today's habits and watch the streak hold.",
    icon: LayoutDashboard,
    category: "momentum",
    bgColor:
      "bg-gradient-to-br from-teal-500 via-teal-700 to-zinc-950 border border-teal-400/50 shadow-[0_0_15px_rgba(45,212,191,0.35)]",
    defaultSize: { width: 880, height: 720 },
    defaultOnDesktop: true,
    component: pick(() => import("./momentum/TodayApp"), "TodayApp"),
  },
  {
    id: "momentum_habits",
    name: "Habits",
    description: "Create, edit, archive and template your practice.",
    icon: ListChecks,
    category: "momentum",
    bgColor:
      "bg-gradient-to-br from-emerald-500 via-teal-700 to-zinc-950 border border-emerald-400/40",
    defaultSize: { width: 880, height: 700 },
    defaultOnDesktop: true,
    component: pick(() => import("./momentum/HabitsApp"), "HabitsApp"),
  },
  {
    id: "momentum_progress",
    name: "Progress",
    description: "Trends, heatmap and per-habit streak breakdowns.",
    icon: LineChart,
    category: "momentum",
    bgColor:
      "bg-gradient-to-br from-orange-500 via-rose-700 to-zinc-950 border border-orange-400/40",
    defaultSize: { width: 900, height: 760 },
    defaultOnDesktop: true,
    component: pick(() => import("./momentum/ProgressApp"), "ProgressApp"),
  },
  {
    id: "momentum_settings",
    name: "Momentum Settings",
    description: "Profile, reminders, export and account.",
    icon: Sparkles,
    category: "momentum",
    bgColor:
      "bg-gradient-to-br from-violet-500 via-indigo-700 to-zinc-950 border border-violet-400/40",
    defaultSize: { width: 780, height: 700 },
    component: pick(() => import("./momentum/MomentumSettingsApp"), "MomentumSettingsApp"),
  },

  /* ── System ────────────────────────────────────────────────────────── */
  {
    id: "system_settings",
    name: "System Settings",
    description: "Desktop themes, wallpaper, sync and storage.",
    icon: Settings,
    category: "system",
    bgColor: "bg-gradient-to-br from-zinc-600 via-zinc-800 to-zinc-950 border border-zinc-500/40",
    defaultSize: { width: 900, height: 680 },
    defaultOnDesktop: true,
    component: pick(() => import("./native/SystemSettingsApp"), "SystemSettingsApp"),
  },
  {
    id: "pc_themes",
    name: "Theme Manager",
    description: "26 desktop eras, from Windows 95 to macOS Sonoma.",
    icon: Palette,
    category: "system",
    bgColor:
      "bg-gradient-to-br from-fuchsia-500 via-purple-700 to-zinc-950 border border-fuchsia-400/40",
    defaultSize: { width: 940, height: 700 },
    component: pick(() => import("@/pc/themes/components/PCThemeManagerApp"), "PCThemeManagerApp"),
  },
  {
    id: "task_manager",
    name: "Task Manager",
    description: "Open windows, memory and app health.",
    icon: Gauge,
    category: "system",
    bgColor: "bg-gradient-to-br from-red-500 via-rose-800 to-zinc-950 border border-red-400/40",
    defaultSize: { width: 760, height: 560 },
    component: pick(() => import("./native/TaskManagerApp"), "TaskManagerApp"),
  },
  {
    id: "app_store",
    name: "All Apps",
    description: "Browse the roster and pin apps to the desktop.",
    icon: Grid2X2,
    category: "system",
    bgColor: "bg-gradient-to-br from-sky-500 via-blue-800 to-zinc-950 border border-sky-400/40",
    defaultSize: { width: 900, height: 640 },
    defaultOnDesktop: true,
    component: pick(() => import("./native/AppBrowserApp"), "AppBrowserApp"),
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Drive the whole desktop from a command line.",
    icon: TerminalIcon,
    category: "system",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-zinc-900 to-black border border-emerald-500/40",
    defaultSize: { width: 820, height: 520 },
    defaultOnDesktop: true,
    component: pick(() => import("./native/TerminalApp"), "TerminalApp"),
  },

  /* ── Productivity ──────────────────────────────────────────────────── */
  {
    id: "notepad",
    name: "Notepad",
    description: "Write notes that sync to your account.",
    icon: FileText,
    category: "productivity",
    bgColor:
      "bg-gradient-to-br from-amber-400 via-amber-700 to-zinc-950 border border-amber-400/40",
    defaultSize: { width: 720, height: 560 },
    component: pick(() => import("./native/NotepadApp"), "NotepadApp"),
  },
  {
    id: "files",
    name: "Files",
    description: "Browse, search and organise your documents.",
    icon: FolderOpen,
    category: "productivity",
    bgColor:
      "bg-gradient-to-br from-yellow-500 via-orange-700 to-zinc-950 border border-yellow-400/40",
    defaultSize: { width: 860, height: 600 },
    component: pick(() => import("./native/FilesApp"), "FilesApp"),
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "Keyboard-driven calculator with a running tape.",
    icon: CalculatorIcon,
    category: "productivity",
    bgColor:
      "bg-gradient-to-br from-slate-500 via-slate-800 to-zinc-950 border border-slate-400/40",
    defaultSize: { width: 420, height: 620 },
    component: pick(() => import("./native/CalculatorApp"), "CalculatorApp"),
  },
  {
    id: "clock",
    name: "Clock",
    description: "World clocks, a stopwatch and a timer.",
    icon: ClockIcon,
    category: "productivity",
    bgColor: "bg-gradient-to-br from-cyan-500 via-blue-800 to-zinc-950 border border-cyan-400/40",
    defaultSize: { width: 560, height: 600 },
    component: pick(() => import("./native/ClockApp"), "ClockApp"),
  },
  {
    id: "slides",
    name: "Slides",
    description: "Present a quick deck.",
    icon: Presentation,
    category: "productivity",
    bgColor:
      "bg-gradient-to-br from-orange-500 via-red-800 to-zinc-950 border border-orange-400/40",
    defaultSize: { width: 900, height: 620 },
    component: pick(() => import("./ported/SlidesApp"), "SlidesApp"),
  },

  /* ── Games ─────────────────────────────────────────────────────────── */
  {
    id: "snake",
    name: "Snake",
    description: "The classic, ported straight across.",
    icon: Gamepad2,
    category: "games",
    bgColor: "bg-gradient-to-br from-lime-500 via-green-800 to-zinc-950 border border-lime-400/40",
    defaultSize: { width: 640, height: 640 },
    component: pick(() => import("./ported/SnakeGame"), "SnakeGame"),
  },
  {
    id: "minesweeper",
    name: "Minesweeper",
    description: "Three difficulties, real first-click protection.",
    icon: Target,
    category: "games",
    bgColor:
      "bg-gradient-to-br from-stone-500 via-stone-800 to-zinc-950 border border-stone-400/40",
    defaultSize: { width: 620, height: 660 },
    component: pick(() => import("./native/MinesweeperApp"), "MinesweeperApp"),
  },
  {
    id: "chess",
    name: "Iron Men Arcade",
    description: "Arcade cabinet ported from the PC.",
    icon: Swords,
    category: "games",
    bgColor:
      "bg-gradient-to-br from-indigo-500 via-purple-800 to-zinc-950 border border-indigo-400/40",
    defaultSize: { width: 820, height: 640 },
    component: pick(() => import("./ported/IronMenArcadeApp"), "IronMenArcadeApp"),
  },
  {
    id: "paint",
    name: "Laser Tag",
    description: "Ported arena game.",
    icon: Zap,
    category: "games",
    bgColor: "bg-gradient-to-br from-pink-500 via-rose-800 to-zinc-950 border border-pink-400/40",
    defaultSize: { width: 820, height: 640 },
    component: pick(() => import("./ported/LaserTagApp"), "LaserTagApp"),
  },

  /* ── AI / labs (ported from the PC) ────────────────────────────────── */
  {
    id: "model_router",
    name: "Model Router",
    description: "Route prompts across a hybrid model registry.",
    icon: Network,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-indigo-600 via-purple-700 to-zinc-950 border border-indigo-500/50",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/ModelRouterApp"), "ModelRouterApp"),
  },
  {
    id: "agent_builder",
    name: "Agent Builder",
    description: "Compose agents, tools and system prompts.",
    icon: Bot,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 1000, height: 720 },
    component: pick(() => import("./ported/AgentBuilderApp"), "AgentBuilderApp"),
  },
  {
    id: "ai_terminal",
    name: "Agent Orchestration",
    description: "Watch multi-agent runs unfold.",
    icon: Activity,
    category: "ai",
    bgColor: "bg-gradient-to-br from-teal-600 via-cyan-800 to-zinc-950 border border-teal-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(
      () => import("./ported/AgentOrchestrationDashboard"),
      "AgentOrchestrationDashboard",
    ),
  },
  {
    id: "consensus_lab",
    name: "Small Agent Fleet",
    description: "Coordinate a fleet of small specialists.",
    icon: Boxes,
    category: "ai",
    bgColor: "bg-gradient-to-br from-blue-600 via-indigo-800 to-zinc-950 border border-blue-500/40",
    defaultSize: { width: 960, height: 700 },
    component: pick(() => import("./ported/SmallAgentFleetApp"), "SmallAgentFleetApp"),
  },
  {
    id: "on_device_models",
    name: "LLM Environment",
    description: "Inspect and tune local model environments.",
    icon: Cpu,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 960, height: 700 },
    component: pick(() => import("./ported/LlmEnvironmentApp"), "LlmEnvironmentApp"),
  },
  {
    id: "prompt_library",
    name: "Ollama",
    description: "Local model runner console.",
    icon: Server,
    category: "ai",
    bgColor: "bg-gradient-to-br from-zinc-500 via-zinc-800 to-black border border-zinc-400/40",
    defaultSize: { width: 900, height: 680 },
    component: pick(() => import("./ported/OllamaApp"), "OllamaApp"),
  },
  {
    id: "knowledge_compressor",
    name: "Tool Registry",
    description: "Every callable tool, with schemas.",
    icon: Wrench,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 960, height: 700 },
    component: pick(() => import("./ported/ToolRegistryApp"), "ToolRegistryApp"),
  },

  /* ── Data / infrastructure (ported) ────────────────────────────────── */
  {
    id: "data_pods",
    name: "qpdb Matrix",
    description: "Quantised pod database explorer.",
    icon: Layers,
    category: "data",
    bgColor: "bg-gradient-to-br from-amber-600 via-rose-700 to-zinc-950 border border-amber-500/50",
    defaultSize: { width: 1000, height: 720 },
    component: pick(() => import("./ported/QpdbApp"), "QpdbApp"),
  },
  {
    id: "storage_stats",
    name: "Okse Sandbox",
    description: "Sandboxed data experiments.",
    icon: Binary,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-700 via-orange-800 to-zinc-950 border border-amber-500/30",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/OkseSandbox"), "OkseSandbox"),
  },
  {
    id: "archiver",
    name: "Cloud Infrastructure",
    description: "Provision and inspect cloud resources.",
    icon: Cloud,
    category: "data",
    bgColor: "bg-gradient-to-br from-blue-600 via-indigo-800 to-zinc-950 border border-blue-500/50",
    defaultSize: { width: 960, height: 700 },
    component: pick(() => import("./ported/CloudInfrastructureApp"), "CloudInfrastructureApp"),
  },
  {
    id: "audit_trail",
    name: "Cost Analytics",
    description: "Spend across providers and models.",
    icon: BarChart3,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-green-600 via-emerald-800 to-zinc-950 border border-green-500/40",
    defaultSize: { width: 940, height: 680 },
    component: pick(() => import("./ported/CostAnalyticsApp"), "CostAnalyticsApp"),
  },
  {
    id: "security_center",
    name: "Security Rulebook",
    description: "Cyber-security rulebook and vault.",
    icon: Shield,
    category: "data",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 1000, height: 740 },
    component: pick(() => import("./ported/CyberSecurityRulebookApp"), "CyberSecurityRulebookApp"),
  },
  {
    id: "api_keys",
    name: "API Keys",
    description: "Provider credentials, stored locally.",
    icon: Key,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-yellow-600 via-amber-800 to-zinc-950 border border-yellow-500/40",
    defaultSize: { width: 820, height: 620 },
    component: pick(() => import("./ported/APIKeysApp"), "APIKeysApp"),
  },
  {
    id: "secrets_vault",
    name: "Fleet Atlas",
    description: "Map of the deployed fleet.",
    icon: Database,
    category: "data",
    bgColor: "bg-gradient-to-br from-cyan-600 via-blue-900 to-zinc-950 border border-cyan-500/40",
    defaultSize: { width: 960, height: 700 },
    component: pick(() => import("./ported/FleetAtlasApp"), "FleetAtlasApp"),
  },

  /* ── Dev ───────────────────────────────────────────────────────────── */
  {
    id: "app_connector",
    name: "App Connector",
    description: "Wire external apps into the desktop.",
    icon: Package,
    category: "dev",
    bgColor:
      "bg-gradient-to-br from-indigo-600 via-indigo-900 to-zinc-950 border border-indigo-500/30",
    defaultSize: { width: 940, height: 700 },
    component: pick(() => import("./ported/AppConnectorApp"), "AppConnectorApp"),
  },
  {
    id: "code_editor",
    name: "Universal App Simulator",
    description: "Simulate an app before you build it.",
    icon: Monitor,
    category: "dev",
    bgColor: "bg-gradient-to-br from-slate-600 via-slate-900 to-black border border-slate-500/40",
    defaultSize: { width: 1000, height: 720 },
    component: pick(() => import("./ported/UniversalAppSimulator"), "UniversalAppSimulator"),
  },
  {
    id: "github_sync",
    name: "Global Deploy",
    description: "Ship the desktop to a region.",
    icon: Rocket,
    category: "dev",
    bgColor: "bg-gradient-to-br from-blue-600 via-indigo-800 to-zinc-950 border border-blue-500/50",
    defaultSize: { width: 920, height: 680 },
    component: pick(() => import("./ported/CloudDeployApp"), "CloudDeployApp"),
  },
  {
    id: "home",
    name: "Github",
    description: "Repository browser.",
    icon: Github,
    category: "dev",
    bgColor: "bg-gradient-to-br from-zinc-700 via-zinc-900 to-black border border-zinc-600/40",
    defaultSize: { width: 900, height: 660 },
    component: pick(() => import("./ported/AppConnectorApp"), "AppConnectorApp"),
  },
];

/* ── lookups ───────────────────────────────────────────────────────────── */

const byId = new Map<string, AppDefinition>(APPS.map((a) => [a.id, a]));

export function getApp(id: string | undefined): AppDefinition | undefined {
  return id ? byId.get(id) : undefined;
}

export function appsByCategory(category: AppCategory): AppDefinition[] {
  return APPS.filter((a) => a.category === category);
}

export const CATEGORY_LABELS: Record<AppCategory, string> = {
  momentum: "Momentum",
  system: "System",
  productivity: "Productivity",
  games: "Games",
  ai: "AI & Agents",
  data: "Data & Security",
  dev: "Developer",
};

/** Category display order, used by the Start menu and App Browser. */
export const CATEGORY_ORDER: AppCategory[] = [
  "momentum",
  "system",
  "productivity",
  "ai",
  "data",
  "dev",
  "games",
];

/** The desktop a brand-new user lands on. */
export function defaultDesktopAppIds(): string[] {
  return APPS.filter((a) => a.defaultOnDesktop).map((a) => a.id);
}
