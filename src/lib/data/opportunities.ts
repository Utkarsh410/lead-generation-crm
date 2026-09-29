import type { z } from "zod";
import { planOpportunityStageChange, StageChangeError } from "@/lib/domain/pipeline";
import type { StageKey } from "@/lib/domain/constants";
import type { opportunityCreateSchema, opportunityUpdateSchema } from "@/lib/validation/schemas";
import { AppError, check, maybe, must } from "./errors";
import { logActivity } from "./activities";
import { applyTaskChanges } from "./tasks";
import { getProspectOrThrow } from "./prospects";
import { getDefaultPipeline, stageByKey } from "./workspace";
import type { Db } from "./types";

export const OPPORTUNITY_SELECT =
  "*, prospects(id, business_name, contact_name, industry, stage, archived_at, lead_source, is_demo, lead_temperature, opportunity_score), services(id, name), partners(id, name), pipeline_stages(id, key, label, color, kind, probability, sort_order)";

export async function listOpportunities(
  db: Db,
  filters: {
    prospectId?: string;
    stageId?: string;
    serviceId?: string;
    partnerId?: string;
    deliveryModel?: string;
    revenueModel?: string;
    status?: "open" | "won" | "lost";
    q?: string;
    from?: string;
    to?: string;
  } = {},
) {
  let q = db.from("opportunities").select(OPPORTUNITY_SELECT).order("updated_at", { ascending: false }).limit(1000);
  if (filters.prospectId) q = q.eq("prospect_id", filters.prospectId);
  if (filters.stageId) q = q.eq("stage_id", filters.stageId);
  if (filters.serviceId) q = q.eq("service_id", filters.serviceId);
  if (filters.partnerId) q = q.eq("partner_id", filters.partnerId);
  if (filters.deliveryModel) q = q.eq("delivery_model", filters.deliveryModel as never);
  if (filters.revenueModel) q = q.eq("revenue_model", filters.revenueModel as never);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.q) q = q.ilike("title", `%${filters.q.replace(/[%_*]/g, " ")}%`);
  if (filters.from) q = q.gte("created_at", `${filters.from}T00:00:00Z`);
  if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59Z`);
  const rows = must(await q);
  // archived prospects' deals are hidden everywhere except their own page
  return filters.prospectId ? rows : rows.filter((r) => !r.prospects?.archived_at);
}

export type OpportunityRow = Awaited<ReturnType<typeof listOpportunities>>[number];

export async function getOpportunity(db: Db, id: string) {
  return maybe(await db.from("opportunities").select(OPPORTUNITY_SELECT).eq("id", id).maybeSingle());
}

type CreateInput = Partial<z.output<typeof opportunityCreateSchema>> & {
  prospect_id: string;
  title: string;
  stageKey?: StageKey;
};

export async function createOpportunity(db: Db, input: CreateInput, today: string, opts: { reason?: string } = {}) {
  const prospect = await getProspectOrThrow(db, input.prospect_id);
  if (prospect.archived_at) throw new AppError("This prospect is archived. Restore it first.");
  const pipeline = await getDefaultPipeline(db);
  const { stageKey, stage_id, ...fields } = input;
  const stage = stage_id ? pipeline.stages.find((s) => s.id === stage_id) : stageByKey(pipeline, stageKey ?? "new");
  if (!stage) throw new AppError("Unknown pipeline stage.");

  const row = must(
    await db
      .from("opportunities")
      .insert({ ...fields, pipeline_id: pipeline.id, stage_id: stage.id, probability: fields.probability ?? null })
      .select("id")
      .single(),
  );
  await logActivity(db, {
    prospect_id: prospect.id,
    activity_type: "opportunity",
    title: `Opportunity created: ${input.title}`,
    details: opts.reason ?? `Stage: ${stage.label}`,
    metadata: { opportunity_id: row.id },
  });
  void today;
  return row;
}

export async function updateOpportunity(db: Db, values: z.output<typeof opportunityUpdateSchema>) {
  const existing = maybe(await db.from("opportunities").select("id, prospect_id").eq("id", values.id).maybeSingle());
  if (!existing) throw new AppError("Opportunity not found.");
  const { id, ...fields } = values;
  check(await db.from("opportunities").update(fields).eq("id", id));
  await logActivity(db, { prospect_id: existing.prospect_id, activity_type: "opportunity", title: `Opportunity updated: ${fields.title}` });
}

/** Moves an opportunity to another stage and applies reminder side effects. */
export async function moveOpportunity(
  db: Db,
  input: { id: string; stage_id: string; discovery_call_date?: string | null; discovery_call_time?: string | null; lost_reason?: string | null },
  today: string,
) {
  const opp = maybe(
    await db.from("opportunities").select("id, title, prospect_id, pipeline_id, stage_id").eq("id", input.id).maybeSingle(),
  );
  if (!opp) throw new AppError("Opportunity not found.");
  const prospect = await getProspectOrThrow(db, opp.prospect_id);
  if (prospect.archived_at) throw new AppError("This prospect is archived. Restore it first.");
  const to = maybe(
    await db.from("pipeline_stages").select("id, pipeline_id, key, label, kind").eq("id", input.stage_id).maybeSingle(),
  );
  if (!to || to.pipeline_id !== opp.pipeline_id) throw new AppError("That stage isn't part of this opportunity's pipeline.");

  const openTasks = must(
    await db
      .from("tasks")
      .select("id, task_type, status, is_automated, sequence_step")
      .eq("opportunity_id", opp.id)
      .in("status", ["pending", "snoozed"]),
  );

  let plan;
  try {
    plan = planOpportunityStageChange({
      opportunityName: `${prospect.business_name} — ${opp.title}`,
      fromStageId: opp.stage_id,
      toStageId: to.id,
      to: { key: to.key, kind: to.kind, label: to.label },
      prospectStatus: prospect.stage,
      today,
      openTasks,
      discoveryCall: input.discovery_call_date ? { date: input.discovery_call_date, time: input.discovery_call_time ?? null } : null,
    });
  } catch (e) {
    if (e instanceof StageChangeError) throw new AppError(e.message);
    throw e;
  }

  check(
    await db
      .from("opportunities")
      .update({ stage_id: to.id, lost_reason: to.kind === "lost" ? (input.lost_reason ?? null) : null })
      .eq("id", opp.id),
  );
  if (to.kind === "lost" && input.lost_reason) {
    await logActivity(db, { prospect_id: prospect.id, activity_type: "note", title: `Lost: ${opp.title}`, details: input.lost_reason });
  }
  await applyTaskChanges(db, prospect.id, { create: plan.createTasks, cancel: plan.cancelTaskIds, opportunityId: opp.id });
  if (plan.leadStatus) check(await db.from("prospects").update({ stage: plan.leadStatus }).eq("id", prospect.id));
  return { stage: to.label, suggestClient: plan.suggestClient, prospectId: prospect.id };
}

export async function deleteOpportunity(db: Db, id: string) {
  const opp = maybe(await db.from("opportunities").select("id, prospect_id, title").eq("id", id).maybeSingle());
  if (!opp) throw new AppError("Opportunity not found.");
  const { count } = await db.from("projects").select("id", { count: "exact", head: true }).eq("opportunity_id", id);
  if (count) throw new AppError("This opportunity has a project. Remove the project link first, or mark the opportunity Lost instead.");
  check(await db.from("opportunities").delete().eq("id", id));
  await logActivity(db, { prospect_id: opp.prospect_id, activity_type: "opportunity", title: `Opportunity deleted: ${opp.title}` });
}
