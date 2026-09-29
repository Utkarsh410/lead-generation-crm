// Acquisition metrics. Rates are cumulative funnel rates based on how far each
// (non-archived) prospect has progressed — a "Qualified" lead has also been
// contacted and has replied. Sales metrics come from opportunities instead.

import { FUNNEL_ORDER, type LeadStatus } from "./constants";
import { addDays, startOfWeek } from "./dates";

export type StageCountInput = { stage: LeadStatus; reachedStage?: LeadStatus | null };

export type FunnelCounts = {
  total: number;
  contacted: number;
  replied: number;
  qualified: number;
  /** prospects that became clients */
  clients: number;
  lost: number;
};

const idx = (s: LeadStatus) => FUNNEL_ORDER.indexOf(s);

/**
 * `reachedStage` is the furthest funnel stage the prospect got to (needed for
 * Lost prospects, which may have been lost at any point). Falls back to stage.
 */
/**
 * `reachedStage` is the furthest funnel status the lead got to (needed for Lost
 * and Nurture leads, which may have left the funnel at any point).
 */
export function funnelCounts(rows: StageCountInput[]): FunnelCounts {
  const counts: FunnelCounts = { total: 0, contacted: 0, replied: 0, qualified: 0, clients: 0, lost: 0 };
  for (const row of rows) {
    counts.total += 1;
    if (row.stage === "lost") counts.lost += 1;
    const inFunnel = row.stage !== "lost" && row.stage !== "nurture";
    const reached = inFunnel ? row.stage : (row.reachedStage ?? "new");
    const i = idx(reached === "lost" || reached === "nurture" ? "new" : reached);
    if (i >= idx("contacted")) counts.contacted += 1;
    if (i >= idx("replied")) counts.replied += 1;
    if (i >= idx("qualified")) counts.qualified += 1;
    if (i >= idx("client")) counts.clients += 1;
  }
  return counts;
}

/** Ratio as a percentage rounded to one decimal, or null when the base is 0. */
export function rate(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function acquisitionRates(c: FunnelCounts) {
  return {
    contactRate: rate(c.contacted, c.total),
    responseRate: rate(c.replied, c.contacted),
    qualificationRate: rate(c.qualified, c.replied),
    clientRate: rate(c.clients, c.qualified),
  };
}

export function formatRate(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

/**
 * Counts events per ISO week (Monday start) for the last `weeks` weeks ending
 * with the week containing `today`. Dates are YYYY-MM-DD in the business timezone.
 */
export function weeklyCounts(dates: string[], today: string, weeks = 8): { weekStart: string; count: number }[] {
  const current = startOfWeek(today);
  const buckets = Array.from({ length: weeks }, (_, i) => ({ weekStart: addDays(current, -7 * (weeks - 1 - i)), count: 0 }));
  const index = new Map(buckets.map((b, i) => [b.weekStart, i]));
  for (const d of dates) {
    const i = index.get(startOfWeek(d));
    if (i !== undefined) buckets[i].count += 1;
  }
  return buckets;
}
