/**
 * Desktop — the window manager.
 *
 * The recreation of PC's `App.tsx`, rebuilt around the registry rather than
 * a 200-line dispatch switch. Responsibilities, in order:
 *
 *   1. own the window list (open/close/focus/minimize/z-order/bounds)
 *   2. own which icons are pinned to the surface
 *   3. restore that state on boot — localStorage first, then reconcile with
 *      the server copy — and persist it on every change
 *   4. mount the shell chrome: icons, taskbar or themed PCShell, Start menu,
 *      command palette, context menus
 *
 * It deliberately holds no app state. Apps talk to it through DesktopContext
 * (typed commands) or the bus (`launch-app`), never by reaching into it.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Grid2X2,
  Loader2,
  Palette,
  Search,
  Settings,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";

import type { DesktopItem, OpenWindow } from "../types";
import { APPS, getApp, defaultDesktopAppIds } from "../apps/registry";
import { bus } from "../lib/bus";
import {
  EMPTY_DESKTOP_STATE,
  fetchRemoteState,
  flushNow,
  loadLocalState,
  persistDesktop,
  type DesktopState,
} from "../lib/sync";
import { usePCTheme } from "../themes/PCThemeContext";
import { PCShell } from "../themes/components/PCShell";
import { PCDesktopIcon } from "../themes/components/PCDesktopIcon";
import { useIsMobile } from "../desktop/useViewport";
import { useLongPress, type ContextRequest } from "../desktop/useLongPress";
import { ContextMenu, type MenuEntry } from "../desktop/ContextMenu";
import { DraggableWindow } from "./DraggableWindow";
import { FloatingWidget } from "../components/FloatingWidget";
import {
  startScheduler as startAmbientAgents,
  stopScheduler as stopAmbientAgents,
} from "../lib/ambient/agents";
import { initUnderstudy, predictNext } from "../lib/understudy/predictor";
import {
  registerApps,
  registerThemes,
  registerProviders,
  registerGlobalVerbs,
  setNextHopAdvisor,
} from "../lib/backroad";
import { allProviders } from "../lib/ai/catalog";
import { DesktopProvider, type DesktopApi } from "./DesktopContext";
import { Taskbar } from "./Taskbar";
import { StartMenu } from "./StartMenu";
import { CommandPalette } from "./CommandPalette";
import { BootScreen } from "./BootScreen";

/** Turn a registry entry into the DesktopItem the shell components speak. */
function itemForApp(appId: string): DesktopItem | null {
  const app = getApp(appId);
  if (!app) return null;
  return {
    id: app.id,
    name: app.name,
    type: "app",
    icon: app.icon,
    appId: app.id,
    bgColor: app.bgColor,
  };
}

/** Cascade new windows so a second window never lands exactly on the first. */
function cascadePosition(count: number, isMobile: boolean): { x: number; y: number } {
  if (isMobile) return { x: 0, y: 0 };
  const step = 28;
  const offset = (count % 8) * step;
  return { x: 60 + offset, y: 40 + offset };
}

