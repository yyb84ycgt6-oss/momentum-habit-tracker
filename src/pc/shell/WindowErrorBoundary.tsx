/**
 * WindowErrorBoundary — one crashing app must not take the desktop with it.
 *
 * Jackie's PC mounted every app directly into the window body, so a render
 * error anywhere in the roster unmounted the whole React tree and left a
 * blank page with no way back. Wrapping each window's content means a
 * failure is contained to that window: the taskbar, the other windows and
 * the desktop keep working, and the user gets a retry rather than a reload.
 */
import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { bus } from "@/pc/lib/bus";

interface Props {
  children: React.ReactNode;
  appId: string;
  title: string;
}

interface State {
  error: Error | null;
}

export class WindowErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surfaced on the bus so the Activity Center can show a history of app
    // crashes rather than each one vanishing with the window that threw.
    bus.emit("app-error", { appId: this.props.appId, error, timestamp: Date.now() });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="h-full w-full overflow-auto bg-zinc-950 p-6 font-mono text-sm text-zinc-300">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle size={18} />
          <span className="font-semibold">{this.props.title} stopped responding</span>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          The app threw while rendering. The rest of the desktop is unaffected.
        </p>
        <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/50 p-3 text-[11px] text-red-300">
          {error.message}
        </pre>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-4 inline-flex items-center gap-2 rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:bg-zinc-700"
        >
          <RotateCcw size={12} /> Restart app
        </button>
      </div>
    );
  }
}

export default WindowErrorBoundary;
