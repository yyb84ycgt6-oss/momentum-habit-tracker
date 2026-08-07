/**
 * DraggableWindow — ported from Jackie's PC.
 *
 * Behaviour is unchanged from the original: pointer-event drag/resize (so
 * touch and pen work identically to mouse), double-click to maximize, and
 * forced-fullscreen on phones. Two things were added for this host:
 *
 *   • edge snapping — drag to the top/left/right edge to tile, the way every
 *     real desktop does. PC only had maximize, so a two-window layout meant
 *     positioning both by hand.
 *   • an error boundary around the content, so one app that throws takes
 *     down its own window instead of the whole desktop.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Minus, Square, Grip, ExternalLink } from "lucide-react";
import { usePCThemeOptional } from "@/pc/themes/PCThemeContext";
import { PCWindowControls } from "@/pc/themes/components/PCWindowChrome";
import { useIsMobile } from "@/pc/desktop/useViewport";
import { WindowErrorBoundary } from "./WindowErrorBoundary";

interface DraggableWindowProps {
  id: string;
  title: string;
  icon?: React.ElementType;
  onClose: () => void;
  children: React.ReactNode;
  initialPos?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  zIndex: number;
  onFocus?: () => void;
  onBoundsChange?: (pos: { x: number; y: number }, size: { width: number; height: number }) => void;
  isActive?: boolean;
  url?: string;
  /** Hide the window without closing it; restored from the taskbar. */
  onMinimize?: () => void;
}

/** How close to an edge a drag must land to trigger a snap, in px. */
const SNAP_EDGE_PX = 12;

