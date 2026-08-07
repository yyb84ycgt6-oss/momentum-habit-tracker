/**
 * Minesweeper — three difficulties, with first-click protection.
 *
 * Mines are placed *after* the first reveal, excluding that cell and its
 * neighbours, so an opening click can never lose and always opens a region.
 * Generating the board up front is the version everyone has played and
 * quietly resented.
 */
import { useCallback, useEffect, useState } from "react";
import { Bomb, Flag, RotateCcw, Timer, Trophy } from "lucide-react";

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  /** Adjacent mine count; computed once mines are placed. */
  adjacent: number;
}

type Difficulty = "beginner" | "intermediate" | "expert";
type Status = "ready" | "playing" | "won" | "lost";

const LEVELS: Record<Difficulty, { rows: number; cols: number; mines: number; label: string }> = {
  beginner: { rows: 9, cols: 9, mines: 10, label: "Beginner" },
  intermediate: { rows: 16, cols: 16, mines: 40, label: "Intermediate" },
  expert: { rows: 16, cols: 30, mines: 99, label: "Expert" },
};

const NUMBER_COLORS = [
  "",
  "text-blue-400",
  "text-emerald-400",
  "text-red-400",
  "text-indigo-400",
  "text-amber-500",
  "text-cyan-400",
  "text-zinc-300",
  "text-zinc-500",
];

function emptyBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    })),
  );
}

function neighbours(r: number, c: number, rows: number, cols: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
    }
  }
  return out;
}

/** Place mines avoiding the first-clicked cell and everything touching it. */
function placeMines(board: Cell[][], mines: number, safeR: number, safeC: number): Cell[][] {
  const rows = board.length;
  const cols = board[0].length;
  const banned = new Set([
    `${safeR},${safeC}`,
    ...neighbours(safeR, safeC, rows, cols).map(([r, c]) => `${r},${c}`),
  ]);

  const candidates: [number, number][] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!banned.has(`${r},${c}`)) candidates.push([r, c]);
    }
  }
  // Fisher-Yates over the eligible cells, then take the first N.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const next = board.map((row) => row.map((cell) => ({ ...cell })));
  for (const [r, c] of candidates.slice(0, Math.min(mines, candidates.length)))
    next[r][c].mine = true;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      next[r][c].adjacent = neighbours(r, c, rows, cols).filter(
        ([nr, nc]) => next[nr][nc].mine,
      ).length;
    }
  }
  return next;
}

/** Iterative flood fill — a recursive one blows the stack on an expert board. */
function reveal(board: Cell[][], startR: number, startC: number): Cell[][] {
  const rows = board.length;
  const cols = board[0].length;
  const next = board.map((row) => row.map((cell) => ({ ...cell })));
  const stack: [number, number][] = [[startR, startC]];

  while (stack.length) {
    const [r, c] = stack.pop()!;
    const cell = next[r][c];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.adjacent === 0 && !cell.mine) {
      for (const [nr, nc] of neighbours(r, c, rows, cols)) {
        if (!next[nr][nc].revealed) stack.push([nr, nc]);
      }
    }
  }
  return next;
}

export function MinesweeperApp() {
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const level = LEVELS[difficulty];
  const [board, setBoard] = useState<Cell[][]>(() => emptyBoard(level.rows, level.cols));
  const [status, setStatus] = useState<Status>("ready");
  const [seconds, setSeconds] = useState(0);

  const reset = useCallback(
    (d: Difficulty = difficulty) => {
      const l = LEVELS[d];
      setBoard(emptyBoard(l.rows, l.cols));
      setStatus("ready");
      setSeconds(0);
    },
    [difficulty],
  );

  useEffect(() => {
    reset(difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty]);

  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const flagged = board.flat().filter((c) => c.flagged).length;
  const minesLeft = level.mines - flagged;

  function checkWin(next: Cell[][]): boolean {
    return next.flat().every((c) => c.revealed || c.mine);
  }

  function handleClick(r: number, c: number) {
    if (status === "won" || status === "lost") return;
    if (board[r][c].flagged) return;

    let working = board;
    if (status === "ready") {
      working = placeMines(board, level.mines, r, c);
      setStatus("playing");
    }

    if (working[r][c].mine) {
      const exploded = working.map((row) =>
        row.map((cell) => ({ ...cell, revealed: cell.revealed || cell.mine })),
      );
      setBoard(exploded);
      setStatus("lost");
      return;
    }

    const next = reveal(working, r, c);
    setBoard(next);
    if (checkWin(next)) setStatus("won");
  }

  function handleFlag(e: React.MouseEvent, r: number, c: number) {
    e.preventDefault();
    if (status === "won" || status === "lost" || board[r][c].revealed) return;
    setBoard((prev) =>
      prev.map((row, ri) =>
        row.map((cell, ci) => (ri === r && ci === c ? { ...cell, flagged: !cell.flagged } : cell)),
      ),
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center overflow-auto bg-zinc-950 p-3 text-zinc-200">
      <div className="mb-2 flex w-full items-center justify-center gap-1.5">
        {(Object.keys(LEVELS) as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className={`rounded-full px-3 py-1 text-[11px] transition-colors ${
              difficulty === d
                ? "bg-os-accent font-medium text-zinc-900"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {LEVELS[d].label}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center gap-4 rounded-lg border border-zinc-800 px-4 py-1.5 font-mono text-sm">
        <span className="flex items-center gap-1.5" title="Mines remaining">
          <Bomb size={13} className="text-red-400" />{" "}
          {String(Math.max(0, minesLeft)).padStart(2, "0")}
        </span>
        <button
          onClick={() => reset()}
          title="New game"
          className="text-zinc-400 hover:text-zinc-100"
        >
          {status === "won" ? (
            <Trophy size={15} className="text-amber-400" />
          ) : status === "lost" ? (
            "💥"
          ) : (
            <RotateCcw size={14} />
          )}
        </button>
        <span className="flex items-center gap-1.5" title="Elapsed">
          <Timer size={13} className="text-zinc-500" /> {String(seconds).padStart(3, "0")}
        </span>
      </div>

      <div
        className="grid gap-px rounded border border-zinc-700 bg-zinc-800 p-px"
        style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }}
      >
        {board.map((row, r) =>
          row.map((cell, c) => {
            const key = `${r}-${c}`;
            if (!cell.revealed) {
              return (
                <button
                  key={key}
                  onClick={() => handleClick(r, c)}
                  onContextMenu={(e) => handleFlag(e, r, c)}
                  aria-label={`Cell ${r + 1},${c + 1}`}
                  className="size-6 bg-zinc-700 text-xs transition-colors hover:bg-zinc-600 active:bg-zinc-500"
                >
                  {cell.flagged && <Flag size={10} className="mx-auto text-red-400" />}
                </button>
              );
            }
            return (
              <div
                key={key}
                className={`grid size-6 place-items-center bg-zinc-900 font-mono text-xs font-bold ${
                  cell.mine ? "bg-red-900/60" : NUMBER_COLORS[cell.adjacent]
                }`}
              >
                {cell.mine ? (
                  <Bomb size={11} className="text-red-300" />
                ) : cell.adjacent > 0 ? (
                  cell.adjacent
                ) : (
                  ""
                )}
              </div>
            );
          }),
        )}
      </div>

      <p className="mt-3 text-center text-[11px] text-zinc-500">
        {status === "won"
          ? `Cleared in ${seconds}s.`
          : status === "lost"
            ? "Hit a mine — press the button to try again."
            : "Click to reveal · right-click to flag. Your first click is always safe."}
      </p>
    </div>
  );
}

export default MinesweeperApp;
