/**
 * Task Manager — the open windows, and control over them.
 *
 * Reads live window state from the desktop context rather than a snapshot,
 * so ending a task actually closes the window instead of just removing a row
 * from a list.
 */
import { useEffect, useState } from "react";
import { CircleX, Eye, EyeOff, Gauge, HardDrive, Layers, RefreshCw } from "lucide-react";
import { useDesktop } from "@/pc/shell/DesktopContext";
import { measureStorage } from "@/pc/lib/safeStorage";
import { getApp } from "../registry";

interface MemoryInfo {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskManagerApp() {
  const desktop = useDesktop();
  const [memory, setMemory] = useState<MemoryInfo | null>(null);
  const [storage, setStorage] = useState(() => measureStorage(6));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const read = () => {
      // performance.memory is Chromium-only and unspecified; absent elsewhere,
      // which is why the panel below degrades instead of showing zeros.
      const perf = performance as Performance & { memory?: MemoryInfo };
      setMemory(perf.memory ?? null);
      setStorage(measureStorage(6));
      setTick((t) => t + 1);
    };
    read();
    const id = setInterval(read, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-full w-full overflow-y-auto bg-zinc-950 p-4 text-zinc-200">
      <div className="mb-4 flex items-center gap-2">
        <Gauge size={16} className="text-os-accent" />
        <h1 className="text-sm font-semibold">Task Manager</h1>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-500">
          <RefreshCw size={10} className={tick % 2 === 0 ? "" : "animate-spin"} /> live
        </span>
      </div>

      {/* Processes */}
      <section className="mb-5 rounded-lg border border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <Layers size={12} /> Open windows ({desktop.windows.length})
          </span>
          {desktop.windows.length > 0 && (
            <button
              onClick={desktop.closeAll}
              className="rounded px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/15"
            >
              End all tasks
            </button>
          )}
        </div>
        {desktop.windows.length === 0 ? (
          <p className="p-4 text-center text-xs text-zinc-600">No windows open.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-1.5 font-medium">App</th>
                <th className="px-3 py-1.5 font-medium">State</th>
                <th className="px-3 py-1.5 font-medium">Position</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {desktop.windows.map((w) => {
                const app = getApp(w.item.appId);
                const Icon = app?.icon ?? w.item.icon;
                const focused = desktop.focusedId === w.id;
                return (
                  <tr key={w.id} className="border-t border-zinc-900 hover:bg-zinc-900/60">
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-1.5">
                        {Icon && <Icon size={12} className="shrink-0 text-os-accent" />}
                        <span className="truncate">{w.item.name}</span>
                        {focused && <span className="text-[9px] text-emerald-400">active</span>}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-zinc-400">
                      {w.minimized ? "Minimized" : "Running"}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[10px] text-zinc-500">
                      {Math.round(w.pos.x)},{Math.round(w.pos.y)}
                      {w.size ? ` · ${Math.round(w.size.width)}×${Math.round(w.size.height)}` : ""}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() =>
                            w.minimized ? desktop.restoreWindow(w.id) : desktop.minimizeWindow(w.id)
                          }
                          title={w.minimized ? "Restore" : "Minimize"}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                        >
                          {w.minimized ? <Eye size={11} /> : <EyeOff size={11} />}
                        </button>
                        <button
                          onClick={() => desktop.closeWindow(w.id)}
                          title="End task"
                          className="rounded p-1 text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
                        >
                          <CircleX size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Resources */}
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-zinc-800 p-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium">
            <Gauge size={12} /> Memory
          </h2>
          {memory ? (
            <>
              <div className="text-lg font-semibold">{formatBytes(memory.usedJSHeapSize)}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-os-accent transition-all"
                  style={{
                    width: `${Math.min(100, (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">
                of {formatBytes(memory.jsHeapSizeLimit)} heap limit
              </p>
            </>
          ) : (
            <p className="text-[11px] text-zinc-500">
              This browser does not expose heap statistics. Chromium reports them; Firefox and
              Safari do not.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-zinc-800 p-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium">
            <HardDrive size={12} /> Local storage
          </h2>
          <div className="text-lg font-semibold">{formatBytes(storage.usedBytes)}</div>
          <ul className="mt-2 space-y-0.5">
            {storage.largest.map((entry) => (
              <li key={entry.key} className="flex justify-between gap-2 text-[10px] text-zinc-500">
                <span className="truncate font-mono">{entry.key}</span>
                <span className="shrink-0">{formatBytes(entry.bytes)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default TaskManagerApp;
