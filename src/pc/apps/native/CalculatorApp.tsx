/**
 * Calculator — keyboard-first, with a running tape.
 *
 * Evaluation is a small shunting-yard parser rather than `eval` or
 * `new Function`: the input is user-controlled text, and handing that to a
 * JS evaluator inside an app that also holds a Supabase session is not a
 * trade worth making for four operators.
 */
import { useCallback, useEffect, useState } from "react";
import { Delete, Equal } from "lucide-react";

type Token = number | string;

/** Tokenize "12 + 3 × (4 − 1)" into numbers and operator symbols. */
function tokenize(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const normalized = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  while (i < normalized.length) {
    const ch = normalized[i];
    if (ch === " ") {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < normalized.length && /[0-9.]/.test(normalized[i])) {
        num += normalized[i];
        i += 1;
      }
      const value = Number(num);
      if (!Number.isFinite(value)) return null;
      tokens.push(value);
      continue;
    }
    if ("+-*/%()".includes(ch)) {
      tokens.push(ch);
      i += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };

function evaluate(expr: string): number | null {
  const tokens = tokenize(expr);
  if (!tokens || tokens.length === 0) return null;

  const output: Token[] = [];
  const ops: string[] = [];

  // Unary minus: a leading '-' (or one right after an operator/paren) binds to
  // the number, so "-4 + 2" and "3 * -2" parse instead of failing.
  const normalized: Token[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const prev = normalized[normalized.length - 1];
    const isUnary =
      t === "-" && (normalized.length === 0 || (typeof prev === "string" && prev !== ")"));
    if (isUnary && typeof tokens[i + 1] === "number") {
      normalized.push(-(tokens[i + 1] as number));
      i += 1;
      continue;
    }
    normalized.push(t);
  }

  for (const token of normalized) {
    if (typeof token === "number") {
      output.push(token);
    } else if (token === "(") {
      ops.push(token);
    } else if (token === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop()!);
      if (!ops.length) return null;
      ops.pop();
    } else {
      while (
        ops.length &&
        ops[ops.length - 1] !== "(" &&
        PRECEDENCE[ops[ops.length - 1]] >= PRECEDENCE[token]
      ) {
        output.push(ops.pop()!);
      }
      ops.push(token);
    }
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op === "(") return null;
    output.push(op);
  }

  const stack: number[] = [];
  for (const token of output) {
    if (typeof token === "number") {
      stack.push(token);
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) return null;
    switch (token) {
      case "+":
        stack.push(a + b);
        break;
      case "-":
        stack.push(a - b);
        break;
      case "*":
        stack.push(a * b);
        break;
      case "/":
        stack.push(b === 0 ? NaN : a / b);
        break;
      case "%":
        stack.push(b === 0 ? NaN : a % b);
        break;
      default:
        return null;
    }
  }
  const result = stack.pop();
  return result !== undefined && stack.length === 0 && Number.isFinite(result) ? result : null;
}

const KEYS = [
  ["(", ")", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["0", ".", "⌫", "="],
];

export function CalculatorApp() {
  const [expr, setExpr] = useState("");
  const [tape, setTape] = useState<{ expr: string; result: string }[]>([]);
  const [error, setError] = useState(false);

  const preview = evaluate(expr);

  const press = useCallback((key: string) => {
    setError(false);
    if (key === "=") {
      setExpr((current) => {
        const value = evaluate(current);
        if (value === null) {
          setError(true);
          return current;
        }
        const formatted = String(Number(value.toFixed(10)));
        setTape((t) => [{ expr: current, result: formatted }, ...t].slice(0, 40));
        return formatted;
      });
      return;
    }
    if (key === "⌫") {
      setExpr((c) => c.slice(0, -1));
      return;
    }
    if (key === "C") {
      setExpr("");
      return;
    }
    setExpr((c) => c + key);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (/^[0-9.()%]$/.test(k)) press(k);
      else if (k === "+") press("+");
      else if (k === "-") press("−");
      else if (k === "*") press("×");
      else if (k === "/") {
        e.preventDefault();
        press("÷");
      } else if (k === "Enter" || k === "=") {
        e.preventDefault();
        press("=");
      } else if (k === "Backspace") press("⌫");
      else if (k === "Escape") press("C");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800 p-4">
        <div className="min-h-[28px] break-all text-right font-mono text-2xl">{expr || "0"}</div>
        <div
          className={`mt-1 text-right font-mono text-xs ${error ? "text-red-400" : "text-zinc-500"}`}
        >
          {error
            ? "Invalid expression"
            : preview !== null && expr
              ? `= ${Number(preview.toFixed(10))}`
              : " "}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 p-2">
        <button
          onClick={() => press("C")}
          className="col-span-4 rounded bg-zinc-800 py-2 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          Clear
        </button>
        {KEYS.flat().map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className={`rounded py-3 font-mono text-base transition-colors ${
              k === "="
                ? "bg-os-accent text-zinc-900 font-semibold hover:brightness-110"
                : "+−×÷%()".includes(k)
                  ? "bg-zinc-800 text-os-accent hover:bg-zinc-700"
                  : "bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            }`}
          >
            {k === "=" ? (
              <Equal size={15} className="mx-auto" />
            ) : k === "⌫" ? (
              <Delete size={15} className="mx-auto" />
            ) : (
              k
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto border-t border-zinc-800 px-3 py-2">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">Tape</div>
        {tape.length === 0 ? (
          <p className="text-[11px] text-zinc-700">Nothing calculated yet.</p>
        ) : (
          tape.map((row, i) => (
            <button
              key={i}
              onClick={() => setExpr(row.result)}
              className="flex w-full justify-between gap-2 rounded px-1 py-0.5 text-left font-mono text-[11px] hover:bg-zinc-900"
              title="Reuse this result"
            >
              <span className="truncate text-zinc-600">{row.expr}</span>
              <span className="shrink-0 text-zinc-400">= {row.result}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default CalculatorApp;
