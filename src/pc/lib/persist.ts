/**
 * persist — PC's global-state API, re-pointed at the Supabase sync layer.
 *
 * PC's original was ~470 lines coupling desktop snapshots to Firestore. That
 * job is done here by `sync.ts` against Supabase, so rather than port a
 * second, competing persistence path this module keeps the surface the
 * ported apps import and forwards to the one that actually runs. Two engines
 * writing the same desktop is how state diverges.
 */
import { safeGetJSON, safeSetJSON } from "./safeStorage";
import { bus } from "./bus";
import { flushNow, loadLocalState, persistDesktop, type DesktopState } from "./sync";

const CLOUD_SYNC_KEY = "pc_cloud_sync_enabled";

/**
 * Whether desktop state is mirrored to the account.
 *
 * Defaults to true: `sync.ts` already no-ops for a signed-out user, so the
 * only thing this switch controls is whether a *signed-in* user's desktop
 * follows them — which is the reason they signed in.
 */
export const isCloudSyncEnabled = (): boolean => safeGetJSON<boolean>(CLOUD_SYNC_KEY, true);

export const setCloudSyncEnabled = (enabled: boolean): void => {
  safeSetJSON(CLOUD_SYNC_KEY, enabled, { silent: true });
  bus.emit("cloud-sync-enabled-changed", { enabled });
};

/** Push any queued desktop write to the server now. */
export const forceCloudSync = async (): Promise<boolean> => {
  if (!isCloudSyncEnabled()) return false;
  flushNow();
  return true;
};

export const loadGlobalState = (): DesktopState => loadLocalState();

export const saveGlobalState = async (state: DesktopState): Promise<void> => {
  persistDesktop(state);
};

/**
 * Kept so PC's boot sequence compiles. The desktop shell performs its own
 * local-then-remote restore in `Desktop.tsx`, so there is nothing to do here.
 */
export const initializeGlobalState = async (): Promise<void> => {};
