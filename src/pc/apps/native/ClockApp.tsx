/**
 * Clock — world clocks, stopwatch and timer.
 *
 * The stopwatch and timer track wall-clock deltas rather than counting
 * interval ticks. A background tab has its timers throttled to roughly once
 * a second at best, so a tick-counting stopwatch silently runs slow the
 * moment the window loses focus.
 */
import { useEffect, useRef, useState } from "react";
import {
  Clock as ClockIcon,
  Globe,
  Pause,
  Play,
  RotateCcw,
  Timer as TimerIcon,
} from "lucide-react";

type Tab = "world" | "stopwatch" | "timer";

const ZONES = [
  { label: "Local", tz: undefined as string | undefined },
  { label: "UTC", tz: "UTC" },
  { label: "New York", tz: "America/New_York" },
  { label: "London", tz: "Europe/London" },
  { label: "Berlin", tz: "Europe/Berlin" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
  { label: "Sydney", tz: "Australia/Sydney" },
];

function formatDuration(ms: number, withMs = true): string {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const base = `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return withMs ? `${base}.${String(cs).padStart(2, "0")}` : base;
}

export function ClockApp() {
  const [tab, setTab] = useState<Tab>("world");
  return (
    <div className="flex h-full w-full flex-col bg-zinc-950 text-zinc-100">
      <div className="flex shrink-0 border-b border-zinc-800">
        {(
          [
            ["world", "World", Globe],
            ["stopwatch", "Stopwatch", ClockIcon],
            ["timer", "Timer", TimerIcon],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs transition-colors ${
              tab === id
                ? "border-b-2 border-os-accent text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "world" && <WorldClocks />}
        {tab === "stopwatch" && <Stopwatch />}
        {tab === "timer" && <Timer />}
      </div>
    </div>
  );
}

function WorldClocks() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-2">
      {ZONES.map(({ label, tz }) => (
        <div
          key={label}
          className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2.5"
        >
          <div>
            <div className="text-xs font-medium">{label}</div>
            <div className="text-[10px] text-zinc-500">
              {now.toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone: tz,
              })}
            </div>
          </div>
          <div className="font-mono text-lg tabular-nums">
            {now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZone: tz,
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  // Wall-clock anchor: elapsed is always "now minus start", never a tally of
  // ticks, so throttled timers cannot make it drift.
  const startedAt = useRef(0);
  const baseline = useRef(0);

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    const id = setInterval(
      () => setElapsed(baseline.current + (Date.now() - startedAt.current)),
      50,
    );
    return () => clearInterval(id);
  }, [running]);

  function toggle() {
    if (running) {
      baseline.current += Date.now() - startedAt.current;
      setElapsed(baseline.current);
    }
    setRunning((r) => !r);
  }

  function reset() {
    setRunning(false);
    baseline.current = 0;
    setElapsed(0);
    setLaps([]);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="my-6 font-mono text-4xl tabular-nums">{formatDuration(elapsed)}</div>
      <div className="flex gap-2">
        <button
          onClick={toggle}
          className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium ${
            running ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
          }`}
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
          {running ? "Pause" : "Start"}
        </button>
        <button
          onClick={() => setLaps((l) => [elapsed, ...l])}
          disabled={!running}
          className="rounded-full bg-zinc-800 px-5 py-2 text-sm text-zinc-300 disabled:opacity-40"
        >
          Lap
        </button>
        <button
          onClick={reset}
          className="rounded-full bg-zinc-800 px-3 py-2 text-zinc-400 hover:text-zinc-200"
        >
          <RotateCcw size={14} />
        </button>
      </div>
      {laps.length > 0 && (
        <ul className="mt-5 w-full space-y-1">
          {laps.map((lap, i) => (
            <li
              key={i}
              className="flex justify-between border-b border-zinc-900 px-1 py-1 font-mono text-xs text-zinc-400"
            >
              <span className="text-zinc-600">Lap {laps.length - i}</span>
              <span>{formatDuration(lap)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Timer() {
  const [minutes, setMinutes] = useState(5);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const endsAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = endsAt.current - Date.now();
      if (left <= 0) {
        setRemaining(0);
        setRunning(false);
        // A finished timer should be noticeable without stealing focus.
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
          osc.start();
          osc.stop(ctx.currentTime + 0.8);
        } catch {
          /* audio blocked — the visual state is still correct */
        }
      } else {
        setRemaining(left);
      }
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  function start() {
    const ms = minutes * 60_000;
    endsAt.current = Date.now() + ms;
    setRemaining(ms);
    setRunning(true);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="my-6 font-mono text-4xl tabular-nums">
        {formatDuration(running || remaining > 0 ? remaining : minutes * 60_000, false)}
      </div>
      {!running && (
        <div className="mb-4 flex flex-wrap justify-center gap-1.5">
          {[1, 3, 5, 10, 15, 25, 45].map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={`rounded-full px-3 py-1 text-xs ${
                minutes === m
                  ? "bg-os-accent text-zinc-900 font-medium"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {running ? (
          <button
            onClick={() => setRunning(false)}
            className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-5 py-2 text-sm font-medium text-amber-300"
          >
            <Pause size={14} /> Stop
          </button>
        ) : (
          <button
            onClick={start}
            className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-5 py-2 text-sm font-medium text-emerald-300"
          >
            <Play size={14} /> Start
          </button>
        )}
        <button
          onClick={() => {
            setRunning(false);
            setRemaining(0);
          }}
          className="rounded-full bg-zinc-800 px-3 py-2 text-zinc-400 hover:text-zinc-200"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}

export default ClockApp;
