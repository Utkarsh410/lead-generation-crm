// CSV prospect import: maps spreadsheet columns onto prospect fields, validates
// each row and flags duplicates inside the file. (Duplicates against existing
// prospects are checked on the server with the same keys.)

import { computeDuplicateKeys, type DuplicateKeys } from "./duplicates";

export const IMPORT_FIELDS = [
  { key: "business_name", label: "Business", aliases: ["business", "business name", "company", "company name", "organisation", "organization", "account"] },
  { key: "contact_name", label: "Contact", aliases: ["contact", "contact name", "name", "full name", "person"] },
  { key: "email", label: "Email", aliases: ["email", "email address", "e-mail", "mail"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phone number", "mobile", "telephone", "tel", "whatsapp"] },
  { key: "website", label: "Website", aliases: ["website", "url", "site", "web", "domain"] },
  { key: "linkedin_url", label: "LinkedIn", aliases: ["linkedin", "linkedin url", "linkedin profile"] },
  { key: "instagram_url", label: "Instagram", aliases: ["instagram", "instagram url", "ig"] },
  { key: "industry", label: "Industry", aliases: ["industry", "sector", "category", "niche"] },
  { key: "location", label: "Location", aliases: ["location", "city", "address", "area", "town"] },
  { key: "lead_source", label: "Source", aliases: ["source", "lead source", "channel"] },
  { key: "research_notes", label: "Notes", aliases: ["notes", "note", "comments", "description"] },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
export type ColumnMapping = Partial<Record<ImportField, number>>;

const norm = (s: string) => s.trim().toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ");

/** Guesses which column holds each field from the header row. */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  for (const field of IMPORT_FIELDS) {
    const aliases = field.aliases.map(norm);
    const idx = headers.findIndex((h, i) => !used.has(i) && aliases.includes(norm(h)));
    if (idx !== -1) {
      mapping[field.key] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

export type ImportRow = {
  /** 1-based row number in the file (header = row 1) */
  rowNumber: number;
  values: Partial<Record<ImportField, string>>;
  sourceKey: string;
  keys: DuplicateKeys;
  errors: string[];
  warnings: string[];
  /** Earlier row in the same file with the same business/domain/email/phone. */
  duplicateOfRow: number | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param resolveSource maps a free-text source ("Google Maps", "google_maps",
 *   custom labels…) to a source key, or null when unknown.
 */
export function prepareImportRows(
  rows: string[][],
  mapping: ColumnMapping,
  resolveSource: (text: string) => string | null,
  opts: { maxRows?: number } = {},
): ImportRow[] {
  const max = opts.maxRows ?? 1000;
  const out: ImportRow[] = [];
  const seen = new Map<string, number>();
  rows.slice(0, max).forEach((cells, i) => {
    const values: Partial<Record<ImportField, string>> = {};
    for (const field of IMPORT_FIELDS) {
      const col = mapping[field.key];
      if (col === undefined) continue;
      const v = (cells[col] ?? "").trim();
      if (v) values[field.key] = v;
    }
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!values.business_name) errors.push("Business name is missing");
    else if (values.business_name.length > 200) errors.push("Business name is longer than 200 characters");
    if (values.email && !EMAIL.test(values.email)) errors.push(`Invalid email "${values.email}"`);
    if (values.phone) {
      const digits = values.phone.replace(/\D/g, "").length;
      if (digits < 7 || digits > 15) errors.push(`Phone "${values.phone}" needs 7–15 digits`);
    }
    let sourceKey = "other";
    if (values.lead_source) {
      const resolved = resolveSource(values.lead_source);
      if (resolved) sourceKey = resolved;
      else warnings.push(`Unknown source "${values.lead_source}" — imported as Other`);
    }
    if (!values.email && !values.phone && !values.linkedin_url && !values.instagram_url && !values.website) {
      warnings.push("No contact details");
    }
    const keys = computeDuplicateKeys({
      business_name: values.business_name,
      location: values.location,
      website: values.website,
      email: values.email,
      phone: values.phone,
    });
    let duplicateOfRow: number | null = null;
    for (const k of [keys.website_domain && `d:${keys.website_domain}`, keys.email_normalized && `e:${keys.email_normalized}`, keys.phone_normalized && `p:${keys.phone_normalized}`, keys.name_location_key && `n:${keys.name_location_key}`]) {
      if (!k) continue;
      if (seen.has(k) && duplicateOfRow === null) duplicateOfRow = seen.get(k)!;
      if (!seen.has(k)) seen.set(k, i + 2);
    }
    out.push({ rowNumber: i + 2, values, sourceKey, keys, errors, warnings, duplicateOfRow });
  });
  return out;
}

/** Builds a case/format-insensitive resolver from source keys and labels. */
export function sourceResolver(sources: { value: string; label: string }[]): (text: string) => string | null {
  const map = new Map<string, string>();
  for (const s of sources) {
    map.set(norm(s.value), s.value);
    map.set(norm(s.label), s.value);
  }
  return (text) => map.get(norm(text)) ?? null;
}
