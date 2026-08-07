/**
 * DesktopContext — the window manager's public surface, for apps.
 *
 * PC's apps reached the desktop by dispatching untyped window CustomEvents
 * and hoping something was listening, which meant a Task Manager could show
 * windows but never actually close one. Exposing the manager as context
 * gives apps a typed, checkable handle on the shell: Task Manager closes and
 * focuses real windows, the App Browser pins icons, and anything can launch.
 *
 * Deliberately narrow — apps get commands, never raw state setters, so an
 * app cannot corrupt the window list.
 */
import { createContext, useContext } from "react";
import type { DesktopItem, OpenWindow } from "../types";

export interface DesktopApi {
  /** Currently open windows, in creation order. */
  windows: OpenWindow[];
  focusedId: string | null;
  /** Icons currently pinned to the desktop surface. */
  desktopItems: (DesktopItem | null)[];

  launchApp: (appId: string) => void;
  launchItem: (item: DesktopItem) => void;
  closeWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  closeAll: () => void;

  /** Pin/unpin an app's icon on the desktop surface. */
  isPinned: (appId: string) => boolean;
  setPinned: (appId: string, pinned: boolean) => void;

  /** Sign out and leave the desktop. */
  shutDown: () => void;
}

const DesktopContext = createContext<DesktopApi | null>(null);

export const DesktopProvider = DesktopContext.Provider;

/** Strict hook — for components that only ever render inside the desktop. */
export function useDesktop(): DesktopApi {
  const ctx = useContext(DesktopContext);
  if (!ctx) throw new Error("useDesktop must be used within the desktop shell");
  return ctx;
}

/** Tolerant variant, for components that may render outside a desktop. */
export function useDesktopOptional(): DesktopApi | null {
  return useContext(DesktopContext);
}