type SnapZone = "left" | "right" | "top" | null;

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  id,
  title,
  icon: Icon,
  onClose,
  children,
  initialPos = { x: 50, y: 50 },
  initialSize = { width: 960, height: 600 },
  zIndex,
  onFocus,
  onBoundsChange,
  isActive = false,
  url,
  onMinimize,
}) => {
  const [pos, setPos] = useState(initialPos);
  const [size, setSize] = useState(initialSize);

  // Refs mirror state so the global pointer listeners below never read a
  // stale closure — they are registered once per drag, not per frame.
  const posRef = useRef(pos);
  const sizeRef = useRef(size);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [snapHint, setSnapHint] = useState<SnapZone>(null);
  const preMaximizeState = useRef({ pos, size });

  const isMobile = useIsMobile();
  const effectiveMaximized = isMaximized || isMobile;

  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // PC theme system: purely visual. `themed` is false for the default
  // cosmic-jackie theme (or if the provider is absent), in which case the
  // original chrome renders unchanged. Drag/resize/maximize/close logic is
  // shared by both paths — themes cannot alter behaviour.
  const pcTheme = usePCThemeOptional();
  const themed = !!pcTheme && !pcTheme.isDefault;
  const pcControls = pcTheme?.theme.window.controls ?? "fluent";

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore presses that land on the window-control buttons.
    if (e.target instanceof Element && e.target.closest("button")) return;

    if (onFocus) onFocus();
    if (effectiveMaximized) return;

    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    setIsDragging(true);
    dragStartPos.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    if (onFocus) onFocus();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };
  };

  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      setPos(preMaximizeState.current.pos);
      setSize(preMaximizeState.current.size);
    } else {
      preMaximizeState.current = { pos, size };
      setPos({ x: 0, y: 0 });
    }
    setIsMaximized(!isMaximized);
    if (onFocus) onFocus();
  }, [isMaximized, pos, size, onFocus]);

  /** Which edge, if any, a pointer at (x, y) is asking to snap to. */
  const zoneFor = (x: number, y: number): SnapZone => {
    if (y <= SNAP_EDGE_PX) return "top";
    if (x <= SNAP_EDGE_PX) return "left";
    if (x >= window.innerWidth - SNAP_EDGE_PX) return "right";
    return null;
  };

  /** Commit a snap: top maximizes, left/right tile to half the viewport. */
  const applySnap = (zone: SnapZone) => {
    if (!zone) return;
    preMaximizeState.current = { pos: posRef.current, size: sizeRef.current };
    if (zone === "top") {
      setIsMaximized(true);
      setPos({ x: 0, y: 0 });
      return;
    }
    const half = Math.floor(window.innerWidth / 2);
    // Leave room for the taskbar so a tiled window is fully reachable.
    const usableHeight = window.innerHeight - 48;
    setPos({ x: zone === "left" ? 0 : half, y: 0 });
    setSize({ width: half, height: usableHeight });
  };

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!isDragging && !isResizing) return;

      // Critical for touch: stops the page scrolling under the drag.
      e.preventDefault();

      if (isDragging) {
        setPos({ x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y });
        setSnapHint(zoneFor(e.clientX, e.clientY));
      }
      if (isResizing) {
        setSize({
          width: Math.max(300, resizeStart.current.width + (e.clientX - resizeStart.current.x)),
          height: Math.max(200, resizeStart.current.height + (e.clientY - resizeStart.current.y)),
        });
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (!isDragging && !isResizing) return;
      const zone = isDragging ? zoneFor(e.clientX, e.clientY) : null;
      setIsDragging(false);
      setIsResizing(false);
      setSnapHint(null);
      if (zone) {
        applySnap(zone);
        // applySnap sets state that onBoundsChange should see; report on the
        // next tick so the parent stores the snapped bounds, not the pre-snap
        // ones.
        setTimeout(() => onBoundsChange?.(posRef.current, sizeRef.current), 0);
        return;
      }
      onBoundsChange?.(posRef.current, sizeRef.current);
    };

    if (isDragging || isResizing) {
      window.addEventListener("pointermove", handleGlobalPointerMove, { passive: false });
      window.addEventListener("pointerup", handleGlobalPointerUp);
      window.addEventListener("pointercancel", handleGlobalPointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, isResizing]);

  const controls = (
    <PCWindowControls
      controls={pcControls}
      url={url}
      hideMaximize={isMobile}
      onMinimize={onMinimize}
      onToggleMaximize={toggleMaximize}
      onClose={onClose}
    />
  );

  return (
    <>
      {/* Snap preview — shows where the window will land before the drop. */}
      {snapHint && (
        <div
          className="pointer-events-none absolute border-2 border-os-accent bg-os-accent/20 transition-all duration-100"
          style={{
            zIndex: zIndex - 1,
            left: snapHint === "right" ? "50%" : 0,
            top: 0,
            width: snapHint === "top" ? "100%" : "50%",
            height: snapHint === "top" ? "100%" : "calc(100% - 48px)",
          }}
        />
      )}

      <div
        ref={windowRef}
        data-window-id={id}
        style={
          !effectiveMaximized
            ? { left: pos.x, top: pos.y, width: size.width, height: size.height, zIndex }
            : { zIndex }
        }
        className={
          themed
            ? `pc-window draggable-window ${isActive ? "pc-window-active" : ""} absolute flex flex-col overflow-hidden ${effectiveMaximized ? "inset-0 !rounded-none m-0 h-full w-full" : ""} transition-all duration-75 ease-out touch-none`
            : `draggable-window absolute flex flex-col bg-zinc-900 rounded-lg shadow-2xl border ${isActive ? "border-zinc-600 ring-1 ring-zinc-700" : "border-zinc-800"} overflow-hidden ${effectiveMaximized ? "inset-0 rounded-none m-0 h-full w-full" : ""} transition-all duration-75 ease-out touch-none`
        }
        onPointerDown={() => {
          if (onFocus) onFocus();
        }}
      >
        {/* Window header */}
        {themed ? (
          /* Era window chrome — same handlers, same state machine; only the
             paint and control glyphs change per theme family. */
          <div
            onDoubleClick={toggleMaximize}
            onPointerDown={handleHeaderPointerDown}
            className={`pc-titlebar ${isActive ? "pc-titlebar-active" : "pc-titlebar-inactive"} flex items-center justify-between gap-2 select-none touch-none shrink-0 ${!effectiveMaximized ? "cursor-grab active:cursor-grabbing" : ""} ${effectiveMaximized && isMobile ? "pt-4" : ""}`}
          >
            {/* macOS/Unity-style themes put controls on the LEFT and centre
                the title; Windows keeps title-left/controls-right. */}
            {pcTheme!.theme.window.controlsSide === "left" && controls}
            <div
              className={`flex items-center gap-1.5 font-medium pointer-events-none min-w-0 flex-1 ${pcTheme!.theme.window.controlsSide === "left" ? "justify-center pr-10" : ""}`}
            >
              {pcTheme!.theme.window.showTitleIcon && Icon && (
                <Icon size={13} className="opacity-90 shrink-0" />
              )}
              <span className="truncate">{title}</span>
            </div>
            {pcTheme!.theme.window.controlsSide !== "left" && controls}
          </div>
        ) : (
          <div
            onDoubleClick={toggleMaximize}
            onPointerDown={handleHeaderPointerDown}
            className={`bg-zinc-800 border-b border-zinc-700 px-3 py-2 flex items-center justify-between select-none touch-none shrink-0 ${!effectiveMaximized ? "cursor-grab active:cursor-grabbing" : ""} ${effectiveMaximized && isMobile ? "pt-4" : ""}`}
          >
            <div className="flex items-center gap-2 text-zinc-300 font-medium pointer-events-none min-w-0">
              {Icon && <Icon size={14} className="text-os-accent opacity-80 shrink-0" />}
              <span className="text-xs truncate">{title}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Touch targets grow to a real tappable size on mobile, where
                  every window is fullscreen and these are the only exit. */}
              {url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors mr-1 ${isMobile ? "min-w-[44px] min-h-[44px]" : "p-1"}`}
                  title="Open in new tab"
                >
                  <ExternalLink size={12} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMinimize?.();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Minimize"
                className={`flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors ${isMobile ? "min-w-[44px] min-h-[44px]" : "p-1"}`}
              >
                <Minus size={12} />
              </button>
              <button
                onClick={toggleMaximize}
                title="Maximize"
                className={`flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors ${isMobile ? "hidden" : "p-1"}`}
              >
                <Square size={10} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Close"
                className={`flex items-center justify-center rounded text-zinc-400 hover:bg-red-500 hover:text-white transition-colors ${isMobile ? "min-w-[44px] min-h-[44px]" : "p-1"}`}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Window content */}
        <div
          className={`flex-1 overflow-hidden relative pc-window-content ${themed ? "" : "bg-os-bg"} ${effectiveMaximized && isMobile ? "pb-20" : ""}`}
        >
          <WindowErrorBoundary appId={id} title={title}>
            {children}
          </WindowErrorBoundary>
          {/* Swallows stray interaction while the window is in the background,
              so a click there focuses rather than acting on the app. */}
          {!isActive && <div className="absolute inset-0 bg-transparent" />}
        </div>

        {/* Resize handle */}
        {!effectiveMaximized && (
          <div
            className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize flex items-center justify-center z-10 text-zinc-600 touch-none"
            onPointerDown={handleResizePointerDown}
          >
            <Grip size={14} className="-rotate-45 translate-x-1 translate-y-1" />
          </div>
        )}
      </div>
    </>
  );
};

export default DraggableWindow;
