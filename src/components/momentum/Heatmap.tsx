import { dateISO } from "@/lib/momentum";

interface HeatmapProps {
  /** Set of YYYY-MM-DD strings that count as completed */
  completedDates: Set<string>;
  /** Number of days to render, default 84 (12 weeks) */
  days?: number;
}

export function Heatmap({ completedDates, days = 84 }: HeatmapProps) {
  const today = new Date();
  // align so today is the bottom-right cell
  const cells: { iso: string; on: boolean; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = dateISO(d);
    cells.push({ iso, on: completedDates.has(iso), label: d.toDateString() });
  }
  // Pad start so first column begins on Sunday
  const firstDow = new Date(cells[0].iso + "T00:00:00").getDay();
  const padded: ({ iso: string; on: boolean; label: string } | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...cells,
  ];

  return (
    <div className="overflow-x-auto">
      <div
        className="grid grid-flow-col gap-1.5"
        style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
      >
        {padded.map((cell, i) =>
          cell ? (
            <div
              key={cell.iso}
              title={`${cell.label}${cell.on ? " — done" : ""}`}
              className={"size-3.5 rounded-[4px] " + (cell.on ? "bg-primary" : "bg-muted")}
            />
          ) : (
            <div key={`pad-${i}`} className="size-3.5" />
          ),
        )}
      </div>
    </div>
  );
}
