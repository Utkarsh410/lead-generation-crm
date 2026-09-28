import { computeDuplicateKeys, findDuplicates, hasAnyDuplicateKey, type DuplicateKeys, type DuplicateMatch } from "@/lib/domain/duplicates";
import { calculateOpportunityScore } from "@/lib/domain/opportunity-score";
import type { ProspectListQuery, ProspectValues } from "@/lib/validation/schemas";
import { AppError, check, dbError, maybe, must, pgrstQuote, searchPattern } from "./errors";
import { logActivity } from "./activities";
import type { Db, TablesInsert } from "./types";

export const PAGE_SIZE = 25;

export const PROSPECT_LIST_SELECT =
  "id, business_name, contact_name, job_title, industry, prospect_type, lead_source, stage, opportunity_score, lead_temperature, potential_project, estimated_value, last_contacted_at, last_activity_at, next_follow_up_date, archived_at, is_demo, location, email, phone, created_at";

export async function listProspects(db: Db, query: ProspectListQuery) {
  const page = query.page ?? 1;
  const sort = query.sort ?? "opportunity_score";
  const ascending = (query.dir ?? (sort === "business_name" || sort === "next_follow_up_date" ? "asc" : "desc")) === "asc";

  let q = db.from("prospects").select(PROSPECT_LIST_SELECT, { count: "exact" });
  if (query.archived === "only") q = q.not("archived_at", "is", null);
  else if (query.archived !== "include") q = q.is("archived_at", null);
  if (query.stage) q = q.eq("stage", query.stage);
  if (query.type) q = q.eq("prospect_type", query.type);
  if (query.source) q = q.eq("lead_source", query.source);
  if (query.temp) q = q.eq("lead_temperature", query.temp);
  if (query.demo === "hide") q = q.eq("is_demo", false);
  if (query.demo === "only") q = q.eq("is_demo", true);
  if (query.q) {
    const p = searchPattern(query.q);
    q = q.or(
      ["business_name", "contact_name", "email", "industry", "location", "phone"].map((c) => `${c}.ilike.${p}`).join(","),
    );
  }
  q = q.order(sort, { ascending, nullsFirst: false }).order("created_at", { ascending: false });
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
  if (error) {
    // requesting a page past the end returns 416 → treat as empty
    if (error.code === "PGRST103") return { rows: [], total: count ?? 0, page, pageSize: PAGE_SIZE };
    throw dbError(error);
  }
  return { rows: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export type ProspectListRow = Awaited<ReturnType<typeof listProspects>>["rows"][number];

export async function getProspect(db: Db, id: string) {
  return maybe(await db.from("prospects").select("*").eq("id", id).maybeSingle());
}

export type ProspectRow = NonNullable<Awaited<ReturnType<typeof getProspect>>>;

export async function getProspectOrThrow(db: Db, id: string) {
  const p = await getProspect(db, id);
  if (!p) throw new AppError("Prospect not found.");
  return p;
}

/** Potential duplicates among the user's prospects (archived included). */
export async function findDuplicateProspects(db: Db, keys: DuplicateKeys, excludeId?: string): Promise<DuplicateMatch[]> {
  if (!hasAnyDuplicateKey(keys)) return [];
  const filters: string[] = [];
  if (keys.website_domain) filters.push(`website_domain.eq.${pgrstQuote(keys.website_domain)}`);
  if (keys.email_normalized) filters.push(`email_normalized.eq.${pgrstQuote(keys.email_normalized)}`);
  for (const phone of new Set([keys.phone_normalized, keys.whatsapp_normalized].filter(Boolean) as string[])) {
    filters.push(`phone_normalized.eq.${pgrstQuote(phone)}`, `whatsapp_normalized.eq.${pgrstQuote(phone)}`);
  }
  if (keys.name_location_key) filters.push(`name_location_key.eq.${pgrstQuote(keys.name_location_key)}`);
  const candidates = must(
    await db
      .from("prospects")
      .select("id, business_name, location, stage, archived_at, website_domain, email_normalized, phone_normalized, whatsapp_normalized, name_location_key")
      .or(filters.join(","))
      .limit(20),
  );
  return findDuplicates(keys, candidates, excludeId);
}

function toRow(values: Omit<ProspectValues, "score_factors"> & { score_factors?: ProspectValues["score_factors"] }) {
  const { score_factors = {}, ...rest } = values as ProspectValues;
  const score = calculateOpportunityScore(score_factors);
  const keys = computeDuplicateKeys(rest);
  const row: TablesInsert<"prospects"> = {
    ...rest,
    ...keys,
    score_factors,
    opportunity_score: score.score,
    lead_temperature: score.temperature,
  };
  return { row, keys, score };
}

export type SaveProspectResult =
  | { status: "saved"; id: string }
  | { status: "duplicates"; duplicates: DuplicateMatch[] };

export async function createProspect(
  db: Db,
  values: ProspectValues,
  opts: { confirmDuplicate: boolean; firstOutreachDue?: string | null },
): Promise<SaveProspectResult> {
  const { row, keys } = toRow(values);
  if (!opts.confirmDuplicate) {
    const duplicates = await findDuplicateProspects(db, keys);
    if (duplicates.length) return { status: "duplicates", duplicates };
  }
  const created = must(await db.from("prospects").insert(row).select("id").single());
  await logActivity(db, {
    prospect_id: created.id,
    activity_type: "prospect_created",
    title: "Prospect added",
    details: opts.confirmDuplicate ? "Created after reviewing a potential duplicate." : null,
  });
  if (opts.firstOutreachDue) {
    check(
      await db.from("tasks").insert({
        prospect_id: created.id,
        task_type: "first_outreach",
        title: `First outreach — ${values.business_name}`,
        due_date: opts.firstOutreachDue,
        priority: "medium",
      }),
    );
  }
  return { status: "saved", id: created.id };
}

export async function updateProspect(
  db: Db,
  id: string,
  values: ProspectValues,
  opts: { confirmDuplicate: boolean },
): Promise<SaveProspectResult> {
  const existing = await getProspectOrThrow(db, id);
  const { row, keys } = toRow(values);
  const keysChanged =
    keys.website_domain !== existing.website_domain ||
    keys.email_normalized !== existing.email_normalized ||
    keys.phone_normalized !== existing.phone_normalized ||
    keys.whatsapp_normalized !== existing.whatsapp_normalized ||
    keys.name_location_key !== existing.name_location_key;
  if (keysChanged && !opts.confirmDuplicate) {
    const duplicates = await findDuplicateProspects(db, keys, id);
    if (duplicates.length) return { status: "duplicates", duplicates };
  }
  check(await db.from("prospects").update(row).eq("id", id));

  const scoreChanged = existing.opportunity_score !== row.opportunity_score;
  await logActivity(db, {
    prospect_id: id,
    activity_type: "prospect_updated",
    title: "Prospect details updated",
    details: scoreChanged ? `Opportunity score ${existing.opportunity_score} → ${row.opportunity_score}` : null,
  });
  return { status: "saved", id };
}

/** Archive or restore. Archiving cancels open follow-ups so they leave the task lists. */
export async function setArchived(db: Db, ids: string[], archived: boolean): Promise<number> {
  if (!ids.length) return 0;
  const rows = must(
    await db
      .from("prospects")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .in("id", ids)
      .select("id"),
  );
  for (const { id } of rows) {
    if (archived) {
      const open = must(
        await db.from("tasks").update({ status: "cancelled" }).eq("prospect_id", id).in("status", ["pending", "snoozed"]).select("id"),
      );
      await logActivity(db, {
        prospect_id: id,
        activity_type: "archived",
        title: "Prospect archived",
        details: open.length ? `${open.length} open follow-up(s) cancelled.` : null,
      });
    } else {
      await logActivity(db, { prospect_id: id, activity_type: "restored", title: "Prospect restored" });
    }
  }
  return rows.length;
}

export async function saveRecommendedServices(db: Db, id: string, services: string[]) {
  check(await db.from("prospects").update({ recommended_services: services }).eq("id", id));
  await logActivity(db, {
    prospect_id: id,
    activity_type: "prospect_updated",
    title: "Recommended services updated",
    details: services.join(", ") || "Cleared",
  });
}

/** Minimal list for pickers (e.g. outreach composer, new task). */
export async function listProspectOptions(db: Db) {
  return must(
    await db
      .from("prospects")
      .select("id, business_name, contact_name, stage")
      .is("archived_at", null)
      .order("business_name")
      .limit(1000),
  );
}
