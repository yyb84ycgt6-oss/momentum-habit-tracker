/**
 * PC Bus — typed pub/sub event bus.
 *
 * Ported from Jackie's PC. Formalizes the ad-hoc
 * `window.dispatchEvent(new CustomEvent(...))` pattern into one typed
 * channel registry. It stays a thin layer over `window` CustomEvents, so
 * raw dispatchers and raw listeners keep interoperating with subscribers.
 *
 * SSR: TanStack Start renders the root on the server, so every entry point
 * here no-ops when `window` is absent rather than throwing.
 */
import type { AppId } from "../types";

/**
 * The catalog of known channels and the shape of their payloads.
 * Add new channels here so every producer/consumer stays type-checked.
 */
export interface BusChannels {
  /** Open an app anywhere in the OS. */
  "launch-app": { appId: AppId | string };
  /** Ask the desktop to re-read its item list (after adding/removing apps). */
  "refresh-desktop": void;
  /** Open the ⌘K/Ctrl-K app search. */
  "open-command-palette": void;
  /** Hardware/gesture "back" request. */
  "global-back-request": void;
  /** A user-facing notification for the Activity Center. */
  "pc-notification": {
    level: "info" | "success" | "warning" | "error";
    title: string;
    message?: string;
    source?: string;
  };
  /** Cloud-sync lifecycle updates from `lib/sync.ts`. */
  "cloud-sync-status": { status: "idle" | "syncing" | "error"; message?: string };
  /** A habit was logged or unlogged — lets any app react to real progress. */
  "habit-logged": { habitId: string; date: string; logged: boolean };
  /** Habit data changed shape (created/edited/archived/deleted). */
  "habits-changed": void;
  /** An app reported a fatal error (caught by the window error boundary). */
  "app-error": { appId: string; error: unknown; timestamp: number };
  /** Shut the desktop down / lock the session. */
  "shut-down": void;
}

export type BusChannel = keyof BusChannels;

type Handler<K extends BusChannel> = (payload: BusChannels[K]) => void;

/**
 * Emit an event on a channel. Delivers to bus subscribers AND any raw
 * `window.addEventListener(channel, ...)` listeners.
 */
export function emit<K extends BusChannel>(
  channel: K,
  ...args: BusChannels[K] extends void ? [] : [BusChannels[K]]
): void {
  if (typeof window === "undefined") return;
  const detail = (args.length > 0 ? args[0] : undefined) as BusChannels[K];
  window.dispatchEvent(new CustomEvent(channel, { detail }));
}

/**
 * Subscribe to a channel. Returns an unsubscribe function.
 * Also catches raw CustomEvents dispatched with the same name.
 */
export function on<K extends BusChannel>(channel: K, handler: Handler<K>): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    handler((event as CustomEvent).detail as BusChannels[K]);
  };
  window.addEventListener(channel, listener);
  return () => window.removeEventListener(channel, listener);
}

/** Subscribe to a channel for a single emission, then auto-unsubscribe. */
export function once<K extends BusChannel>(channel: K, handler: Handler<K>): () => void {
  const off = on(channel, (payload) => {
    off();
    handler(payload);
  });
  return off;
}

/** Convenience wrapper for the notification channel. */
export function notify(
  level: BusChannels["pc-notification"]["level"],
  title: string,
  message?: string,
  source?: string,
): void {
  emit("pc-notification", { level, title, message, source });
}

/** Namespaced surface for ergonomic imports: `import { bus } from "./bus"`. */
export const bus = { emit, on, once, notify };
export default bus;
