/**
 * PC — core type contract.
 *
 * Ported from Jackie's PC (`types.ts`) and extended for the Momentum host:
 * the desktop now carries first-class habit apps, so `AppId` gains the
 * `momentum_*` roster and `DesktopItem` gains nothing — a habit app is an
 * app like any other, which is the whole point of the integration.
 */
import type { LucideIcon } from "lucide-react";
import type { GeneratedAppSpec } from "./generative/appSpec";

/**
 * Every app the desktop can dispatch. Kept as a union rather than `string`
 * so a typo in a desktop item or a Start-menu entry fails at build time
 * instead of opening a blank window.
 */
export type AppId =
  // — Momentum: the habit tracker, rebuilt as desktop apps —
  | "momentum_today"
  | "momentum_habits"
  | "momentum_progress"
  | "momentum_settings"
  // — Core desktop —
  | "home"
  | "folder"
  | "notepad"
  | "terminal"
  | "files"
  | "system_settings"
  | "pc_themes"
  | "task_manager"
  | "app_store"
  // — Productivity —
  | "mail"
  | "slides"
  | "calculator"
  | "clock"
  | "paint"
  | "media_player"
  // — Games —
  | "snake"
  | "minesweeper"
  | "chess"
  // — AI / labs —
  | "ai_terminal"
  | "model_router"
  | "agent_builder"
  | "prompt_library"
  | "knowledge_compressor"
  | "consensus_lab"
  | "on_device_models"
  // — Data / security —
  | "data_pods"
  | "secrets_vault"
  | "archiver"
  | "api_keys"
  | "security_center"
  | "audit_trail"
  | "storage_stats"
  // — Dev —
  | "github_sync"
  | "code_editor"
  | "app_connector"
  | "generated";

export interface DesktopItem {
  id: string;
  name: string;
  type: "app" | "folder";
  icon: LucideIcon;
  appId?: AppId | string;
  contents?: DesktopItem[];
  bgColor?: string;
  notepadInitialContent?: string;
  url?: string;
  iconName?: string;
  featured?: boolean;
  /** Present for an app the desktop generated from a plain-language
   *  description (`src/pc/generative/`) — the portable definition a
   *  GeneratedAppRunner renders. Absent for every other item type. */
  generatedSpec?: GeneratedAppSpec;
}

export interface Point {
  x: number;
  y: number;
}

export type Stroke = Point[];

export interface Email {
  id: number;
  from: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread: boolean;
}

export type ToolAction =
  | { type: "DELETE_ITEM"; itemId: string }
  | { type: "EXPLODE_FOLDER"; folderId: string }
  | { type: "EXPLAIN_ITEM"; itemId: string }
  | { type: "NONE" };

/** A window the desktop currently has open. */
export interface OpenWindow {
  id: string;
  item: DesktopItem;
  itemId: string;
  zIndex: number;
  pos: { x: number; y: number };
  size?: { width: number; height: number };
  /** Hidden from the desktop but still open — restored from the taskbar,
   *  the way a real PC does it. */
  minimized?: boolean;
}
