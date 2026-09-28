// Money helpers. Amounts are stored as numeric(14,2) and passed to the database
// as strings with exactly two decimals — never as floating-point arithmetic results.

export const MAX_AMOUNT = 999_999_999_999.99;

export class InvalidMoneyError extends Error {}

const SUFFIXES: Record<string, bigint> = {
  k: 1_000n,
  l: 100_000n,
  lac: 100_000n,
  lakh: 100_000n,
  lakhs: 100_000n,
  cr: 10_000_000n,
  crore: 10_000_000n,
};

/**
 * Parses user input such as "150000", "1,50,000", "₹1.5L", "2 lakh", "75k", "1.2cr".
 * Returns a decimal string with two places ("150000.00"), or null for empty input.
 * Uses integer (paise) arithmetic so no floating-point rounding can occur.
 */
export function parseMoney(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim().toLowerCase();
  if (!raw) return null;
  const cleaned = raw.replace(/[₹,\s]/g, "").replace(/^rs\.?/, "").replace(/^inr/, "");
  const match = /^(\d+)(?:\.(\d+))?([a-z]*)$/.exec(cleaned);
  if (!match) throw new InvalidMoneyError("Enter an amount like 150000, 1,50,000 or 1.5L");
  const [, whole, fraction = "", suffix] = match;
  const multiplier = suffix ? SUFFIXES[suffix] : 1n;
  if (!multiplier) throw new InvalidMoneyError(`Unknown unit "${suffix}" (use K, L or Cr)`);

  // value in paise = (whole + fraction) * multiplier * 100, exactly
  const scale = 10n ** BigInt(fraction.length);
  const numerator = (BigInt(whole) * scale + BigInt(fraction || "0")) * multiplier * 100n;
  const paise = (numerator + scale / 2n) / scale; // round half up
  if (paise > BigInt(Math.round(MAX_AMOUNT * 100))) {
    throw new InvalidMoneyError("Amount is too large");
  }
  const rupees = paise / 100n;
  const rest = (paise % 100n).toString().padStart(2, "0");
  return `${rupees}.${rest}`;
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(value: string | number | null | undefined): string {
  const n = toNumber(value);
  return n === null ? "—" : inr.format(n);
}

/** Compact Indian notation: ₹75K, ₹1.5L, ₹2Cr. */
export function formatINRCompact(value: string | number | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return "—";
  const trim = (x: number) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, "");
  if (n >= 10_000_000) return `₹${trim(n / 10_000_000)}Cr`;
  if (n >= 100_000) return `₹${trim(n / 100_000)}L`;
  if (n >= 1_000) return `₹${trim(n / 1_000)}K`;
  return `₹${trim(n)}`;
}

export function formatBudgetRange(
  min: string | number | null | undefined,
  max: string | number | null | undefined,
): string {
  const lo = toNumber(min);
  const hi = toNumber(max);
  if (lo === null && hi === null) return "Not discussed";
  if (lo !== null && hi !== null) {
    if (lo === hi) return formatINRCompact(lo);
    return `${formatINRCompact(lo)}–${formatINRCompact(hi).replace("₹", "")}`;
  }
  if (lo !== null) return `${formatINRCompact(lo)}+`;
  return `Up to ${formatINRCompact(hi)}`;
}

/** Sums decimal strings exactly (via paise). */
export function sumMoney(values: Array<string | number | null | undefined>): number {
  let paise = 0n;
  for (const v of values) {
    const n = toNumber(v);
    if (n !== null) paise += BigInt(Math.round(n * 100));
  }
  return Number(paise) / 100;
}
