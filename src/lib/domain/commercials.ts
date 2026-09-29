// Commercial terms and project financials. Nothing here assumes a default
// commission: every project/opportunity stores the terms that were actually
// agreed (type, percentage or fixed amount, and an explicitly chosen basis).
// All arithmetic is done in integer paise/cents — never floating point.

import type { CommissionBasis, CommissionType, PaymentFlow, PaymentStatus } from "./constants";
import { toNumber } from "./money";

export type CommercialTerms = {
  commission_type: CommissionType | null;
  commission_percentage: string | number | null;
  fixed_commission: string | number | null;
  commission_basis: CommissionBasis | null;
  commission_custom_base?: string | number | null;
};

export type ProjectMoney = CommercialTerms & {
  total_project_value: string | number | null;
  payment_flow: PaymentFlow;
  partner_cost: string | number | null;
  commission_received: string | number | null;
};

export type PaymentLike = { amount: string | number; status: PaymentStatus };

// ---------------------------------------------------------------------------
// integer money helpers
// ---------------------------------------------------------------------------

/** Rupees (string/number) → integer paise. Null/invalid → 0n. */
export function toMinor(value: string | number | null | undefined): bigint {
  const n = toNumber(value);
  if (n === null) return 0n;
  // go through a fixed 2-dp string so 0.1 + 0.2 style float noise never leaks in
  const [whole, frac = ""] = n.toFixed(2).split(".");
  const sign = whole.startsWith("-") ? -1n : 1n;
  return sign * (BigInt(whole.replace("-", "")) * 100n + BigInt(frac.padEnd(2, "0")));
}

export function fromMinor(minor: bigint): number {
  return Number(minor) / 100;
}

/** amount × pct% rounded half-up to the paisa (pct with up to 2 decimals). */
function percentOf(baseMinor: bigint, pct: string | number): bigint {
  const bps = BigInt(Math.round(Number(pct) * 100)); // 12.5% → 1250
  const raw = baseMinor * bps;
  const q = raw / 10000n;
  const r = raw % 10000n;
  return r * 2n >= 10000n ? q + 1n : q;
}

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

/** Returns human-readable problems with a set of terms (empty when valid). */
export function validateCommercialTerms(t: CommercialTerms): string[] {
  const errors: string[] = [];
  if (t.commission_type === "percentage") {
    const pct = toNumber(t.commission_percentage);
    if (pct === null) errors.push("Enter the agreed commission percentage.");
    else if (pct < 0 || pct > 100) errors.push("Commission percentage must be between 0 and 100.");
    if (!t.commission_basis) errors.push("Choose what the commission is calculated on (the basis).");
    if (t.commission_basis === "custom" && toNumber(t.commission_custom_base ?? null) === null) {
      errors.push("Enter the custom amount the commission is calculated on.");
    }
  }
  if (t.commission_type === "fixed") {
    const fixed = toNumber(t.fixed_commission);
    if (fixed === null) errors.push("Enter the fixed commission amount.");
    else if (fixed < 0) errors.push("Fixed commission cannot be negative.");
  }
  return errors;
}

// ---------------------------------------------------------------------------
// calculations
// ---------------------------------------------------------------------------

export function sumPayments(payments: PaymentLike[], status: PaymentStatus = "received"): bigint {
  return payments.filter((p) => p.status === status).reduce((sum, p) => sum + toMinor(p.amount), 0n);
}

/** The amount a percentage commission is calculated on, in minor units. */
export function commissionBaseMinor(
  basis: CommissionBasis,
  ctx: { total: bigint; received: bigint; partnerCost: bigint; customBase: bigint },
): bigint {
  switch (basis) {
    case "total_project_value":
      return ctx.total;
    case "amount_received":
      return ctx.received;
    case "net_revenue": {
      // money received minus the delivery (partner) cost, never below zero
      const net = ctx.received - ctx.partnerCost;
      return net > 0n ? net : 0n;
    }
    case "custom":
      return ctx.customBase;
  }
}

/**
 * Commission earned so far. Returns null when no terms are configured (the UI
 * shows "not set" rather than guessing).
 *  - percentage: pct × base (base chosen explicitly: total / received / net / custom)
 *  - fixed: the fixed amount; with the "Amount Received" basis it accrues in
 *    proportion to what the client has paid (capped at 100%)
 *  - none: 0
 */
