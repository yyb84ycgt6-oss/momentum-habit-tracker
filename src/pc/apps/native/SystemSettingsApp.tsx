/**
 * System Settings — the desktop's own preferences.
 *
 * Split from Momentum Settings on purpose: this is the shell (themes,
 * wallpaper, sync, storage), that one is the habit tracker's account. Mixing
 * them is how a settings screen becomes a junk drawer.
 */
import { useEffect, useState } from "react";
import {
  Cloud,
  CloudOff,
  HardDrive,
  Info,
  Loader2,
  Palette,
  RefreshCw,
  Trash2,
  Monitor,
} from "lucide-react";
import { PCThemePicker } from "@/pc/themes/components/PCThemePicker";
import { usePCTheme } from "@/pc/themes/PCThemeContext";
import { measureStorage } from "@/pc/lib/safeStorage";
import { bus } from "@/pc/lib/bus";
import { fetchRemoteState, flushNow } from "@/pc/lib/sync";
import { supabase } from "@/integrations/supabase/client";
import { APPS } from "../registry";

type Tab = "appearance" | "sync" | "storage" | "about";

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "sync", label: "Sync", icon: Cloud },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "about", label: "About", icon: Info },
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function SystemSettingsApp() {
  const [tab, setTab] = useState<Tab>("appearance");
  const { theme, themes } = usePCTheme();

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-200">
      <aside className="w-44 shrink-0 border-r border-zinc-800 p-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`mb-0.5 flex w-full items-center gap-2 rounded px-2.5 py-2 text-xs transition-colors ${
              tab === id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </aside>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === "appearance" && (
          <section>
            <h1 className="mb-1 text-sm font-semibold">Appearance</h1>
            <p className="mb-4 text-xs text-zinc-500">
              {themes.length} desktop eras. Currently wearing{" "}
              <strong className="text-zinc-300">{theme.label}</strong> ({theme.era}).
            </p>
            <PCThemePicker />
          </section>
        )}
        {tab === "sync" && <SyncPanel />}
        {tab === "storage" && <StoragePanel />}
        {tab === "about" && <AboutPanel />}
      </div>
    </div>
  );
}

function SyncPanel() {
  const [status, setStatus] = useState<"idle" | "syncing" | "error">("idle");
  const [message, setMessage] = useState<string>();
  const [email, setEmail] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ revision: number; themeId: string } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const off = bus.on("cloud-sync-status", (p) => {
      setStatus(p.status);
      setMessage(p.message);
    });
    return off;
  }, []);

  const check = async () => {
    setChecking(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setEmail(user?.email ?? null);
    const r = await fetchRemoteState();
    setRemote(r ? { revision: r.revision, themeId: r.themeId } : null);
    setChecking(false);
  };

  useEffect(() => {
    void check();
  }, []);

  return (
    <section>
      <h1 className="mb-1 text-sm font-semibold">Sync</h1>
      <p className="mb-4 text-xs text-zinc-500">
        Your layout, theme and app data live in your account, not just this browser.
      </p>

      <div className="mb-3 rounded-lg border border-zinc-800 p-3">
        <div className="flex items-center gap-2">
          {email ? (
            <Cloud size={14} className="text-emerald-400" />
          ) : (
            <CloudOff size={14} className="text-amber-400" />
          )}
          <span className="text-xs font-medium">{email ? "Signed in" : "Local only"}</span>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          {email
            ? `Syncing as ${email}. Changes reach the server about a second after you stop moving things.`
            : "You are signed out, so the desktop is saved to this browser only."}
        </p>
      </div>

      <div className="mb-3 rounded-lg border border-zinc-800 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-medium">
          <RefreshCw size={12} className={status === "syncing" ? "animate-spin" : ""} />
          Status: <span className="text-zinc-400">{status}</span>
        </div>
        {message && <p className="text-[11px] text-red-400">{message}</p>}
        {checking ? (
          <p className="flex items-center gap-1 text-[11px] text-zinc-500">
            <Loader2 size={10} className="animate-spin" /> checking server…
          </p>
        ) : remote ? (
          <p className="text-[11px] text-zinc-500">
            Server copy at revision {remote.revision}, theme{" "}
            <code className="text-zinc-400">{remote.themeId}</code>.
          </p>
        ) : (
          <p className="text-[11px] text-zinc-500">No server copy saved yet.</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            flushNow();
            setTimeout(() => void check(), 800);
          }}
          className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700"
        >
          Sync now
        </button>
        <button
          onClick={() => void check()}
          className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700"
        >
          Refresh status
        </button>
      </div>
    </section>
  );
}

function StoragePanel() {
  const [usage, setUsage] = useState(() => measureStorage(12));

  return (
    <section>
      <h1 className="mb-1 text-sm font-semibold">Storage</h1>
      <p className="mb-4 text-xs text-zinc-500">
        Local cache, by key. Clearing an entry only removes the local copy — anything synced is
        still on the server.
      </p>

      <div className="mb-3 rounded-lg border border-zinc-800 p-3">
        <div className="text-lg font-semibold">{formatBytes(usage.usedBytes)}</div>
        <p className="text-[11px] text-zinc-500">across {usage.keys} keys</p>
      </div>

      <ul className="space-y-1">
        {usage.largest.map((entry) => (
          <li
            key={entry.key}
            className="flex items-center justify-between gap-2 rounded border border-zinc-900 px-2.5 py-1.5"
          >
            <span className="truncate font-mono text-[11px] text-zinc-400">{entry.key}</span>
            <span className="shrink-0 text-[11px] text-zinc-500">{formatBytes(entry.bytes)}</span>
            <button
              onClick={() => {
                if (!confirm(`Remove local key "${entry.key}"?`)) return;
                try {
                  localStorage.removeItem(entry.key);
                } catch {
                  /* private mode — nothing to remove */
                }
                setUsage(measureStorage(12));
              }}
              title="Remove"
              className="shrink-0 rounded p-1 text-zinc-500 hover:bg-red-500/20 hover:text-red-400"
            >
              <Trash2 size={11} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AboutPanel() {
  const { themes } = usePCTheme();
  return (
    <section>
      <h1 className="mb-1 text-sm font-semibold">About</h1>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-zinc-800 p-4">
        <Monitor size={28} className="text-os-accent" />
        <div>
          <div className="text-sm font-semibold">Momentum PC</div>
          <div className="text-[11px] text-zinc-500">
            A windowed desktop, with habit tracking built in.
          </div>
        </div>
      </div>
      <dl className="space-y-1.5 text-[11px]">
        <Row label="Apps installed" value={String(APPS.length)} />
        <Row label="Desktop themes" value={String(themes.length)} />
        <Row label="Window manager" value="Pointer-events drag/resize, edge snapping" />
        <Row label="Persistence" value="localStorage cache + Supabase (RLS per user)" />
        <Row label="Habit data" value="habits · habit_logs · profiles" />
        <Row label="Desktop data" value="pc_desktop_state · pc_app_data · pc_notes" />
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-900 pb-1.5">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-300">{value}</dd>
    </div>
  );
}

export default SystemSettingsApp;
