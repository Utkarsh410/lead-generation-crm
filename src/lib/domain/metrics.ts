// Acquisition metrics. Rates are cumulative funnel rates based on how far each
// (non-archived) prospect has progressed — a prospect in "Qualified" has also
// been contacted and has replied.

import { FUNNEL_ORDER, type PipelineStage } from "./constants";

export type StageCountInput = { stage: PipelineStage; reachedStage?: PipelineStage | null };

export type FunnelCounts = {
  total: number;
  contacted: number;
  replied: number;
  qualified: number;
  opportunities: number; // reached discovery call or beyond
  won: number;
  lost: number;
};

const idx = (s: PipelineStage) => FUNNEL_ORDER.indexOf(s);

/**
 * `reachedStage` is the furthest funnel stage the prospect got to (needed for
 * Lost prospects, which may have been lost at any point). Falls back to stage.
 */
export function funnelCounts(rows: StageCountInput[]): FunnelCounts {
  const counts: FunnelCounts = { total: 0, contacted: 0, replied: 0, qualified: 0, opportunities: 0, won: 0, lost: 0 };
  for (const row of rows) {
    counts.total += 1;
    if (row.stage === "lost") counts.lost += 1;
    if (row.stage === "won") counts.won += 1;
    const reached = row.stage === "lost" ? (row.reachedStage ?? "prospect") : row.stage;
    const i = idx(reached === "lost" ? "prospect" : reached);
    if (i >= idx("contacted")) counts.contacted += 1;
    if (i >= idx("replied")) counts.replied += 1;
    if (i >= idx("qualified")) counts.qualified += 1;
    if (i >= idx("discovery_call")) counts.opportunities += 1;
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
    opportunityRate: rate(c.opportunities, c.qualified),
  };
}

export function formatRate(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

/** Furthest funnel stage reached, given the stage history from activities. */
export function furthestStage(current: PipelineStage, history: PipelineStage[]): PipelineStage {
  let best: PipelineStage = current === "lost" ? "prospect" : current;
  for (const s of history) {
    if (s !== "lost" && idx(s) > idx(best)) best = s;
  }
  return best;
}
