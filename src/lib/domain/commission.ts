// Commission REFERENCE. The default tiers are shown for guidance only: every
// opportunity stores the percentage actually agreed for that project, and
// commission is calculated from that agreed percentage — never from the tier.

import { toNumber } from "./money";

export type CommissionTier = {
  tier_name: string;
  min_amount: string | number;
  max_amount: string | number | null;
  percentage: string | number;
};

export const DEFAULT_COMMISSION_TIERS: CommissionTier[] = [
  { tier_name: "Small", min_amount: 25000, max_amount: 100000, percentage: 12 },
  { tier_name: "Medium", min_amount: 100000, max_amount: 500000, percentage: 10 },
  { tier_name: "Large", min_amount: 500000, max_amount: null, percentage: 7 },
];

export const COMMISSION_EXCLUSIONS = [
  "GST",
  "Hosting",
  "Domains",
  "Paid APIs",
  "Software licenses",
  "Third-party / external services",
  "Other agreed pass-through costs",
];

/** Reference tier for an amount (ranges are [min, max)). Null below the lowest tier. */
export function referenceTier(
  amount: string | number | null | undefined,
  tiers: CommissionTier[] = DEFAULT_COMMISSION_TIERS,
): CommissionTier | null {
  const n = toNumber(amount);
  if (n === null || n < 0) return null;
  const sorted = [...tiers].sort((a, b) => Number(a.min_amount) - Number(b.min_amount));
  for (const tier of sorted) {
    const min = Number(tier.min_amount);
    const max = tier.max_amount === null ? Number.POSITIVE_INFINITY : Number(tier.max_amount);
    if (n >= min && n < max) return tier;
  }
  return null;
}

export class InvalidCommissionError extends Error {}

/**
 * Commission on money actually received by BharatCoder, using the AGREED
 * percentage. Returns rupees rounded to the paisa (computed in integer paise).
 */
export function commissionOnReceived(
  eligibleAmountReceived: string | number | null | undefined,
  agreedPct: string | number | null | undefined,
): number | null {
  const received = toNumber(eligibleAmountReceived);
  const pct = toNumber(agreedPct);
  if (pct === null) return null; // no agreed percentage yet → do not guess
  if (received === null) return 0;
  if (received < 0) throw new InvalidCommissionError("Received amount cannot be negative");
  if (pct < 0 || pct > 100) throw new InvalidCommissionError("Percentage must be between 0 and 100");
  const receivedPaise = BigInt(Math.round(received * 100));
  const bps = BigInt(Math.round(pct * 100)); // basis points of a percent (2 decimals)
  const commissionPaise = (receivedPaise * bps + 5000n) / 10000n;
  return Number(commissionPaise) / 100;
}

/** Commission still owed = earned so far − already paid (never negative). */
export function commissionOutstanding(earned: number | null, paid: string | number | null | undefined): number | null {
  if (earned === null) return null;
  const p = toNumber(paid) ?? 0;
  return Math.max(0, Math.round((earned - p) * 100) / 100);
}
