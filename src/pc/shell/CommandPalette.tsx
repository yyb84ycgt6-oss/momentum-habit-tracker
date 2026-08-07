/**
 * Command palette — ⌘K / Ctrl-K.
 *
 * Fuzzy-ish subsequence matching rather than substring: typing "mmt" should
 * find "Momentum Today", which a plain `includes` never would.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { APPS, CATEGORY_LABELS } from "../apps/registry";

/** Score a candidate against a query; null means "no match". Lower is better. */
function score(query: string, target: string): number | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 0;

  const direct = t.indexOf(q);
  // A literal substring always beats a scattered subsequence, and an earlier
  // hit beats a later one.
  if (direct !== -1) return direct;

  let qi = 0;
  let last = -1;
  let gaps = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
    if (t[ti] === q[qi]) {
      if (last !== -1) gaps += ti - last - 1;
      last = ti;
      qi += 1;
    }
  }
  return qi === q.length ? 100 + gaps : null;
}

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

  const results = useMemo(() => {
    const scored = APPS.map((app) => {
      const nameScore = score(query, app.name);
      const descScore = score(query, app.description);
      // Description matches are real but weaker signals than name matches.
      const best = nameScore !== null ? nameScore : descScore !== null ? descScore + 400 : null;
      return best === null ? null : { app, best };
    }).filter((r): r is { app: (typeof APPS)[number]; best: number } => r !== null);

    scored.sort((a, b) => a.best - b.best || a.app.name.localeCompare(b.app.name));
    return scored.slice(0, 40).map((r) => r.app);
  }, [query]);

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
        if (app) onLaunch(app.id);
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
            <p className="p-8 text-center text-sm text-zinc-600">No apps match “{query}”.</p>
          ) : (
            results.map((app, i) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  data-index={i}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => onLaunch(app.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    i === active ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-lg text-white ${app.bgColor}`}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-zinc-100">
                      {app.name}
                    </span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {app.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-zinc-600">
                    {CATEGORY_LABELS[app.category]}
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
