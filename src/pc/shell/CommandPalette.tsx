/**
 * Command palette — ⌘K / Ctrl-K.
 *
 * Fuzzy-ish subsequence matching rather than substring: typing "mmt" should
 * find "Momentum Today", which a plain `includes` never would.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { APPS, CATEGORY_LABELS } from "../apps/registry";
import { go, resolve, type ResolvedDestination } from "../lib/backroad";

export function CommandPalette({
  onLaunch,
  onClose,
}: {
  onLaunch: (appId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Two modes on purpose. With an empty box this browses the whole app
  // catalogue, which is how anyone discovers what exists. The moment there is
  // a query it resolves through the back road instead, so the same box also
  // reaches themes, providers and global verbs — destinations an app-only
  // search could never return.
  const browsing = !query.trim();

  const browseResults = useMemo(
    () => (browsing ? [...APPS].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40) : []),
    [browsing],
  );

  const found: ResolvedDestination[] = useMemo(
    () => (browsing ? [] : resolve(query, 40)),
    [browsing, query],
  );

  const appFor = (address: string) =>
    address.startsWith("app:") ? APPS.find((a) => a.id === address.slice(4)) : undefined;

  // One flat list drives the keyboard, so arrows and Enter behave identically
  // in both modes.
  const rows = useMemo(
    () =>
      browsing
        ? browseResults.map((app) => ({ address: `app:${app.id}`, app, dest: undefined }))
        : found.map((dest) => ({ address: dest.address, app: appFor(dest.address), dest })),
    [browsing, browseResults, found],
  );

  const results = rows;

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const app = results[active];
        if (app) {
          if (app.app) onLaunch(app.app.id);
          else void go(app.address);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [results, active, onLaunch, onClose]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div
      className="absolute inset-0 z-[3000] flex items-start justify-center bg-black/50 pt-[12vh] backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(620px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/15 bg-zinc-950/95 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-4">
          <Search size={16} className="shrink-0 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps…"
            autoFocus
            className="w-full bg-transparent py-3.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <kbd className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-600">Nothing matches “{query}”.</p>
          ) : (
            results.map((row, i) => {
              const app = row.app;
              const Icon = app?.icon;
              return (
                <button
                  key={row.address}
                  data-index={i}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => (app ? onLaunch(app.id) : void go(row.address))}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    i === active ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-lg text-white ${app?.bgColor ?? "bg-zinc-800"}`}
                  >
                    {Icon ? (
                      <Icon size={15} />
                    ) : (
                      <span className="text-[8px] uppercase text-zinc-400">
                        {row.dest?.kind.slice(0, 4)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-zinc-100">
                      {app?.name ?? row.dest?.label}
                    </span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {app?.description ?? row.address}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-zinc-600">
                    {app ? CATEGORY_LABELS[app.category] : row.dest?.kind}
                  </span>
                  {i === active && <CornerDownLeft size={12} className="shrink-0 text-zinc-500" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
