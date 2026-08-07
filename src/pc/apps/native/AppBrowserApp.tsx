/**
 * All Apps — the roster, searchable, with desktop pinning.
 *
 * The registry is the only list; this app renders it. Adding an app anywhere
 * in `registry.ts` makes it appear here, in the Start menu and in the
 * command palette without touching any of them.
 */
import { useMemo, useState } from "react";
import { Search, Pin, PinOff, ExternalLink } from "lucide-react";
import { useDesktop } from "@/pc/shell/DesktopContext";
import { APPS, CATEGORY_LABELS, CATEGORY_ORDER, type AppCategory } from "../registry";

export function AppBrowserApp() {
  const desktop = useDesktop();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AppCategory | "all">("all");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return APPS.filter((a) => {
      if (category !== "all" && a.category !== category) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.id.includes(q)
      );
    });
  }, [query, category]);

  const grouped = useMemo(() => {
    const map = new Map<AppCategory, typeof APPS>();
    for (const app of results) {
      const list = map.get(app.category) ?? [];
      list.push(app);
      map.set(app.category, list);
    }
    return map;
  }, [results]);

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950 text-zinc-200">
      <div className="border-b border-zinc-800 p-3">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${APPS.length} apps…`}
            autoFocus
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-600 focus:border-os-accent/60"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <CategoryChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All"
          />
          {CATEGORY_ORDER.map((c) => (
            <CategoryChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
              label={CATEGORY_LABELS[c]}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {results.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-600">No apps match “{query}”.</p>
        ) : (
          CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => (
            <section key={c} className="mb-5">
              <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {CATEGORY_LABELS[c]}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.get(c)!.map((app) => {
                  const Icon = app.icon;
                  const pinned = desktop.isPinned(app.id);
                  return (
                    <div
                      key={app.id}
                      className="group flex items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 transition-colors hover:border-zinc-700"
                    >
                      <div
                        className={`grid size-9 shrink-0 place-items-center rounded-lg text-white ${app.bgColor}`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{app.name}</div>
                        <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-500">
                          {app.description}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1">
                          <button
                            onClick={() => desktop.launchApp(app.id)}
                            className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] hover:bg-zinc-700"
                          >
                            <ExternalLink size={9} /> Open
                          </button>
                          <button
                            onClick={() => desktop.setPinned(app.id, !pinned)}
                            title={pinned ? "Remove from desktop" : "Pin to desktop"}
                            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-colors ${
                              pinned
                                ? "bg-os-accent/20 text-os-accent hover:bg-os-accent/30"
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                            }`}
                          >
                            {pinned ? <PinOff size={9} /> : <Pin size={9} />}
                            {pinned ? "Unpin" : "Pin"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[10px] transition-colors ${
        active
          ? "bg-os-accent text-zinc-900 font-medium"
          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
      }`}
    >
      {label}
    </button>
  );
}

export default AppBrowserApp;
