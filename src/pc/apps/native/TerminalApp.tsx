/**
 * Terminal — a real command line over the desktop's own state.
 *
 * This is the piece that makes the integration more than two products in one
 * window manager. The same shell that opens apps and lists notes also checks
 * off habits and reports streaks, because every one of those is a call into
 * the modules the GUI apps use — not a reimplementation. `habit done read`
 * and tapping the circle in Today are the same write, and both windows show
 * the result immediately.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { bus } from "@/pc/lib/bus";
import { APPS, getApp } from "../registry";
import { listNotes, createNote, type Note } from "@/pc/lib/notes";
import { habitsSnapshot, refreshHabits } from "../momentum/useHabits";
import { supabase } from "@/integrations/supabase/client";
import { calcStreak, todayISO } from "@/lib/momentum";

interface Line {
  kind: "in" | "out" | "err" | "sys";
  text: string;
}

const BANNER = [
  "Momentum PC  ·  desktop shell",
  'Type "help" for commands. Tab completes, ↑/↓ walks history.',
];

export function TerminalApp() {
  const [lines, setLines] = useState<Line[]>(
    BANNER.map((text) => ({ kind: "sys" as const, text })),
  );
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const print = useCallback((text: string, kind: Line["kind"] = "out") => {
    setLines((prev) => [...prev, { kind, text }]);
  }, []);

  useEffect(() => {
    // Pin to the bottom as output arrives.
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  /** Resolve a habit by name prefix — typing the full name is unreasonable. */
  function findHabit(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return undefined;
    const { habits } = habitsSnapshot();
    const active = habits.filter((h) => !h.archived);
    return (
      active.find((h) => h.name.toLowerCase() === q) ??
      active.find((h) => h.name.toLowerCase().startsWith(q)) ??
      active.find((h) => h.name.toLowerCase().includes(q))
    );
  }

  const run = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      print(`$ ${trimmed}`, "in");

      const [cmd, ...rest] = trimmed.split(/\s+/);
      const argline = rest.join(" ");

      switch (cmd.toLowerCase()) {
        case "help":
          print(
            [
              "apps                    list every installed app",
              "open <app>              open an app by id or name",
              "habits                  today's habits and their state",
              "habit done <name>       check a habit off for today",
              "habit undo <name>       un-check a habit for today",
              "streak                  current and per-habit streaks",
              "notes                   list saved notes",
              "note new <title>        create a note",
              "cat <title>             print a note's contents",
              "theme <id>              switch desktop theme (see: themes)",
              "themes                  list available theme ids",
              "whoami                  the signed-in account",
              "date                    current date and time",
              "clear                   clear the screen",
            ].join("\n"),
          );
          break;

        case "apps": {
          const width = Math.max(...APPS.map((a) => a.id.length));
          print(APPS.map((a) => `${a.id.padEnd(width)}  ${a.name}`).join("\n"));
          break;
        }

        case "open": {
          if (!argline) {
            print("usage: open <app-id or name>", "err");
            break;
          }
          const q = argline.toLowerCase();
          const app =
            getApp(argline) ??
            APPS.find((a) => a.name.toLowerCase() === q) ??
            APPS.find((a) => a.name.toLowerCase().startsWith(q));
          if (!app) {
            print(`no such app: ${argline}`, "err");
            break;
          }
          bus.emit("launch-app", { appId: app.id });
          print(`opening ${app.name}…`);
          break;
        }

        case "habits": {
          await refreshHabits();
          const { habits, logs } = habitsSnapshot();
          const active = habits.filter((h) => !h.archived);
          if (active.length === 0) {
            print("no habits yet — open Habits to add one");
            break;
          }
          const today = todayISO();
          const doneToday = new Set(
            logs.filter((l) => l.logged_date === today).map((l) => l.habit_id),
          );
          const width = Math.max(...active.map((h) => h.name.length));
          print(
            active
              .map(
                (h) =>
                  `${doneToday.has(h.id) ? "[x]" : "[ ]"}  ${h.name.padEnd(width)}  ${h.frequency}`,
              )
              .join("\n"),
          );
          break;
        }

        case "habit": {
          const [sub, ...nameParts] = rest;
          const name = nameParts.join(" ");
          if (sub !== "done" && sub !== "undo") {
            print("usage: habit done|undo <name>", "err");
            break;
          }
          const habit = findHabit(name);
          if (!habit) {
            print(`no habit matching "${name}"`, "err");
            break;
          }
          const today = todayISO();
          const { logs } = habitsSnapshot();
          const already = logs.some((l) => l.habit_id === habit.id && l.logged_date === today);

          if (sub === "done" && already) {
            print(`${habit.name} is already done today`);
            break;
          }
          if (sub === "undo" && !already) {
            print(`${habit.name} is not marked done today`);
            break;
          }

          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            print("you are signed out", "err");
            break;
          }

          if (sub === "done") {
            const { error } = await supabase
              .from("habit_logs")
              .insert({ habit_id: habit.id, user_id: user.id, logged_date: today });
            if (error) {
              print(error.message, "err");
              break;
            }
          } else {
            const { error } = await supabase
              .from("habit_logs")
              .delete()
              .eq("habit_id", habit.id)
              .eq("logged_date", today);
            if (error) {
              print(error.message, "err");
              break;
            }
          }
          await refreshHabits();
          bus.emit("habit-logged", { habitId: habit.id, date: today, logged: sub === "done" });

          const dates = new Set(
            habitsSnapshot()
              .logs.filter((l) => l.habit_id === habit.id)
              .map((l) => l.logged_date),
          );
          print(
            sub === "done"
              ? `✓ ${habit.name} — streak now ${calcStreak(dates)} days`
              : `↺ ${habit.name} un-checked for today`,
          );
          break;
        }

        case "streak": {
          await refreshHabits();
          const { habits, logs } = habitsSnapshot();
          const active = habits.filter((h) => !h.archived);
          if (active.length === 0) {
            print("no habits yet");
            break;
          }
          const overall = calcStreak(new Set(logs.map((l) => l.logged_date)));
          const width = Math.max(...active.map((h) => h.name.length));
          print(
            [
              `overall: ${overall} day${overall === 1 ? "" : "s"}`,
              "",
              ...active.map((h) => {
                const dates = new Set(
                  logs.filter((l) => l.habit_id === h.id).map((l) => l.logged_date),
                );
                return `  ${h.name.padEnd(width)}  ${calcStreak(dates)}d`;
              }),
            ].join("\n"),
          );
          break;
        }

        case "notes": {
          const notes = await listNotes();
          if (notes.length === 0) {
            print('no notes — try "note new My note"');
            break;
          }
          print(
            notes
              .map((n: Note) => `${n.pinned ? "★" : " "} ${n.title}  (${n.body.length} chars)`)
              .join("\n"),
          );
          break;
        }

        case "note": {
          const [sub, ...titleParts] = rest;
          if (sub !== "new") {
            print("usage: note new <title>", "err");
            break;
          }
          const created = await createNote({ title: titleParts.join(" ") || "Untitled" });
          print(
            created ? `created "${created.title}"` : "could not create note",
            created ? "out" : "err",
          );
          break;
        }

        case "cat": {
          if (!argline) {
            print("usage: cat <title>", "err");
            break;
          }
          const notes = await listNotes();
          const q = argline.toLowerCase();
          const note =
            notes.find((n) => n.title.toLowerCase() === q) ??
            notes.find((n) => n.title.toLowerCase().includes(q));
          if (!note) {
            print(`no note matching "${argline}"`, "err");
            break;
          }
          print(note.body || "(empty)");
          break;
        }

        case "themes": {
          const { PC_THEMES } = await import("@/pc/themes/registry");
          print(
            PC_THEMES.map((t) => `${t.id.padEnd(18)} ${t.era.padEnd(6)} ${t.label}`).join("\n"),
          );
          break;
        }

        case "theme": {
          if (!argline) {
            print("usage: theme <id>   (see: themes)", "err");
            break;
          }
          const { isKnownPCTheme } = await import("@/pc/themes/registry");
          if (!isKnownPCTheme(argline)) {
            print(`unknown theme: ${argline}`, "err");
            break;
          }
          // The provider owns theme state; the shell listens for this.
          window.dispatchEvent(new CustomEvent("pc-set-theme", { detail: { themeId: argline } }));
          print(`theme → ${argline}`);
          break;
        }

        case "whoami": {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          print(user ? `${user.email ?? user.id}` : "signed out (desktop is local-only)");
          break;
        }

        case "date":
          print(new Date().toString());
          break;

        case "clear":
          setLines([]);
          break;

        default:
          print(`command not found: ${cmd}  — try "help"`, "err");
      }
    },
    [print],
  );

  async function submit() {
    const value = input;
    setInput("");
    setHistoryIdx(null);
    if (value.trim()) setHistory((h) => [value, ...h].slice(0, 100));
    setBusy(true);
    try {
      await run(value);
    } catch (err) {
      print(err instanceof Error ? err.message : String(err), "err");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = historyIdx === null ? 0 : Math.min(historyIdx + 1, history.length - 1);
      if (history[next] !== undefined) {
        setHistoryIdx(next);
        setInput(history[next]);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === null) return;
      const next = historyIdx - 1;
      if (next < 0) {
        setHistoryIdx(null);
        setInput("");
      } else {
        setHistoryIdx(next);
        setInput(history[next]);
      }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const parts = input.split(/\s+/);
      // Complete an app id after `open`, otherwise complete the command.
      if (parts.length === 2 && parts[0].toLowerCase() === "open") {
        const match = APPS.find((a) => a.id.startsWith(parts[1].toLowerCase()));
        if (match) setInput(`open ${match.id}`);
        return;
      }
      const COMMANDS = [
        "help",
        "apps",
        "open",
        "habits",
        "habit",
        "streak",
        "notes",
        "note",
        "cat",
        "theme",
        "themes",
        "whoami",
        "date",
        "clear",
      ];
      const match = COMMANDS.find((c) => c.startsWith(parts[0].toLowerCase()));
      if (match && parts.length === 1) setInput(match + " ");
    }
  }

  return (
    <div
      className="flex h-full w-full flex-col bg-black font-mono text-[13px] text-emerald-300"
      onClick={() => inputRef.current?.focus()}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        {lines.map((l, i) => (
          <pre
            key={i}
            className={`whitespace-pre-wrap break-words leading-relaxed ${
              l.kind === "in"
                ? "text-zinc-400"
                : l.kind === "err"
                  ? "text-red-400"
                  : l.kind === "sys"
                    ? "text-zinc-500"
                    : "text-emerald-300"
            }`}
          >
            {l.text}
          </pre>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-emerald-900/60 px-3 py-2">
        <span className="shrink-0 text-emerald-500">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent outline-none disabled:opacity-50"
          aria-label="Terminal input"
        />
      </div>
    </div>
  );
}

export default TerminalApp;
