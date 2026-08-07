/**
 * Taskbar — the default (cosmic) shell bar.
 *
 * Only mounts while the default theme is active; every other era brings its
 * own bar through PCShell. Shows a Start button, one button per open window,
 * a live sync indicator and a clock.
 */
import { useEffect, useState } from "react";
import { Cloud, CloudOff, LayoutGrid, Loader2, Search } from "lucide-react";
import type { OpenWindow } from "../types";
import { bus } from "../lib/bus";
import { getApp } from "../apps/registry";

interface TaskbarProps {
  windows: OpenWindow[];
  focusedId: string | null;
  startOpen: boolean;
  onToggleStart: () => void;
  onFocusWindow: (id: string) => void;
  onMinimizeWindow: (id: string) => void;
  onOpenPalette: () => void;
}

export function Taskbar({
  windows,
  focusedId,
  startOpen,
  onToggleStart,
  onFocusWindow,
  onMinimizeWindow,
  onOpenPalette,
}: TaskbarProps) {
  const [now, setNow] = useState(() => new Date());
  const [sync, setSync] = useState<"idle" | "syncing" | "error">("idle");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => bus.on("cloud-sync-status", (p) => setSync(p.status)), []);

  return (
    <div className="absolute inset-x-0 bottom-0 z-[2600] flex h-12 items-center gap-1 border-t border-white/10 bg-black/70 px-2 backdrop-blur-xl">
      <button
        onClick={onToggleStart}
        title="Start"
        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          startOpen ? "bg-os-accent text-zinc-900" : "text-zinc-200 hover:bg-white/10"
        }`}
      >
        <LayoutGrid size={15} />
        <span className="hidden sm:inline">Start</span>
      </button>

      <button
        onClick={onOpenPalette}
        title="Search apps (⌘K)"
        className="shrink-0 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
      >
        <Search size={14} />
      </button>

      {/* Running windows */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {windows.map((w) => {
          const app = getApp(w.itemId);
          const Icon = app?.icon ?? w.item.icon;
          const active = focusedId === w.id && !w.minimized;
          return (
            <button
              key={w.id}
              onClick={() => (active ? onMinimizeWindow(w.id) : onFocusWindow(w.id))}
              title={w.item.name}
              className={`flex min-w-0 max-w-[160px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                active
                  ? "bg-white/20 text-white"
                  : w.minimized
                    ? "bg-white/5 text-zinc-500 hover:bg-white/10"
                    : "bg-white/10 text-zinc-300 hover:bg-white/15"
              }`}
            >
              <Icon size={13} className="shrink-0" />
              <span className="truncate">{w.item.name}</span>
            </button>
          );
        })}
      </div>

      {/* Tray */}
      <div className="flex shrink-0 items-center gap-2 pl-2 text-zinc-400">
        <span
          title={
            sync === "error"
              ? "Could not reach the server — changes are saved locally"
              : sync === "syncing"
                ? "Saving to your account…"
                : "Synced"
          }
        >
          {sync === "syncing" ? (
            <Loader2 size={13} className="animate-spin text-os-accent" />
          ) : sync === "error" ? (
            <CloudOff size={13} className="text-amber-400" />
          ) : (
            <Cloud size={13} className="text-emerald-400/70" />
          )}
        </span>
        <span className="text-right text-[11px] leading-tight text-zinc-300">
          <span className="block">
            {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
          <span className="block text-[10px] text-zinc-500">
            {now.toLocaleDateString([], { month: "short", day: "numeric" })}
          </span>
        </span>
      </div>
    </div>
  );
}

export default Taskbar;
