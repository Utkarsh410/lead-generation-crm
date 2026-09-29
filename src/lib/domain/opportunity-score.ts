// Internal prioritisation score (0–100). It ranks who to work on first — it does
// NOT predict whether a prospect will buy. The weights below are defaults; users
// can override them (and the Hot/Warm thresholds) in Settings → Lead scoring.
// Weights are normalised to 100, so they don't have to add up exactly.

import type { LeadTemperature } from "./constants";

export const SCORE_FACTORS = [
  {
    key: "clear_problem",
    label: "Clear business problem",
    hint: "Can you name a specific problem they have?",
    weight: 20,
  },
  {
    key: "dev_requirement",
    label: "Need for a service I offer",
    hint: "Would solving it need a service you (or a partner) deliver?",
    weight: 15,
  },
  {
    key: "business_active",
    label: "Business appears active",
    hint: "Recent posts, reviews, hiring, running ads…",
    weight: 10,
  },
  {
    key: "decision_maker",
    label: "Decision maker identified",
    hint: "Founder/owner/director name known?",
    weight: 10,
  },
  {
    key: "contact_info",
    label: "Contact information available",
    hint: "Direct email/phone/DM for the right person?",
    weight: 10,
  },
  {
    key: "tech_gap",
    label: "Website / software / process gap",
    hint: "Missing or weak website, booking, portal, automation…",
    weight: 15,
  },
  {
    key: "urgency",
    label: "Urgency",
    hint: "Signals they need it soon (growth, launch, complaints)?",
    weight: 10,
  },
  {
    key: "project_value",
    label: "Potential project value",
    hint: "Likely budget size relative to effort.",
    weight: 10,
  },
] as const;

export type ScoreFactorKey = (typeof SCORE_FACTORS)[number]["key"];

/** 0 = No / unknown, 1 = Low, 2 = Medium, 3 = Strong. */
export type FactorRating = 0 | 1 | 2 | 3;
export const MAX_RATING = 3;
export const RATING_LABELS: Record<FactorRating, string> = {
  0: "No / unknown",
  1: "Low",
  2: "Medium",
  3: "Strong",
};

export type ScoreFactors = Partial<Record<ScoreFactorKey, FactorRating>>;

export const TEMPERATURE_THRESHOLDS = { hot: 70, warm: 40 } as const;

export type ScoreBreakdownItem = {
  key: ScoreFactorKey;
  label: string;
  rating: FactorRating;
  weight: number;
  points: number;
};

export type OpportunityScore = {
  score: number;
  temperature: LeadTemperature;
  breakdown: ScoreBreakdownItem[];
};

function clampRating(value: unknown): FactorRating {
  const n = typeof value === "number" ? Math.round(value) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= MAX_RATING) return 3;
  return n as FactorRating;
}

/** Sanitises untrusted input (e.g. jsonb from the DB) into known factors only. */
export function normalizeScoreFactors(input: unknown): ScoreFactors {
  const out: ScoreFactors = {};
  if (!input || typeof input !== "object") return out;
  const record = input as Record<string, unknown>;
  for (const factor of SCORE_FACTORS) {
    if (factor.key in record) out[factor.key] = clampRating(record[factor.key]);
  }
  return out;
}

export type ScoringConfig = {
  weights: Record<ScoreFactorKey, number>;
  hot: number;
  warm: number;
};

export const DEFAULT_SCORING: ScoringConfig = {
  weights: Object.fromEntries(SCORE_FACTORS.map((f) => [f.key, f.weight])) as Record<ScoreFactorKey, number>,
  hot: TEMPERATURE_THRESHOLDS.hot,
  warm: TEMPERATURE_THRESHOLDS.warm,
};

/** Sanitises a stored scoring config (jsonb), falling back to defaults. */
export function normalizeScoringConfig(input: unknown): ScoringConfig {
  if (!input || typeof input !== "object") return DEFAULT_SCORING;
  const raw = input as { weights?: Record<string, unknown>; hot?: unknown; warm?: unknown };
  const weights = { ...DEFAULT_SCORING.weights };
  for (const f of SCORE_FACTORS) {
    const w = Number(raw.weights?.[f.key]);
    if (Number.isFinite(w) && w >= 0 && w <= 100) weights[f.key] = w;
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const hot = Number(raw.hot);
  const warm = Number(raw.warm);
  const validThresholds = Number.isFinite(hot) && Number.isFinite(warm) && warm > 0 && hot > warm && hot <= 100;
  return {
    weights: total > 0 ? weights : DEFAULT_SCORING.weights,
    hot: validThresholds ? hot : DEFAULT_SCORING.hot,
    warm: validThresholds ? warm : DEFAULT_SCORING.warm,
  };
}

export function temperatureFor(score: number, config: Pick<ScoringConfig, "hot" | "warm"> = DEFAULT_SCORING): LeadTemperature {
  if (score >= config.hot) return "hot";
  if (score >= config.warm) return "warm";
  return "cold";
}

export function calculateOpportunityScore(factors: unknown, config: ScoringConfig = DEFAULT_SCORING): OpportunityScore {
  const clean = normalizeScoreFactors(factors);
  const totalWeight = Object.values(config.weights).reduce((a, b) => a + b, 0) || 1;
  const breakdown = SCORE_FACTORS.map((f) => {
    const rating = clean[f.key] ?? 0;
    const weight = (config.weights[f.key] / totalWeight) * 100; // normalised to 100
    return {
      key: f.key,
      label: f.label,
      rating,
      weight: Math.round(weight * 10) / 10,
      points: (weight * rating) / MAX_RATING,
    };
  });
  const score = Math.min(100, Math.max(0, Math.round(breakdown.reduce((sum, item) => sum + item.points, 0))));
  return {
    score,
    temperature: temperatureFor(score, config),
    breakdown: breakdown.map((b) => ({ ...b, points: Math.round(b.points * 10) / 10 })),
  };
}

/**
 * Suggestions derived from data already on the prospect. They are only shown as
 * hints in the form — the user confirms every rating.
 */
export function suggestScoreFactors(p: {
  contact_name?: string | null;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  observed_problem?: string | null;
}): Partial<Record<ScoreFactorKey, { rating: FactorRating; reason: string }>> {
  const out: Partial<Record<ScoreFactorKey, { rating: FactorRating; reason: string }>> = {};
  const has = (v?: string | null) => Boolean(v && v.trim());

  const direct = [p.email, p.phone, p.whatsapp].filter(has).length;
  const social = [p.linkedin_url, p.instagram_url].filter(has).length;
  if (direct >= 2) out.contact_info = { rating: 3, reason: "Email/phone/WhatsApp recorded" };
  else if (direct === 1) out.contact_info = { rating: 2, reason: "One direct contact recorded" };
  else if (social > 0) out.contact_info = { rating: 1, reason: "Only social profiles recorded" };
  else out.contact_info = { rating: 0, reason: "No contact details recorded" };

  const title = (p.job_title ?? "").toLowerCase();
  const seniority = /(founder|owner|ceo|director|partner|proprietor|md\b|managing|head|principal)/;
  if (has(p.contact_name) && seniority.test(title)) {
    out.decision_maker = { rating: 3, reason: `Contact is ${p.job_title}` };
  } else if (has(p.contact_name)) {
    out.decision_maker = { rating: 1, reason: "Contact known, role unclear" };
  }

  if (has(p.observed_problem)) {
    out.clear_problem = { rating: 2, reason: "Observed problem recorded" };
  }
  return out;
}
