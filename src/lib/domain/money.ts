// Money helpers. Amounts are stored as numeric(14,2) and passed to the database
// as strings with exactly two decimals — never as floating-point arithmetic results.

export const MAX_AMOUNT = 999_999_999_999.99;

export class InvalidMoneyError extends Error {}

// Indian (L, Cr) and international (K, M) shorthand are both accepted.
const SUFFIXES: Record<string, bigint> = {
  k: 1_000n,
  l: 100_000n,
  lac: 100_000n,
  lakh: 100_000n,
  lakhs: 100_000n,
  cr: 10_000_000n,
  crore: 10_000_000n,
  m: 1_000_000n,
  mn: 1_000_000n,
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
  const cleaned = raw.replace(/[₹$€£,\s]/g, "").replace(/^rs\.?/, "").replace(/^inr/, "");
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

export const DEFAULT_CURRENCY = "INR";

const fullFormatters = new Map<string, Intl.NumberFormat>();
function fullFormatter(currency: string) {
  let f = fullFormatters.get(currency);
  if (!f) {
    const locale = currency === "INR" ? "en-IN" : "en-US";
    try {
      f = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });
    } catch {
      f = new Intl.NumberFormat("en-IN", { style: "currency", currency: DEFAULT_CURRENCY, maximumFractionDigits: 0 });
    }
    fullFormatters.set(currency, f);
  }
  return f;
}

export function currencySymbol(currency: string = DEFAULT_CURRENCY): string {
  const part = fullFormatter(currency).formatToParts(0).find((p) => p.type === "currency");
  return part?.value ?? currency;
}

export function formatMoney(value: string | number | null | undefined, currency: string = DEFAULT_CURRENCY): string {
  const n = toNumber(value);
  return n === null ? "—" : fullFormatter(currency).format(n);
}

/** Compact: ₹75K, ₹1.5L, ₹2Cr for INR; $75K, $1.5M for other currencies. */
export function formatMoneyCompact(value: string | number | null | undefined, currency: string = DEFAULT_CURRENCY): string {
  const n = toNumber(value);
  if (n === null) return "—";
  const sym = currencySymbol(currency);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const trim = (x: number) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, "");
  if (currency === "INR") {
    if (abs >= 10_000_000) return `${sign}${sym}${trim(abs / 10_000_000)}Cr`;
    if (abs >= 100_000) return `${sign}${sym}${trim(abs / 100_000)}L`;
  } else {
    if (abs >= 1_000_000_000) return `${sign}${sym}${trim(abs / 1_000_000_000)}B`;
    if (abs >= 1_000_000) return `${sign}${sym}${trim(abs / 1_000_000)}M`;
  }
  if (abs >= 1_000) return `${sign}${sym}${trim(abs / 1_000)}K`;
  return `${sign}${sym}${trim(abs)}`;
}

export function formatBudgetRange(
  min: string | number | null | undefined,
  max: string | number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  const lo = toNumber(min);
  const hi = toNumber(max);
  if (lo === null && hi === null) return "Not discussed";
  const sym = currencySymbol(currency);
  if (lo !== null && hi !== null) {
    if (lo === hi) return formatMoneyCompact(lo, currency);
    return `${formatMoneyCompact(lo, currency)}–${formatMoneyCompact(hi, currency).replace(sym, "")}`;
  }
  if (lo !== null) return `${formatMoneyCompact(lo, currency)}+`;
  return `Up to ${formatMoneyCompact(hi, currency)}`;
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
