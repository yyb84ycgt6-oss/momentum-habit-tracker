/**
 * Desktop sync — the local shell state, mirrored to Postgres.
 *
 * Jackie's PC persisted the desktop to localStorage alone, which makes the
 * layout a property of the browser profile rather than of the user. Here
 * localStorage stays the read path (instant, works offline, survives a
 * failed network) and Supabase becomes the durable copy, so the same
 * desktop follows the account to another device.
 *
 * The rules that keep this honest:
 *   • Reads are local-first. A cold load hydrates from localStorage
 *     immediately, then reconciles with the server when it answers, so the
 *     desktop never blocks on the network.
 *   • Writes are debounced and last-write-wins per user. The desktop is
 *     single-operator by nature, so a merge algorithm would add risk
 *     without buying correctness; `revision` exists so a stale tab can tell
 *     it lost rather than silently clobbering a newer layout.
 *   • Every network path is failure-tolerant. Signed out, offline, or RLS
 *     rejection all degrade to "local only" instead of throwing into render.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { bus } from "./bus";
import { safeGetJSON, safeSetJSON } from "./safeStorage";

/** The whole shell, as persisted. Kept JSON-serializable end to end. */
export interface DesktopState {
  /** Open windows, minus the resolved DesktopItem (rehydrated by id). */
  openWindows: Array<{
    id: string;
    itemId: string;
    zIndex: number;
    pos: { x: number; y: number };
    size?: { width: number; height: number };
    minimized?: boolean;
  }>;
  focusedId: string | null;
  nextZIndex: number;
  /** Root desktop order; `null` marks a gap left by a deleted icon. */
  desktopItemIds: (string | null)[];
  /** Which icons are pinned to the desktop surface. */
  desktopVisibility: Record<string, boolean>;
  wallpaperUrl: string | null;
  /** User-made folders, documents and generated apps. */
  userItems: unknown[];
}

export const EMPTY_DESKTOP_STATE: DesktopState = {
  openWindows: [],
  focusedId: null,
  nextZIndex: 100,
  desktopItemIds: [],
  desktopVisibility: {},
  wallpaperUrl: null,
  userItems: [],
};

const LOCAL_KEY = "pc_desktop_state_v1";
const LOCAL_REV_KEY = "pc_desktop_revision_v1";

/** Debounce window for server writes. Long enough that dragging a window
 *  across the screen is one request, short enough that a user who drags and
 *  immediately closes the tab keeps the change. */
const SYNC_DEBOUNCE_MS = 1200;

/* ── local layer ───────────────────────────────────────────────────────── */

export function loadLocalState(): DesktopState {
  return {
    ...EMPTY_DESKTOP_STATE,
    ...safeGetJSON<Partial<DesktopState>>(LOCAL_KEY, {}),
  };
}

export function saveLocalState(state: DesktopState): void {
  // `silent` — a full disk here must not raise a toast on every drag; the
  // server copy is the durable one and reports its own failures.
  safeSetJSON(LOCAL_KEY, state, { silent: true });
}

function localRevision(): number {
  return safeGetJSON<number>(LOCAL_REV_KEY, 0);
}

function setLocalRevision(rev: number): void {
  safeSetJSON(LOCAL_REV_KEY, rev, { silent: true });
}

/* ── server layer ──────────────────────────────────────────────────────── */

async function currentUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export interface RemoteDesktop {
  state: DesktopState;
  themeId: string;
  wallpaperByTheme: Record<string, string>;
  revision: number;
}

/**
 * Fetch the server's copy. Returns null when signed out, offline, or when
 * the user simply has no saved desktop yet — all three mean "nothing to
 * reconcile against", and the caller treats them identically.
 */
export async function fetchRemoteState(): Promise<RemoteDesktop | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from("pc_desktop_state")
      .select("state, theme_id, wallpaper_by_theme, revision")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      state: { ...EMPTY_DESKTOP_STATE, ...((data.state as Partial<DesktopState>) ?? {}) },
      themeId: data.theme_id,
      wallpaperByTheme: (data.wallpaper_by_theme as Record<string, string>) ?? {},
      revision: Number(data.revision) || 0,
    };
  } catch {
    return null;
  }
}

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPayload: { state: DesktopState; themeId?: string; wallpaperByTheme?: Record<string, string> } | null = null;
let inFlight = false;

async function flush(): Promise<void> {
  if (!pendingPayload || inFlight) return;
  const payload = pendingPayload;
  pendingPayload = null;

  const userId = await currentUserId();
  // Signed out is a normal state, not an error: the desktop still works,
  // it just lives in this browser. Stay quiet rather than nagging.
  if (!userId) return;

  inFlight = true;
  bus.emit("cloud-sync-status", { status: "syncing" });
  try {
    const revision = localRevision() + 1;
    const row: Database["public"]["Tables"]["pc_desktop_state"]["Insert"] = {
      user_id: userId,
      state: payload.state as unknown as Json,
      revision,
      ...(payload.themeId !== undefined ? { theme_id: payload.themeId } : {}),
      ...(payload.wallpaperByTheme !== undefined
        ? { wallpaper_by_theme: payload.wallpaperByTheme as unknown as Json }
        : {}),
    };

    const { error } = await supabase.from("pc_desktop_state").upsert(row, { onConflict: "user_id" });
    if (error) throw error;
    setLocalRevision(revision);
    bus.emit("cloud-sync-status", { status: "idle" });
  } catch (err) {
    bus.emit("cloud-sync-status", {
      status: "error",
      message: err instanceof Error ? err.message : "Could not reach the server",
    });
  } finally {
    inFlight = false;
    // A write that landed while this one was in flight still needs sending.
    if (pendingPayload) scheduleFlush();
  }
}

function scheduleFlush(): void {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    void flush();
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Persist the desktop. Writes localStorage synchronously (so a reload is
 * always correct) and queues the server write behind a debounce.
 */
export function persistDesktop(
  state: DesktopState,
  extras?: { themeId?: string; wallpaperByTheme?: Record<string, string> },
): void {
  saveLocalState(state);
  pendingPayload = { state, ...extras };
  scheduleFlush();
}

/** Force any queued write out now — used on `pagehide`/`visibilitychange`. */
export function flushNow(): void {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  void flush();
}

/* ── per-app KV sync ───────────────────────────────────────────────────── */

/**
 * Mirror one namespaced key to `pc_app_data`. Apps keep calling
 * `appStorage(ns).set(...)` for the local write; this is the durable echo.
 */
export async function syncAppValue(namespace: string, key: string, value: unknown): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  try {
    await supabase
      .from("pc_app_data")
      .upsert(
        { user_id: userId, namespace, key, value: value as never },
        { onConflict: "user_id,namespace,key" },
      );
  } catch {
    // Local copy already succeeded; a failed mirror is not worth interrupting
    // the user over. The next write for this key retries implicitly.
  }
}

/** Pull an entire namespace back down, e.g. on first load on a new device. */
export async function fetchAppNamespace(namespace: string): Promise<Record<string, unknown>> {
  const userId = await currentUserId();
  if (!userId) return {};
  try {
    const { data, error } = await supabase
      .from("pc_app_data")
      .select("key, value")
      .eq("user_id", userId)
      .eq("namespace", namespace);
    if (error || !data) return {};
    return Object.fromEntries(data.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}
