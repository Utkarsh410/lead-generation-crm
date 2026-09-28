// Minimal, dependency-free charts. One hue (primary) per chart — every chart
// shows a single series, so no legend is needed; values are direct-labelled in
// text ink, and each mark has a hover tooltip plus an accessible label.

import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/client/format";

export function HorizontalBars({
  rows,
  formatValue = (v) => String(v),
  secondary,
  highlight,
  className,
}: {
  rows: { key: string; label: string; value: number; secondaryValue?: number }[];
  formatValue?: (v: number) => string;
  /** optional second number shown as text (e.g. ₹ value next to a count) */
  secondary?: (v: number) => string;
  highlight?: (key: string) => boolean;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={cn("space-y-0.5", className)}>
      {rows.map((r) => {
        const pct = (r.value / max) * 100;
        const tip = `${r.label}: ${formatValue(r.value)}${secondary && r.secondaryValue ? ` · ${secondary(r.secondaryValue)}` : ""}`;
        return (
          <li key={r.key} className="group relative grid grid-cols-[8.5rem_1fr_auto] items-center gap-2 rounded px-1 py-1 hover:bg-muted/60" aria-label={tip}>
            <span className="truncate text-xs text-muted-foreground">{r.label}</span>
            <span className="relative h-3">
              {r.value > 0 ? (
                <span
                  className={cn("absolute inset-y-0 left-0 rounded-r-[4px]", highlight?.(r.key) === false ? "bg-primary/35" : "bg-primary")}
                  style={{ width: `max(${pct}%, 4px)` }}
                />
              ) : (
                <span className="absolute inset-y-[5px] left-0 w-full border-t border-dashed border-border" />
              )}
            </span>
            <span className="min-w-16 text-right text-xs tabular-nums">
              <span className="font-medium text-foreground">{formatValue(r.value)}</span>
              {secondary && r.secondaryValue ? <span className="ml-1.5 text-muted-foreground">{secondary(r.secondaryValue)}</span> : null}
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute -top-7 left-36 z-10 hidden rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md group-hover:block"
            >
              {tip}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function WeeklyColumns({ title, data, today }: { title: string; data: { weekStart: string; count: number }[]; today: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  const last = data.at(-1)?.count ?? 0;
  return (
    <figure className="rounded-lg border bg-card p-4 shadow-xs">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{last}</span> this week · {total} in {data.length} wks
        </span>
      </figcaption>
      <div className="mt-3 flex h-24 items-end gap-[2px] border-b border-border" role="img" aria-label={`${title}: ${data.map((d) => `week of ${d.weekStart}: ${d.count}`).join(", ")}`}>
        {data.map((d) => {
          const isCurrent = d.weekStart <= today && today < addDaysLocal(d.weekStart, 7);
          return (
            <div key={d.weekStart} className="group relative flex h-full flex-1 items-end justify-center">
              {d.count > 0 ? (
                <div
                  className={cn("w-full max-w-7 rounded-t-[4px]", isCurrent ? "bg-primary" : "bg-primary/60")}
                  style={{ height: `${(d.count / max) * 100}%` }}
                />
              ) : null}
              <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-md group-hover:block">
                Week of {formatDay(d.weekStart)}: <strong>{d.count}</strong>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatDay(data[0]?.weekStart)}</span>
        <span>This week</span>
      </div>
    </figure>
  );
}

function addDaysLocal(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
