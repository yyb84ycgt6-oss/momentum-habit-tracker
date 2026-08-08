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
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Binary,
  BookOpen,
  Bot,
  Box,
  Boxes,
  Braces,
  Brain,
  Calculator as CalculatorIcon,
  ChefHat,
  ClipboardList,
  Clock as ClockIcon,
  Cloud,
  Code2,
  Compass,
  Copy,
  Cpu,
  Database,
  Dna,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  Flame,
  FlaskConical,
  FolderOpen,
  Gamepad2,
  Gauge,
  Github,
  Grid2X2,
  HardDrive,
  History,
  Key,
  Layers,
  Radar,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  Link2,
  ListChecks,
  Lock,
  Mail,
  MessageSquare,
  Mic,
  Monitor,
  Network,
  Package,
  Palette,
  PieChart,
  Presentation,
  Rabbit,
  Radio,
  Rocket,
  Search,
  Server,
  Settings,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sliders,
  Sparkles,
  Trophy,
  Swords,
  Target,
  Terminal as TerminalIcon,
  TerminalSquare,
  Users,
  Video,
  Wand2,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppId } from "../types";

/** Grouping used by the Start menu and the App Browser. */
export type AppCategory =
  | "momentum"
  | "system"
  | "productivity"
  | "ai"
  | "research"
  | "data"
  | "security"
  | "ops"
  | "dev"
  | "games";

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
  component: PreloadableLazy;
}

/** Narrows a module with any export shape down to what `lazy` expects. */
type AnyComponent = ComponentType<Record<string, never>>;

/**
 * A lazy app that can also be fetched ahead of time.
 *
 * `React.lazy` swallows its loader, so nothing outside can warm an app's
 * chunk before the user clicks. Keeping a reference to it lets the Understudy
 * prefetch the app it expects next — the chunk is already in memory when the
 * click lands, instead of a spinner.
 */
export type PreloadableLazy = LazyExoticComponent<AnyComponent> & {
  preload: () => Promise<unknown>;
};

