import { calculateOpportunityScore, type ScoringConfig } from "@/lib/domain/opportunity-score";
import { computeDuplicateKeys, findDuplicates, type DuplicateCandidate, type DuplicateKeys } from "@/lib/domain/duplicates";
import { prospectSchema } from "@/lib/validation/schemas";
import { AppError, must } from "./errors";
import type { Db, TablesInsert } from "./types";

/** Existing prospects that match each set of keys (archived included). */
export async function matchExistingProspects(db: Db, keysList: DuplicateKeys[]) {
  const candidates = must(
    await db
      .from("prospects")
      .select("id, business_name, location, stage, archived_at, website_domain, email_normalized, phone_normalized, whatsapp_normalized, name_location_key")
      .limit(20000),
  ) as DuplicateCandidate[];
  return keysList.map((keys) => findDuplicates(keys, candidates).map((m) => ({ id: m.prospect.id, business_name: m.prospect.business_name, reasons: m.reasons })));
}

export type ImportInputRow = {
  business_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedin_url?: string;
  instagram_url?: string;
  industry?: string;
  location?: string;
  lead_source: string;
  research_notes?: string;
};

/**
 * Inserts the confirmed rows. Each row is re-validated with the same schema as
 * the prospect form; invalid rows are reported and skipped, never half-imported.
 */
export async function importProspects(db: Db, rows: ImportInputRow[], opts: { allowedSources: Set<string>; scoring: ScoringConfig }) {
  const inserts: TablesInsert<"prospects">[] = [];
  const skipped: { row: number; error: string }[] = [];
  rows.forEach((r, i) => {
    const parsed = prospectSchema.safeParse({
      ...r,
      lead_source: opts.allowedSources.has(r.lead_source) ? r.lead_source : "other",
      prospect_type: "direct_business",
    });
    if (!parsed.success) {
      skipped.push({ row: i + 1, error: parsed.error.issues[0]?.message ?? "Invalid row" });
      return;
    }
    const { score_factors, ...values } = parsed.data;
    const score = calculateOpportunityScore(score_factors, opts.scoring);
    inserts.push({ ...values, ...computeDuplicateKeys(values), score_factors, opportunity_score: score.score, lead_temperature: score.temperature });
  });
  if (!inserts.length) throw new AppError(skipped[0] ? `No valid rows: ${skipped[0].error}` : "Nothing to import");
  const created = must(await db.from("prospects").insert(inserts, { defaultToNull: false }).select("id"));
  must(
    await db
      .from("activities")
      .insert(created.map((c) => ({ prospect_id: c.id, activity_type: "prospect_created" as const, title: "Prospect imported from CSV" })), { defaultToNull: false })
      .select("id"),
  );
  return { imported: created.length, skipped };
}