export function commissionEarnedMinor(
  terms: CommercialTerms,
  ctx: { total: bigint; received: bigint; partnerCost: bigint },
): bigint | null {
  if (!terms.commission_type) return null;
  if (terms.commission_type === "none") return 0n;
  if (validateCommercialTerms(terms).length) return null;
  if (terms.commission_type === "percentage") {
    const base = commissionBaseMinor(terms.commission_basis!, { ...ctx, customBase: toMinor(terms.commission_custom_base ?? null) });
    return percentOf(base, terms.commission_percentage!);
  }
  const fixed = toMinor(terms.fixed_commission);
  if (terms.commission_basis === "amount_received") {
    if (ctx.total <= 0n) return 0n;
    const received = ctx.received > ctx.total ? ctx.total : ctx.received;
    // fixed × received / total, rounded half-up
    const raw = fixed * received;
    const q = raw / ctx.total;
    return (raw % ctx.total) * 2n >= ctx.total ? q + 1n : q;
  }
  return fixed;
}

export type ProjectFinancials = {
  total: number;
  received: number;
  expected: number;
  balanceDue: number;
  partnerCost: number;
  /** client pays me: planned margin after the partner's cost; otherwise null */
  plannedMargin: number | null;
  /** what has actually come to me so far (payments to me, or commission) */
  myRevenueToDate: number;
  commissionEarned: number | null;
  commissionReceived: number;
  commissionOutstanding: number | null;
};

export function projectFinancials(project: ProjectMoney, payments: PaymentLike[]): ProjectFinancials {
  const total = toMinor(project.total_project_value);
  const received = sumPayments(payments, "received");
  const expected = sumPayments(payments, "expected");
  const partnerCost = toMinor(project.partner_cost);
  const earned = commissionEarnedMinor(project, { total, received, partnerCost });
  const commissionReceived = toMinor(project.commission_received);
  const balance = total - received;
  const clientPaysMe = project.payment_flow === "client_pays_me";
  const myRevenue = clientPaysMe ? received + (earned ?? 0n) : (earned ?? 0n);
  const outstanding = earned === null ? null : earned - commissionReceived > 0n ? earned - commissionReceived : 0n;
  return {
    total: fromMinor(total),
    received: fromMinor(received),
    expected: fromMinor(expected),
    balanceDue: fromMinor(balance > 0n ? balance : 0n),
    partnerCost: fromMinor(partnerCost),
    plannedMargin: clientPaysMe ? fromMinor(total - partnerCost) : null,
    myRevenueToDate: fromMinor(myRevenue),
    commissionEarned: earned === null ? null : fromMinor(earned),
    commissionReceived: fromMinor(commissionReceived),
    commissionOutstanding: outstanding === null ? null : fromMinor(outstanding),
  };
}

/** Weighted pipeline value: Σ value × probability%. */
export function weightedValue(rows: { estimated_value: string | number | null; probability: number | null }[]): number {
  let minor = 0n;
  for (const r of rows) minor += percentOf(toMinor(r.estimated_value), r.probability ?? 0);
  return fromMinor(minor);
}

/** One-line human description of a set of terms, e.g. "10% of amount received". */
export function describeTerms(t: CommercialTerms, formatMoney: (v: number) => string): string {
  if (!t.commission_type) return "Not set";
  if (t.commission_type === "none") return "No commission";
  if (t.commission_type === "fixed") {
    const amount = formatMoney(toNumber(t.fixed_commission) ?? 0);
    return t.commission_basis === "amount_received" ? `${amount} fixed, accrues as client pays` : `${amount} fixed`;
  }
  const basis: Record<CommissionBasis, string> = {
    total_project_value: "total project value",
    amount_received: "amount received",
    net_revenue: "net revenue",
    custom: `a custom base of ${formatMoney(toNumber(t.commission_custom_base ?? null) ?? 0)}`,
  };
  return `${Number(t.commission_percentage)}% of ${t.commission_basis ? basis[t.commission_basis] : "?"}`;
}