function pick(loader: () => Promise<Record<string, unknown>>, exportName: string): PreloadableLazy {
  const resolve = async () => {
    const mod = await loader();
    const found = (mod[exportName] ?? mod.default) as AnyComponent | undefined;
    if (!found) throw new Error(`App module has no "${exportName}" or default export`);
    return { default: found };
  };
  const C = lazy(resolve) as PreloadableLazy;
  let started: Promise<unknown> | null = null;
  // Memoized: a repeated prefetch must not re-issue the network request.
  C.preload = () => (started ??= resolve().catch(() => undefined));
  return C;
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

  /* ── Data / infrastructure (ported) ────────────────────────────────── */

  /* ── Dev ───────────────────────────────────────────────────────────── */

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

  /* ── The PC roster, ported from Jackie's PC ──────────────────────── */
  {
    id: "model_router",
    name: "Model Router",
    description: "Route prompts across a hybrid model registry.",
    icon: Network,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
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
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/AgentBuilderApp"), "AgentBuilderApp"),
  },
  {
    id: "agent_orchestration",
    name: "Agent Orchestration",
    description: "Watch multi-agent runs unfold.",
    icon: Activity,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(
      () => import("./ported/AgentOrchestrationDashboard"),
      "AgentOrchestrationDashboard",
    ),
  },
  {
    id: "agent_team_console",
    name: "Agent Team Console",
    description: "Run a team of agents against one goal.",
    icon: Users,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/AgentTeamConsoleApp"), "AgentTeamConsoleApp"),
  },
  {
    id: "small_agent_fleet",
    name: "Small Agent Fleet",
    description: "Coordinate a fleet of small specialists.",
    icon: Boxes,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/SmallAgentFleetApp"), "SmallAgentFleetApp"),
  },
  {
    id: "consensus_lab",
    name: "Consensus Lab",
    description: "Multi-agent voting and consensus experiments.",
    icon: Network,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/MultiAgentConsensusLab"), "MultiAgentConsensusLab"),
  },
  {
    id: "cross_ai_lab",
    name: "Cross-AI Lab",
    description: "Compare answers across providers side by side.",
    icon: FlaskConical,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/CrossAiLabApp"), "CrossAiLabApp"),
  },
  {
    id: "llm_environment",
    name: "LLM Environment",
    description: "Inspect and tune local model environments.",
    icon: Cpu,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/LlmEnvironmentApp"), "LlmEnvironmentApp"),
  },
  {
    id: "on_device_models",
    name: "On-Device Models",
    description: "Local models, quantisation and memory budget.",
    icon: HardDrive,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/OnDeviceModelsApp"), "OnDeviceModelsApp"),
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Local model runner console.",
    icon: Server,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/OllamaApp"), "OllamaApp"),
  },
  {
    id: "ai_terminal",
    name: "AI Terminal",
    description: "A terminal that answers in natural language.",
    icon: TerminalSquare,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/AiTermApp"), "AiTermApp"),
  },
  {
    id: "claude_assistant",
    name: "Claude Assistant",
    description: "Chat with Claude inside the desktop.",
    icon: Sparkles,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/ClaudeAssistantApp"), "ClaudeAssistantApp"),
  },
  {
    id: "codex",
    name: "Codex",
    description: "Code generation workspace.",
    icon: Code2,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/CodexApp"), "CodexApp"),
  },
  {
    id: "grok_terminal",
    name: "Grok Terminal",
    description: "Grok-flavoured terminal chat.",
    icon: Zap,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/GrokTerminalApp"), "GrokTerminalApp"),
  },
  {
    id: "jacky_v3",
    name: "Jacky V3",
    description: "The Jacky assistant, third generation.",
    icon: Brain,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/JackyV3App"), "JackyV3App"),
  },
  {
    id: "jackie_chat",
    name: "Jackie Chat",
    description: "Talk to Jackie, the desktop's operator.",
    icon: MessageSquare,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/JackieChatApp"), "JackieChatApp"),
  },
  {
    id: "cybernetic67",
    name: "Cybernetic67",
    description: "Offline-first terminal with persona engines.",
    icon: Binary,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/Cybernetic67App"), "Cybernetic67App"),
  },
  {
    id: "supersayen",
    name: "SuperSayen",
    description: "Long-form reasoning workbench.",
    icon: Flame,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/SuperSayenApp"), "SuperSayenApp"),
  },
  {
    id: "fusion",
    name: "Fusion",
    description: "Fuse several models into one answer.",
    icon: Cpu,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/FusionApp"), "FusionApp"),
  },
  {
    id: "agentic_vision",
    name: "Agentic Vision",
    description: "Vision-driven agent experiments.",
    icon: Eye,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/AgenticVisionApp"), "AgenticVisionApp"),
  },
  {
    id: "function_call_kitchen",
    name: "Function Call Kitchen",
    description: "Design and test tool-calling schemas.",
    icon: ChefHat,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/FunctionCallKitchenApp"), "FunctionCallKitchenApp"),
  },
  {
    id: "prompt_to_json",
    name: "Prompt to JSON",
    description: "Turn prose into structured JSON.",
    icon: Braces,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/PromptToJsonApp"), "PromptToJsonApp"),
  },
  {
    id: "prompt_library",
    name: "Prompt Library",
    description: "Save, tag and reuse prompts.",
    icon: BookOpen,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/PromptLibraryApp"), "PromptLibraryApp"),
  },
  {
    id: "tool_registry",
    name: "Tool Registry",
    description: "Every callable tool, with schemas.",
    icon: Wrench,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/ToolRegistryApp"), "ToolRegistryApp"),
  },
  {
    id: "ai_data_resolver",
    name: "AI Data Resolver",
    description: "Resolve messy data with model help.",
    icon: Database,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/AiDataResolverApp"), "AiDataResolverApp"),
  },
  {
    id: "langchain",
    name: "LangChain",
    description: "Chain builder and runner.",
    icon: Link2,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/LangChainApp"), "LangChainApp"),
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    description: "Autonomous browsing agent.",
    icon: Bot,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/OpenClawApp"), "OpenClawApp"),
  },
  {
    id: "bot_studio",
    name: "Bot Studio",
    description: "Build offline bots and memory pods.",
    icon: Bot,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/BotStudioApp"), "BotStudioApp"),
  },
  {
    id: "knowledge_compressor",
    name: "Knowledge Compressor",
    description: "Compress a corpus into a portable pod.",
    icon: Layers,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/KnowledgeCompressorApp"), "KnowledgeCompressorApp"),
  },
  {
    id: "knowledge",
    name: "Knowledge",
    description: "Offline knowledge base and search.",
    icon: BookOpen,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/KnowledgeApp"), "KnowledgeApp"),
  },
  {
    id: "memory_fabric",
    name: "Memory Fabric",
    description: "Long-term memory across apps.",
    icon: Brain,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/MemoryFabricApp"), "MemoryFabricApp"),
  },
  {
    id: "eru",
    name: "Eru",
    description: "The Eru vault and reasoning surface.",
    icon: Sparkles,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-indigo-800 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/EruApp"), "EruApp"),
  },
  {
    id: "research_rabbit",
    name: "ResearchRabbit",
    description: "Map papers and citation graphs.",
    icon: Rabbit,
    category: "research",
    bgColor: "bg-gradient-to-br from-sky-500 via-blue-800 to-zinc-950 border border-sky-400/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/ResearchRabbitApp"), "ResearchRabbitApp"),
  },
  {
    id: "semantic_scholar",
    name: "Semantic Scholar",
    description: "Search the literature.",
    icon: Search,
    category: "research",
    bgColor: "bg-gradient-to-br from-sky-500 via-blue-800 to-zinc-950 border border-sky-400/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/SemanticScholarApp"), "SemanticScholarApp"),
  },
  {
    id: "papers_with_code",
    name: "Papers with Code",
    description: "Papers, benchmarks and implementations.",
    icon: Code2,
    category: "research",
    bgColor: "bg-gradient-to-br from-sky-500 via-blue-800 to-zinc-950 border border-sky-400/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/PapersWithCodeApp"), "PapersWithCodeApp"),
  },
  {
    id: "coderabbit",
    name: "CodeRabbit",
    description: "Automated code review.",
    icon: Rabbit,
    category: "research",
    bgColor: "bg-gradient-to-br from-sky-500 via-blue-800 to-zinc-950 border border-sky-400/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/CodeRabbitApp"), "CodeRabbitApp"),
  },
  {
    id: "qpdb",
    name: "qpdb Matrix",
    description: "Quantised pod database explorer.",
    icon: Layers,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/QpdbApp"), "QpdbApp"),
  },
  {
    id: "data_pods",
    name: "Data Pods",
    description: "Compressed, portable data pods.",
    icon: Boxes,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/DataPodsApp"), "DataPodsApp"),
  },
  {
    id: "pod_system",
    name: "Pod System",
    description: "The SAS pod runtime and conductor.",
    icon: Grid2X2,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/PodSystemApp"), "PodSystemApp"),
  },
  {
    id: "okse_sandbox",
    name: "Okse Sandbox",
    description: "Sandboxed data experiments.",
    icon: Binary,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/OkseSandbox"), "OkseSandbox"),
  },
  {
    id: "archiver",
    name: "Archiver",
    description: "Archive screens and state to the cloud.",
    icon: Archive,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/ArchiverApp"), "ArchiverApp"),
  },
  {
    id: "data_vault",
    name: "Data Vault",
    description: "Encrypted local document vault.",
    icon: Lock,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/DataVaultApp"), "DataVaultApp"),
  },
  {
    id: "build_vault",
    name: "Build Vault",
    description: "Store and replay build artifacts.",
    icon: Package,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/BuildVaultApp"), "BuildVaultApp"),
  },
  {
    id: "storage_stats",
    name: "Storage Stats",
    description: "Where your storage is actually going.",
    icon: PieChart,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/StorageStatsApp"), "StorageStatsApp"),
  },
  {
    id: "time_machine",
    name: "Time Machine",
    description: "Snapshot and restore desktop state.",
    icon: History,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/TimeMachineApp"), "TimeMachineApp"),
  },
  {
    id: "workspace_manager",
    name: "Workspaces",
    description: "Save and restore window layouts.",
    icon: LayoutGrid,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/WorkspaceManagerApp"), "WorkspaceManagerApp"),
  },
  {
    id: "cybernetic_export",
    name: "Cybernetic Export",
    description: "Export the OS as a portable bundle.",
    icon: Share2,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/CyberneticExportApp"), "CyberneticExportApp"),
  },
  {
    id: "chat_history_share",
    name: "Chat History",
    description: "Export and share conversations.",
    icon: MessageSquare,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/ChatHistoryShareApp"), "ChatHistoryShareApp"),
  },
  {
    id: "clipboard_manager",
    name: "Clipboard",
    description: "Clipboard history across apps.",
    icon: Copy,
    category: "data",
    bgColor:
      "bg-gradient-to-br from-amber-600 via-orange-800 to-zinc-950 border border-amber-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/ClipboardManagerApp"), "ClipboardManagerApp"),
  },
  {
    id: "security_center",
    name: "Security Center",
    description: "Posture, alerts and controls in one place.",
    icon: Shield,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/SecurityCenterApp"), "SecurityCenterApp"),
  },
  {
    id: "security_rulebook",
    name: "Security Rulebook",
    description: "Cyber-security rulebook and playbooks.",
    icon: ShieldCheck,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/CyberSecurityRulebookApp"), "CyberSecurityRulebookApp"),
  },
  {
    id: "secrets_vault",
    name: "Secrets Vault",
    description: "Encrypted secrets, unlocked by passphrase.",
    icon: Key,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/SecretsVaultApp"), "SecretsVaultApp"),
  },
  {
    id: "secrets_hygiene",
    name: "Secrets Hygiene",
    description: "Find secrets that should not be there.",
    icon: ShieldAlert,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/SecretsHygieneApp"), "SecretsHygieneApp"),
  },
  {
    id: "api_keys",
    name: "API Keys",
    description: "Provider credentials, stored locally.",
    icon: Key,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/APIKeysApp"), "APIKeysApp"),
  },
  {
    id: "permission_broker",
    name: "Permissions",
    description: "Grant and revoke app capabilities.",
    icon: Lock,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/PermissionBrokerApp"), "PermissionBrokerApp"),
  },
  {
    id: "self_audit",
    name: "Self Audit",
    description: "Scan the desktop's own posture.",
    icon: Search,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/SelfAuditScannerApp"), "SelfAuditScannerApp"),
  },
  {
    id: "dependency_cve",
    name: "CVE Checker",
    description: "Check dependencies against advisories.",
    icon: AlertTriangle,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/DependencyCVECheckerApp"), "DependencyCVECheckerApp"),
  },
  {
    id: "data_redaction",
    name: "Redaction",
    description: "Strip sensitive fields before sharing.",
    icon: EyeOff,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/DataRedactionApp"), "DataRedactionApp"),
  },
  {
    id: "integrity_monitor",
    name: "Integrity Monitor",
    description: "Detect tampering in stored state.",
    icon: ShieldCheck,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/IntegrityMonitorApp"), "IntegrityMonitorApp"),
  },
  {
    id: "audit_trail",
    name: "Audit Trail",
    description: "An append-only log of what happened.",
    icon: ClipboardList,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/AuditTrailApp"), "AuditTrailApp"),
  },
  {
    id: "security_event_log",
    name: "Security Events",
    description: "Security-relevant events over time.",
    icon: AlertTriangle,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/SecurityEventLogApp"), "SecurityEventLogApp"),
  },
  {
    id: "anomaly_alert",
    name: "Anomaly Alerts",
    description: "Flag behaviour that breaks the pattern.",
    icon: Siren,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/AnomalyAlertApp"), "AnomalyAlertApp"),
  },
  {
    id: "session_recorder",
    name: "Session Recorder",
    description: "Record and replay a desktop session.",
    icon: Video,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/SessionRecorderApp"), "SessionRecorderApp"),
  },
  {
    id: "bypass",
    name: "Bypass",
    description: "The event bus, made visible.",
    icon: Radio,
    category: "security",
    bgColor: "bg-gradient-to-br from-red-600 via-rose-900 to-zinc-950 border border-red-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/BypassApp"), "BypassApp"),
  },
  {
    id: "mission_control",
    name: "Mission Control",
    description: "One screen for the whole system.",
    icon: Gauge,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/MissionControlApp"), "MissionControlApp"),
  },
  {
    id: "fleet",
    name: "Fleet",
    description: "The specialist fleet and its brains.",
    icon: Boxes,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/FleetApp"), "FleetApp"),
  },
  {
    id: "fleet_atlas",
    name: "Fleet Atlas",
    description: "Map of the deployed fleet.",
    icon: Compass,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/FleetAtlasApp"), "default"),
  },
  {
    id: "cloud_infrastructure",
    name: "Cloud Infrastructure",
    description: "Provision and inspect cloud resources.",
    icon: Cloud,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/CloudInfrastructureApp"), "CloudInfrastructureApp"),
  },
  {
    id: "cloud_deploy",
    name: "Global Deploy",
    description: "Ship the desktop to a region.",
    icon: Rocket,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/CloudDeployApp"), "CloudDeployApp"),
  },
  {
    id: "cost_analytics",
    name: "Cost Analytics",
    description: "Spend across providers and models.",
    icon: BarChart3,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/CostAnalyticsApp"), "CostAnalyticsApp"),
  },
  {
    id: "budget_guardian",
    name: "Budget Guardian",
    description: "Stop a run before it costs too much.",
    icon: DollarSign,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/BudgetGuardianApp"), "BudgetGuardianApp"),
  },
  {
    id: "app_health",
    name: "App Health",
    description: "Which apps are failing, and why.",
    icon: Activity,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/AppHealthMonitorApp"), "AppHealthMonitorApp"),
  },
  {
    id: "activity_center",
    name: "Activity Center",
    description: "Everything the system has been doing.",
    icon: Bell,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/ActivityCenterApp"), "ActivityCenterApp"),
  },
  {
    id: "notification_center",
    name: "Notifications",
    description: "Alerts from every app in one list.",
    icon: Bell,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/NotificationCenterApp"), "NotificationCenterApp"),
  },
  {
    id: "automation",
    name: "Automation",
    description: "When this happens, do that.",
    icon: Zap,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/AutomationApp"), "AutomationApp"),
  },
  {
    id: "voice_commands",
    name: "Voice Commands",
    description: "Drive the desktop by speaking.",
    icon: Mic,
    category: "ops",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-800 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/VoiceCommandsApp"), "VoiceCommandsApp"),
  },
  {
    id: "app_connector",
    name: "App Connector",
    description: "Wire external apps into the desktop.",
    icon: Package,
    category: "dev",
    bgColor: "bg-gradient-to-br from-slate-600 via-slate-900 to-black border border-slate-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/AppConnectorApp"), "AppConnectorApp"),
  },
  {
    id: "app_simulator",
    name: "App Simulator",
    description: "Simulate an app before you build it.",
    icon: Monitor,
    category: "dev",
    bgColor: "bg-gradient-to-br from-slate-600 via-slate-900 to-black border border-slate-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/UniversalAppSimulator"), "UniversalAppSimulator"),
  },
  {
    id: "github_sync",
    name: "GitHub Sync",
    description: "Read and sync a repository offline.",
    icon: Github,
    category: "dev",
    bgColor: "bg-gradient-to-br from-slate-600 via-slate-900 to-black border border-slate-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/GitHubSyncApp"), "GitHubSyncApp"),
  },
  {
    id: "term_studio",
    name: "TermStudio",
    description: "A terminal, editor and canvas in one.",
    icon: TerminalSquare,
    category: "dev",
    bgColor: "bg-gradient-to-br from-slate-600 via-slate-900 to-black border border-slate-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/TermStudioApp"), "TermStudioApp"),
  },
  {
    id: "flash_ui",
    name: "Flash UI",
    description: "Generate an interface from a sentence.",
    icon: Wand2,
    category: "dev",
    bgColor: "bg-gradient-to-br from-slate-600 via-slate-900 to-black border border-slate-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/FlashUiApp"), "FlashUiApp"),
  },
  {
    id: "flipper_zero",
    name: "Flipper Zero",
    description: "Bridge and flash a Flipper over WebUSB.",
    icon: Radio,
    category: "dev",
    bgColor: "bg-gradient-to-br from-slate-600 via-slate-900 to-black border border-slate-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/FlipperZeroApp"), "FlipperZeroApp"),
  },
  {
    id: "unreal_engine",
    name: "Unreal Engine",
    description: "Unreal project companion.",
    icon: Box,
    category: "dev",
    bgColor: "bg-gradient-to-br from-slate-600 via-slate-900 to-black border border-slate-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/UnrealEngineApp"), "UnrealEngineApp"),
  },
  {
    id: "blender",
    name: "Blender",
    description: "Blender project companion.",
    icon: Box,
    category: "dev",
    bgColor: "bg-gradient-to-br from-slate-600 via-slate-900 to-black border border-slate-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/BlenderApp"), "BlenderApp"),
  },
  {
    id: "pc_control_panel",
    name: "PC Control Panel",
    description: "The PC's original settings surface.",
    icon: Sliders,
    category: "dev",
    bgColor: "bg-gradient-to-br from-slate-600 via-slate-900 to-black border border-slate-500/40",
    defaultSize: { width: 980, height: 700 },
    component: pick(() => import("./ported/SystemSettingsApp"), "SystemSettingsApp"),
  },
  {
    id: "chess",
    name: "Zenith Chess",
    description: "Real chess, with an engine.",
    icon: Swords,
    category: "games",
    bgColor:
      "bg-gradient-to-br from-pink-500 via-fuchsia-800 to-zinc-950 border border-pink-400/40",
    defaultSize: { width: 760, height: 660 },
    component: pick(() => import("./ported/ZenithChessApp"), "ZenithChessApp"),
  },
  {
    id: "iron_men",
    name: "Iron Men Arcade",
    description: "Arcade cabinet ported from the PC.",
    icon: Gamepad2,
    category: "games",
    bgColor:
      "bg-gradient-to-br from-pink-500 via-fuchsia-800 to-zinc-950 border border-pink-400/40",
    defaultSize: { width: 760, height: 660 },
    component: pick(() => import("./ported/IronMenArcadeApp"), "IronMenArcadeApp"),
  },
  {
    id: "laser_tag",
    name: "Laser Tag",
    description: "Ported arena game.",
    icon: Zap,
    category: "games",
    bgColor:
      "bg-gradient-to-br from-pink-500 via-fuchsia-800 to-zinc-950 border border-pink-400/40",
    defaultSize: { width: 760, height: 660 },
    component: pick(() => import("./ported/LaserTagApp"), "LaserTagApp"),
  },
  {
    id: "mail",
    name: "Mail",
    description: "Inbox with ink-gesture actions.",
    icon: Mail,
    category: "productivity",
    bgColor: "bg-gradient-to-br from-cyan-500 via-blue-800 to-zinc-950 border border-cyan-400/40",
    defaultSize: { width: 860, height: 620 },
    component: pick(() => import("./ported/MailApp"), "MailApp"),
  },
  {
    id: "slides",
    name: "Slides",
    description: "Present a quick deck.",
    icon: Presentation,
    category: "productivity",
    bgColor: "bg-gradient-to-br from-cyan-500 via-blue-800 to-zinc-950 border border-cyan-400/40",
    defaultSize: { width: 860, height: 620 },
    component: pick(() => import("./ported/SlidesApp"), "SlidesApp"),
  },
  /* ── The ten: three shared foundations, ten surfaces ──────────────────
     Six of them read the same call telemetry and three read the same bus
     capture, so the substrate is shared rather than rebuilt ten times. */
  {
    id: "ai_providers",
    name: "AI Providers",
    description: "Every provider and model the gateway can reach, live.",
    icon: Boxes,
    category: "ai",
    bgColor: "bg-gradient-to-br from-cyan-600 via-blue-900 to-zinc-950 border border-cyan-500/40",
    defaultSize: { width: 900, height: 700 },
    component: pick(() => import("./ported/AiProvidersApp"), "AiProvidersApp"),
  },
  {
    id: "budget_radar",
    name: "Budget Radar",
    description: "Spend and quota, per provider and per key.",
    icon: Radar,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-emerald-600 via-teal-900 to-zinc-950 border border-emerald-500/40",
    defaultSize: { width: 720, height: 680 },
    component: pick(() => import("./ported/BudgetRadarApp"), "BudgetRadarApp"),
  },
  {
    id: "colosseum",
    name: "Colosseum",
    description: "Many models, one prompt, judged blind.",
    icon: Trophy,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-amber-500 via-orange-900 to-zinc-950 border border-amber-400/40",
    defaultSize: { width: 900, height: 700 },
    component: pick(() => import("./ported/ColosseumApp"), "ColosseumApp"),
  },
  {
    id: "ambient_agents",
    name: "Ambient Agents",
    description: "Agents that run on a schedule, not on a click.",
    icon: Bot,
    category: "ai",
    bgColor: "bg-gradient-to-br from-sky-600 via-blue-900 to-zinc-950 border border-sky-500/40",
    defaultSize: { width: 760, height: 700 },
    component: pick(() => import("./ported/AmbientAgentsApp"), "AmbientAgentsApp"),
  },
  {
    id: "bus_recorder",
    name: "Bus Recorder",
    description: "Record, inspect and replay what the desktop did.",
    icon: Activity,
    category: "ops",
    bgColor: "bg-gradient-to-br from-rose-600 via-red-900 to-zinc-950 border border-rose-500/40",
    defaultSize: { width: 820, height: 680 },
    component: pick(() => import("./ported/BusRecorderApp"), "BusRecorderApp"),
  },
  {
    id: "choreography",
    name: "Choreography",
    description: "Named scenes that open a set of apps together.",
    icon: Grid2X2,
    category: "productivity",
    bgColor:
      "bg-gradient-to-br from-violet-600 via-purple-900 to-zinc-950 border border-violet-500/40",
    defaultSize: { width: 700, height: 660 },
    component: pick(() => import("./ported/ChoreographyApp"), "ChoreographyApp"),
  },
  {
    id: "speed_racer",
    name: "Speed Racer",
    description: "Measured provider latency, not advertised latency.",
    icon: Gauge,
    category: "ai",
    bgColor: "bg-gradient-to-br from-lime-500 via-green-900 to-zinc-950 border border-lime-500/40",
    defaultSize: { width: 800, height: 680 },
    component: pick(() => import("./ported/SpeedRacerApp"), "SpeedRacerApp"),
  },
  {
    id: "cartographer",
    name: "Cartographer",
    description: "The map of what actually talks to what.",
    icon: Compass,
    category: "ops",
    bgColor: "bg-gradient-to-br from-teal-500 via-cyan-900 to-zinc-950 border border-teal-400/40",
    defaultSize: { width: 860, height: 680 },
    component: pick(() => import("./ported/CartographerApp"), "CartographerApp"),
  },
  {
    id: "prompt_genome",
    name: "Prompt Genome",
    description: "Version control for prompts, with head-to-head evidence.",
    icon: Dna,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-fuchsia-600 via-pink-900 to-zinc-950 border border-fuchsia-500/40",
    defaultSize: { width: 900, height: 700 },
    component: pick(() => import("./ported/PromptGenomeApp"), "PromptGenomeApp"),
  },
  {
    id: "cortex",
    name: "Offline Cortex",
    description: "Answers kept, so the machine still speaks with no network.",
    icon: Brain,
    category: "ai",
    bgColor:
      "bg-gradient-to-br from-purple-600 via-fuchsia-900 to-zinc-950 border border-purple-500/40",
    defaultSize: { width: 760, height: 720 },
    component: pick(() => import("./ported/CortexApp"), "CortexApp"),
  },
  {
    id: "understudy",
    name: "The Understudy",
    description: "Learns which app follows which, and warms the next one.",
    icon: Sparkles,
    category: "system",
    bgColor:
      "bg-gradient-to-br from-indigo-500 via-violet-900 to-zinc-950 border border-indigo-400/40",
    defaultSize: { width: 720, height: 720 },
    component: pick(() => import("./ported/UnderstudyApp"), "UnderstudyApp"),
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
  ai: "AI & Agents",
  research: "Research",
  data: "Data & Storage",
  security: "Security",
  ops: "Ops & Infrastructure",
  dev: "Developer",
  games: "Games",
};

/** Category display order, used by the Start menu and App Browser. */
export const CATEGORY_ORDER: AppCategory[] = [
  "momentum",
  "system",
  "productivity",
  "ai",
  "research",
  "data",
  "security",
  "ops",
  "dev",
  "games",
];

/** The desktop a brand-new user lands on. */
export function defaultDesktopAppIds(): string[] {
  return APPS.filter((a) => a.defaultOnDesktop).map((a) => a.id);
}
