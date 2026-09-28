// Duplicate detection: normalised keys stored on every prospect and compared on
// create/edit. Matches are *potential* duplicates — the user decides.

/** Hosts that identify a platform, not a business — never used as a duplicate key. */
const SHARED_HOSTS = new Set([
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "google.com",
  "maps.google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "wa.me",
  "linktr.ee",
  "justdial.com",
  "sites.google.com",
  "business.site",
  "wixsite.com",
  "blogspot.com",
  "wordpress.com",
]);

export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) value = `https://${value}`;
  let host: string;
  try {
    host = new URL(value).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\d*\./, "").replace(/\.$/, "");
  if (!host.includes(".") || SHARED_HOSTS.has(host)) return null;
  return host;
}

export function normalizeEmail(input: string | null | undefined): string | null {
  const value = input?.trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  return value;
}

/**
 * Phone key = last 10 digits (Indian mobile numbers with/without +91 / 0 prefix
 * collapse to the same key). Numbers with fewer than 7 digits are ignored.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

const COMPANY_SUFFIXES =
  /\b(pvt|private|ltd|limited|llp|llc|inc|co|company|corp|corporation|the|and)\b/g;

export function normalizeBusinessName(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
  return value || null;
}

export function nameLocationKey(
  businessName: string | null | undefined,
  location: string | null | undefined,
): string | null {
  const name = normalizeBusinessName(businessName);
  if (!name) return null;
  const loc = (location ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${name}|${loc}`;
}

export type DuplicateKeys = {
  website_domain: string | null;
  email_normalized: string | null;
  phone_normalized: string | null;
  whatsapp_normalized: string | null;
  name_location_key: string | null;
};

export function computeDuplicateKeys(p: {
  business_name?: string | null;
  location?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
}): DuplicateKeys {
  return {
    website_domain: normalizeDomain(p.website),
    email_normalized: normalizeEmail(p.email),
    phone_normalized: normalizePhone(p.phone),
    whatsapp_normalized: normalizePhone(p.whatsapp),
    name_location_key: nameLocationKey(p.business_name, p.location),
  };
}

export type DuplicateReason = "website" | "email" | "phone" | "name_location";

export const DUPLICATE_REASON_LABELS: Record<DuplicateReason, string> = {
  website: "Same website domain",
  email: "Same email",
  phone: "Same phone / WhatsApp",
  name_location: "Same business name + location",
};

export type DuplicateCandidate = DuplicateKeys & {
  id: string;
  business_name: string;
  location: string | null;
  stage: string;
  archived_at: string | null;
};

export type DuplicateMatch = {
  prospect: DuplicateCandidate;
  reasons: DuplicateReason[];
};

/** Compares keys of a new/edited prospect against existing candidates. */
export function findDuplicates(
  keys: DuplicateKeys,
  candidates: DuplicateCandidate[],
  excludeId?: string,
): DuplicateMatch[] {
  const phones = new Set([keys.phone_normalized, keys.whatsapp_normalized].filter(Boolean));
  const matches: DuplicateMatch[] = [];
  for (const c of candidates) {
    if (excludeId && c.id === excludeId) continue;
    const reasons: DuplicateReason[] = [];
    if (keys.website_domain && c.website_domain === keys.website_domain) reasons.push("website");
    if (keys.email_normalized && c.email_normalized === keys.email_normalized) reasons.push("email");
    if (
      (c.phone_normalized && phones.has(c.phone_normalized)) ||
      (c.whatsapp_normalized && phones.has(c.whatsapp_normalized))
    ) {
      reasons.push("phone");
    }
    if (keys.name_location_key && c.name_location_key === keys.name_location_key) {
      reasons.push("name_location");
    }
    if (reasons.length) matches.push({ prospect: c, reasons });
  }
  return matches.sort((a, b) => b.reasons.length - a.reasons.length);
}

/** Whether any key is present at all (nothing to compare otherwise). */
export function hasAnyDuplicateKey(keys: DuplicateKeys): boolean {
  return Object.values(keys).some(Boolean);
}