export function Desktop({ onSignOut }: { onSignOut: () => void }) {
  const isMobile = useIsMobile();
  const { isDefault: themeIsDefault, wallpaper, scopeProps, setTheme, themes } = usePCTheme();

  const [booted, setBooted] = useState(false);
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [nextZ, setNextZ] = useState(100);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => defaultDesktopAppIds());
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  const [startOpen, setStartOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    entries: MenuEntry[];
    source: "mouse" | "touch";
    title?: string;
  } | null>(null);

  // Guards the persistence effect: without it the first render would write
  // default state over a restore that is still in flight.
  const hydrated = useRef(false);

  /* ── restore ───────────────────────────────────────────────────────── */

  const applyState = useCallback((state: DesktopState) => {
    if (state.desktopItemIds.length > 0) {
      setPinnedIds(state.desktopItemIds.filter((id): id is string => Boolean(id) && !!getApp(id!)));
    }
    setWallpaperUrl(state.wallpaperUrl ?? null);
    setNextZ(state.nextZIndex || 100);
    setFocusedId(state.focusedId ?? null);

    const restored: OpenWindow[] = [];
    for (const w of state.openWindows) {
      const item = itemForApp(w.itemId);
      // An app removed from the registry between sessions must not resurrect
      // as an empty frame — drop the window instead.
      if (!item) continue;
      restored.push({ ...w, item });
    }
    setWindows(restored);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Local first so the desktop paints immediately, then reconcile with the
    // server, which may be newer if another device moved things.
    applyState(loadLocalState());

    void (async () => {
      const remote = await fetchRemoteState();
      if (cancelled || !remote) {
        hydrated.current = true;
        setBooted(true);
        return;
      }
      applyState(remote.state);
      if (remote.themeId) setTheme(remote.themeId);
      hydrated.current = true;
      setBooted(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── persist ───────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!hydrated.current) return;
    persistDesktop({
      ...EMPTY_DESKTOP_STATE,
      openWindows: windows.map(({ id, itemId, zIndex, pos, size, minimized }) => ({
        id,
        itemId,
        zIndex,
        pos,
        size,
        minimized,
      })),
      focusedId,
      nextZIndex: nextZ,
      desktopItemIds: pinnedIds,
      wallpaperUrl,
    });
  }, [windows, focusedId, nextZ, pinnedIds, wallpaperUrl]);

  // A closed tab should not lose the last second of layout changes.
  useEffect(() => {
    const onHide = () => flushNow();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  /* ── window commands ───────────────────────────────────────────────── */

  const focusWindow = useCallback((id: string) => {
    setFocusedId(id);
    setNextZ((z) => {
      setWindows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, zIndex: z, minimized: false } : w)),
      );
      return z + 1;
    });
  }, []);

  const launchItem = useCallback(
    (item: DesktopItem) => {
      const appId = item.appId ?? item.id;
      setWindows((prev) => {
        // Single-instance: launching an open app focuses it rather than
        // stacking a duplicate, which is what every real desktop does.
        const existing = prev.find((w) => w.itemId === appId);
        if (existing) {
          setFocusedId(existing.id);
          setNextZ((z) => {
            queueMicrotask(() =>
              setWindows((cur) =>
                cur.map((w) => (w.id === existing.id ? { ...w, zIndex: z, minimized: false } : w)),
              ),
            );
            return z + 1;
          });
          return prev;
        }

        const app = getApp(appId);
        const id = `win-${appId}-${Date.now()}`;
        const size = app?.defaultSize ?? { width: 900, height: 640 };
        const next: OpenWindow = {
          id,
          item,
          itemId: appId,
          zIndex: nextZ,
          pos: cascadePosition(prev.length, isMobile),
          size,
        };
        setFocusedId(id);
        setNextZ((z) => z + 1);
        return [...prev, next];
      });
      setStartOpen(false);
      setPaletteOpen(false);
    },
    [nextZ, isMobile],
  );

  const launchApp = useCallback(
    (appId: string) => {
      const item = itemForApp(appId);
      if (item) launchItem(item);
    },
    [launchItem],
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setFocusedId((cur) => (cur === id ? null : cur));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
    setFocusedId((cur) => (cur === id ? null : cur));
  }, []);

  const setBounds = useCallback(
    (id: string, pos: { x: number; y: number }, size: { width: number; height: number }) => {
      setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, pos, size } : w)));
    },
    [],
  );

  const setPinned = useCallback((appId: string, pinned: boolean) => {
    setPinnedIds((prev) => {
      if (pinned) return prev.includes(appId) ? prev : [...prev, appId];
      return prev.filter((id) => id !== appId);
    });
  }, []);

  const shutDown = useCallback(() => {
    flushNow();
    onSignOut();
  }, [onSignOut]);

  /* ── the back road's on-ramps ──────────────────────────────────────── */

  useEffect(() => {
    // Each set is registered by whatever already owns it — the app registry,
    // the theme registry, the provider catalog — so there is no second list
    // here to drift out of sync with the first.
    registerApps(APPS.map((a) => ({ id: a.id, name: a.name, keywords: [a.description] })));
    registerThemes(themes.map((t) => ({ id: t.id, label: t.label, era: t.era })));
    registerProviders(allProviders().map((p) => ({ id: p.id, label: p.label })));
    registerGlobalVerbs();

    // What tends to follow what, so an agent arriving somewhere is told what
    // is usually needed next. Observed from real use by the Understudy, never
    // a dependency graph written by hand — a made-up dependency is worse than
    // none, because an agent acts on it.
    setNextHopAdvisor((address) =>
      address.startsWith("app:")
        ? predictNext(address.slice(4), 3).map((p) => ({
            address: `app:${p.appId}`,
            label: p.appId.replace(/_/g, " "),
            source: "observed" as const,
            confidence: p.confidence,
          }))
        : [],
    );
    return () => setNextHopAdvisor(null);
  }, [themes]);

  /* ── always-on engines ─────────────────────────────────────────────── */

  useEffect(() => {
    // Ambient agents keep their own wall-clock schedule. The Understudy only
    // attaches when it has been turned on, so a desktop with it off registers
    // no listeners at all — see lib/understudy/predictor.ts.
    startAmbientAgents();
    initUnderstudy();
    return () => stopAmbientAgents();
  }, []);

  /* ── bus + keyboard ────────────────────────────────────────────────── */

  useEffect(() => {
    const offLaunch = bus.on("launch-app", ({ appId }) => launchApp(appId));
    const offPalette = bus.on("open-command-palette", () => setPaletteOpen(true));
    const offShutdown = bus.on("shut-down", () => shutDown());
    // The Terminal's `theme` command routes through here.
    const onSetTheme = (e: Event) => {
      const detail = (e as CustomEvent<{ themeId: string }>).detail;
      if (detail?.themeId) setTheme(detail.themeId);
    };
    window.addEventListener("pc-set-theme", onSetTheme);
    return () => {
      offLaunch();
      offPalette();
      offShutdown();
      window.removeEventListener("pc-set-theme", onSetTheme);
    };
  }, [launchApp, shutDown, setTheme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setStartOpen(false);
        setMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── derived ───────────────────────────────────────────────────────── */

  const desktopItems = useMemo(
    () => pinnedIds.map((id) => itemForApp(id)).filter((i): i is DesktopItem => i !== null),
    [pinnedIds],
  );

  const allAppItems = useMemo(
    () => APPS.map((a) => itemForApp(a.id)).filter((i): i is DesktopItem => i !== null),
    [],
  );

  const api = useMemo<DesktopApi>(
    () => ({
      windows,
      focusedId,
      desktopItems,
      launchApp,
      launchItem,
      closeWindow,
      focusWindow,
      minimizeWindow,
      restoreWindow: focusWindow,
      closeAll: () => {
        setWindows([]);
        setFocusedId(null);
      },
      isPinned: (appId: string) => pinnedIds.includes(appId),
      setPinned,
      shutDown,
    }),
    [
      windows,
      focusedId,
      desktopItems,
      launchApp,
      launchItem,
      closeWindow,
      focusWindow,
      minimizeWindow,
      pinnedIds,
      setPinned,
      shutDown,
    ],
  );

  /* ── context menus ─────────────────────────────────────────────────── */

  const openSurfaceMenu = useCallback(
    (req: ContextRequest) => {
      setMenu({
        x: req.x,
        y: req.y,
        source: req.source,
        entries: [
          {
            id: "all-apps",
            label: "All apps…",
            icon: Grid2X2,
            onSelect: () => launchApp("app_store"),
          },
          {
            id: "terminal",
            label: "Open Terminal",
            icon: TerminalIcon,
            onSelect: () => launchApp("terminal"),
          },
          {
            id: "themes",
            label: "Change theme…",
            icon: Palette,
            separatorBefore: true,
            onSelect: () => launchApp("pc_themes"),
          },
          {
            id: "settings",
            label: "System Settings",
            icon: Settings,
            onSelect: () => launchApp("system_settings"),
          },
          {
            id: "close-all",
            label: "Close all windows",
            icon: X,
            separatorBefore: true,
            danger: true,
            disabled: windows.length === 0,
            onSelect: () => {
              setWindows([]);
              setFocusedId(null);
            },
          },
        ],
      });
    },
    [launchApp, windows.length],
  );

  const surfacePress = useLongPress(openSurfaceMenu, !menu);

  const openIconMenu = useCallback(
    (item: DesktopItem, req: ContextRequest) => {
      setMenu({
        x: req.x,
        y: req.y,
        source: req.source,
        title: item.name,
        entries: [
          { id: "open", label: "Open", icon: item.icon, onSelect: () => launchItem(item) },
          {
            id: "unpin",
            label: "Remove from desktop",
            icon: X,
            separatorBefore: true,
            danger: true,
            onSelect: () => setPinned(item.appId ?? item.id, false),
          },
        ],
      });
    },
    [launchItem, setPinned],
  );

  /* ── render ────────────────────────────────────────────────────────── */

  const surfaceBackground = wallpaperUrl
    ? {
        backgroundImage: `url(${wallpaperUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : themeIsDefault
      ? undefined
      : { background: wallpaper.css };

  return (
    <DesktopProvider value={api}>
      {!booted && <BootScreen />}

      <div
        {...scopeProps}
        className={`pc-desktop-root relative h-dvh w-screen overflow-hidden ${
          themeIsDefault ? "bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" : ""
        }`}
        style={{ ...scopeProps.style, ...surfaceBackground }}
      >
        {/* Desktop surface: icons live here, and a press-and-hold or
            right-click anywhere that is not an icon opens the surface menu. */}
        <div
          className="absolute inset-0 pb-12"
          {...surfacePress}
          onPointerDown={(e) => {
            surfacePress.onPointerDown(e);
            // A click on empty space dismisses transient shell UI, the way
            // clicking the desktop does everywhere else.
            if (e.target === e.currentTarget) {
              setStartOpen(false);
              setMenu(null);
            }
          }}
        >
          <div className="pointer-events-none absolute inset-0 p-4">
            {/* Icons fill top-to-bottom, then wrap into a new column — the
                desktop convention. `h-full` is load-bearing: `auto-fill` needs
                a resolved height to know how many 96px rows fit, and without
                it the track count collapses to one and the icons run across
                the top of the screen instead of down the left edge. */}
            <div
              className="pointer-events-auto grid h-full w-max gap-1"
              style={{ gridTemplateRows: "repeat(auto-fill, 96px)", gridAutoFlow: "column" }}
            >
              {desktopItems.map((item) =>
                themeIsDefault ? (
                  <CosmicIcon
                    key={item.id}
                    item={item}
                    onLaunch={launchItem}
                    onContext={openIconMenu}
                  />
                ) : (
                  <ThemedIcon
                    key={item.id}
                    item={item}
                    onLaunch={launchItem}
                    onContext={openIconMenu}
                  />
                ),
              )}
            </div>
          </div>
        </div>

        {/* Windows */}
        {windows
          .filter((w) => !w.minimized)
          .map((w) => {
            const app = getApp(w.itemId);
            const AppComponent = app?.component;
            return (
              <DraggableWindow
                key={w.id}
                id={w.id}
                title={w.item.name}
                icon={w.item.icon}
                zIndex={w.zIndex}
                isActive={focusedId === w.id}
                initialPos={w.pos}
                initialSize={w.size}
                onFocus={() => focusWindow(w.id)}
                onClose={() => closeWindow(w.id)}
                onMinimize={() => minimizeWindow(w.id)}
                onBoundsChange={(pos, size) => setBounds(w.id, pos, size)}
              >
                <Suspense fallback={<WindowLoading name={w.item.name} />}>
                  {AppComponent ? <AppComponent /> : <MissingApp id={w.itemId} />}
                </Suspense>
              </DraggableWindow>
            );
          })}

        {/* Shell chrome. Themed eras bring their own taskbar/dock/menubar via
            PCShell; the default cosmic look uses the native taskbar. */}
        {themeIsDefault ? (
          <>
            <Taskbar
              windows={windows}
              focusedId={focusedId}
              startOpen={startOpen}
              onToggleStart={() => setStartOpen((v) => !v)}
              onFocusWindow={focusWindow}
              onMinimizeWindow={minimizeWindow}
              onOpenPalette={() => setPaletteOpen(true)}
            />
            {startOpen && (
              <StartMenu
                onLaunch={launchApp}
                onClose={() => setStartOpen(false)}
                onShutDown={shutDown}
                pinnedIds={pinnedIds}
              />
            )}
          </>
        ) : (
          <PCShell
            apps={allAppItems}
            openWindows={windows.map((w) => ({ id: w.id, title: w.item.name, item: w.item }))}
            focusedId={focusedId}
            onFocusWindow={focusWindow}
            onLaunchApp={launchItem}
            onLaunchAppId={launchApp}
            onShutDown={shutDown}
          />
        )}

        {/* Floating search affordance — the palette's discoverable trigger,
            since ⌘K is invisible to anyone who has not been told about it.

            Wrapped so it can be moved and stays where it is put. It sat
            nailed to the top-right corner, which is exactly where a phone's
            own status chrome wants to be; being unable to move it out of the
            way was the complaint, not a missing feature. Drag on desktop,
            press-and-hold on touch. Reset lives in System Settings. */}
        <FloatingWidget
          id="desktop-search"
          className="absolute right-4 top-4 z-[2500]"
          title="Search apps (⌘K) — drag to move"
        >
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur transition-colors hover:bg-black/60"
          >
            <Search size={13} />
            <span className="hidden sm:inline">Search</span>
          </button>
        </FloatingWidget>

        {paletteOpen && (
          <CommandPalette onLaunch={launchApp} onClose={() => setPaletteOpen(false)} />
        )}

        {menu && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            entries={menu.entries}
            source={menu.source}
            title={menu.title}
            onClose={() => setMenu(null)}
          />
        )}
      </div>
    </DesktopProvider>
  );
}

/* ── icons ───────────────────────────────────────────────────────────── */

function CosmicIcon({
  item,
  onLaunch,
  onContext,
}: {
  item: DesktopItem;
  onLaunch: (item: DesktopItem) => void;
  onContext: (item: DesktopItem, req: ContextRequest) => void;
}) {
  const press = useLongPress((req) => onContext(item, req));
  const Icon = item.icon;
  return (
    <button
      onDoubleClick={() => onLaunch(item)}
      onClick={(e) => {
        // Touch has no double-click; a single tap must open. On a mouse the
        // first click only selects, matching desktop convention.
        if (e.detail === 0 || window.matchMedia("(pointer: coarse)").matches) onLaunch(item);
      }}
      {...press}
      className="group flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-lg p-1 transition-colors hover:bg-white/10 focus:bg-white/15 focus:outline-none"
      title={item.name}
    >
      <span
        className={`grid size-12 place-items-center rounded-xl text-white shadow-lg transition-transform group-hover:scale-105 ${item.bgColor ?? "bg-zinc-800"}`}
      >
        <Icon size={22} />
      </span>
      <span
        className="line-clamp-2 text-center text-[11px] leading-tight text-white"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
      >
        {item.name}
      </span>
    </button>
  );
}

function ThemedIcon({
  item,
  onLaunch,
  onContext,
}: {
  item: DesktopItem;
  onLaunch: (item: DesktopItem) => void;
  onContext: (item: DesktopItem, req: ContextRequest) => void;
}) {
  const { theme } = usePCTheme();
  const press = useLongPress((req) => onContext(item, req));
  return (
    <div {...press} className="h-24 w-24">
      <PCDesktopIcon item={item} pack={theme.iconPack} onLaunch={onLaunch} />
    </div>
  );
}

function WindowLoading({ name }: { name: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-zinc-950 text-zinc-500">
      <Loader2 size={20} className="animate-spin" />
      <span className="text-xs">Loading {name}…</span>
    </div>
  );
}

function MissingApp({ id }: { id: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950 p-6 text-center text-sm text-zinc-500">
      No app is registered as <code className="mx-1 text-zinc-300">{id}</code>.
    </div>
  );
}

export default Desktop;
