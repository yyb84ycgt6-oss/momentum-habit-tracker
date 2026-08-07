/**
 * Start menu — the full roster, grouped by category.
 *
 * Reads the registry, so it never drifts from what is actually installed.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Power, Search } from "lucide-react";
import { APPS, CATEGORY_LABELS, CATEGORY_ORDER, type AppCategory } from "../apps/registry";

interface StartMenuProps {
  onLaunch: (appId: string) => void;
  onClose: () => void;
  onShutDown: () => void;
  pinnedIds: string[];
}

export function StartMenu({ onLaunch, onClose, onShutDown, pinnedIds }: StartMenuProps) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Click-away. Pointerdown rather than click so it closes on the press that
  // starts a drag elsewhere, not only on a completed click.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Deferred: the same press that opened the menu would otherwise close it.
    const id = setTimeout(() => document.addEventListener("pointerdown", onDown), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return APPS.filter(
      (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q),
    );
  }, [query]);

  const pinned = useMemo(
    () =>
      pinnedIds
        .map((id) => APPS.find((a) => a.id === id))
        .filter((a): a is (typeof APPS)[number] => !!a),
    [pinnedIds],
  );

  const grouped = useMemo(() => {
    const map = new Map<AppCategory, typeof APPS>();
    for (const app of APPS) {
      const list = map.get(app.category) ?? [];
      list.push(app);
      map.set(app.category, list);
    }
    return map;
  }, []);

  return (
    <div
      ref={ref}
      className="absolute bottom-14 left-2 z-[2700] flex max-h-[70vh] w-[min(560px,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border border-white/15 bg-zinc-950/95 shadow-2xl backdrop-blur-xl"
    >
      <div className="border-b border-white/10 p-3">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps…"
            autoFocus
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-os-accent/60"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filtered ? (
          filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-600">Nothing matches “{query}”.</p>
          ) : (
            <Grid apps={filtered} onLaunch={onLaunch} />
          )
        ) : (
          <>
            {pinned.length > 0 && (
              <Section label="Pinned">
                <Grid apps={pinned} onLaunch={onLaunch} />
              </Section>
            )}
            {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => (
              <Section key={c} label={CATEGORY_LABELS[c]}>
                <Grid apps={grouped.get(c)!} onLaunch={onLaunch} />
              </Section>
            ))}
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-3 py-2">
        <span className="text-[10px] text-zinc-600">{APPS.length} apps installed</span>
        <button
          onClick={onShutDown}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-red-500/15 hover:text-red-300"
        >
          <Power size={13} /> Sign out
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        {label}
      </h3>
      {children}
    </section>
  );
}

function Grid({ apps, onLaunch }: { apps: typeof APPS; onLaunch: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
      {apps.map((app) => {
        const Icon = app.icon;
        return (
          <button
            key={app.id}
            onClick={() => onLaunch(app.id)}
            title={app.description}
            className="flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-white/10"
          >
            <span
              className={`grid size-10 place-items-center rounded-xl text-white ${app.bgColor}`}
            >
              <Icon size={18} />
            </span>
            <span className="line-clamp-2 text-center text-[10px] leading-tight text-zinc-300">
              {app.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default StartMenu;
