// Partners, services, lookups, pipeline stages and qualification questions —
// the user's own configuration.

import type { z } from "zod";
import { serviceSchema } from "@/lib/validation/schemas";
import type { lookupSchema, partnerSchema, pipelineStageSchema, qualificationQuestionSchema } from "@/lib/validation/schemas";
import { AppError, check, maybe, must } from "./errors";
import { getDefaultPipeline, slugify } from "./workspace";
import type { Db } from "./types";

// ---------------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------------

export async function listPartners(db: Db, opts: { status?: string; type?: string; q?: string } = {}) {
  let q = db
    .from("partners")
    .select("*, opportunities(id, status), projects(id, status, total_project_value)")
    .order("name")
    .limit(1000);
  if (opts.status) q = q.eq("status", opts.status as never);
  if (opts.type) q = q.eq("partner_type", opts.type as never);
  if (opts.q) q = q.ilike("name", `%${opts.q.replace(/[%_*]/g, " ")}%`);
  return must(await q);
}

export async function getPartner(db: Db, id: string) {
  return maybe(await db.from("partners").select("*").eq("id", id).maybeSingle());
}

export async function savePartner(db: Db, values: z.output<typeof partnerSchema>, id?: string) {
  if (id) {
    const rows = must(await db.from("partners").update(values).eq("id", id).select("id"));
    if (!rows.length) throw new AppError("Partner not found.");
    return { id };
  }
  return must(await db.from("partners").insert(values).select("id").single());
}

export async function deletePartner(db: Db, id: string) {
  const [{ count: projects }, { count: opps }] = await Promise.all([
    db.from("projects").select("id", { count: "exact", head: true }).eq("partner_id", id),
    db.from("opportunities").select("id", { count: "exact", head: true }).eq("partner_id", id),
  ]);
  if ((projects ?? 0) + (opps ?? 0) > 0) {
    throw new AppError("This partner is linked to opportunities or projects. Mark it Inactive instead.");
  }
  check(await db.from("partners").delete().eq("id", id));
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export async function listServices(db: Db) {
  return must(await db.from("services").select("*").order("active", { ascending: false }).order("name"));
}

export async function saveService(db: Db, values: z.output<typeof serviceSchema>, id?: string) {
  if (id) {
    const rows = must(await db.from("services").update(values).eq("id", id).select("id"));
    if (!rows.length) throw new AppError("Service not found.");
    return { id };
  }
  return must(await db.from("services").insert(values).select("id").single());
}

export async function deleteService(db: Db, id: string) {
  const [{ count: projects }, { count: opps }] = await Promise.all([
    db.from("projects").select("id", { count: "exact", head: true }).eq("service_id", id),
    db.from("opportunities").select("id", { count: "exact", head: true }).eq("service_id", id),
  ]);
  if ((projects ?? 0) + (opps ?? 0) > 0) throw new AppError("This service is used by opportunities or projects. Deactivate it instead.");
  check(await db.from("services").delete().eq("id", id));
}

/** Starter services the user can add in one click (then edit freely). No prices are assumed. */
export const STARTER_SERVICES: Array<Omit<z.input<typeof serviceSchema>, "active">> = [
  {
    name: "Business website",
    category: "web_development",
    description: "Fast, mobile-friendly website with clear calls to action.",
    target_customer: "Clinics, coaching institutes, professional services, local businesses",
    typical_problem: "No website, or a site that doesn't generate enquiries",
    pricing_model: "fixed_price",
    discovery_questions: [
      "What should a visitor do on the site (call, book, enquire, buy)?",
      "How do enquiries reach you today?",
      "Who will update content after launch?",
    ],
  },
  {
    name: "Custom web application / CRM",
    category: "software_development",
    description: "Software built around a specific workflow — CRMs, dashboards, internal tools.",
    target_customer: "Growing SMEs and operations-heavy businesses",
    typical_problem: "Work runs on spreadsheets, paper or disconnected tools",
    pricing_model: "per_project",
    discovery_questions: ["Walk me through the workflow step by step.", "Who are the users and roles?", "Which tools must it integrate with?"],
  },
  {
    name: "AI assistant / automation",
    category: "ai",
    description: "AI assistants and automated workflows with human review where needed.",
    target_customer: "Teams with repetitive questions, documents or data entry",
    typical_problem: "Hours lost to repetitive work",
    pricing_model: "custom",
    discovery_questions: ["Which repetitive task costs the most time?", "What data would the AI use?", "Who reviews the output?"],
  },
  {
    name: "Lead generation",
    category: "lead_generation",
    description: "Finding and qualifying prospects for a client or partner.",
    target_customer: "Agencies and B2B service businesses",
    typical_problem: "Not enough qualified conversations",
    pricing_model: "commission",
    discovery_questions: ["Who is your ideal client?", "What does a good lead look like?", "How do you want leads handed over?"],
  },
];

export async function addStarterServices(db: Db): Promise<number> {
  const existing = new Set((await listServices(db)).map((s) => s.name.toLowerCase()));
  const rows = STARTER_SERVICES.filter((s) => !existing.has(s.name.toLowerCase())).map((s) => serviceSchema.parse(s));
  if (!rows.length) return 0;
  must(await db.from("services").insert(rows).select("id"));
  return rows.length;
}

// ---------------------------------------------------------------------------
// Lookups (sources, industries, service categories)
// ---------------------------------------------------------------------------

export async function saveLookup(db: Db, values: z.output<typeof lookupSchema>) {
  const value = values.value ?? slugify(values.label);
  if (!value) throw new AppError("Use letters or numbers in the label.");
  must(
    await db
      .from("lookup_values")
      .upsert({ kind: values.kind, value, label: values.label, active: values.active }, { onConflict: "owner_id,kind,value" })
      .select("id"),
  );
  return { value };
}

export async function deleteLookup(db: Db, id: string) {
  check(await db.from("lookup_values").delete().eq("id", id));
}

// ---------------------------------------------------------------------------
// Pipeline stages (default pipeline)
// ---------------------------------------------------------------------------

export async function savePipelineStage(db: Db, values: z.output<typeof pipelineStageSchema>) {
  const pipeline = await getDefaultPipeline(db);
  if (values.id) {
    const stage = pipeline.stages.find((s) => s.id === values.id);
    if (!stage) throw new AppError("Stage not found.");
    if (stage.key && ["won", "lost"].includes(stage.key) && values.kind !== stage.kind) {
      throw new AppError(`The built-in ${stage.label} stage must stay “${stage.kind}”.`);
    }
    check(
      await db
        .from("pipeline_stages")
        .update({ label: values.label, color: values.color, kind: values.kind, probability: values.probability })
        .eq("id", values.id),
    );
    return { id: values.id };
  }
  const maxOrder = Math.max(0, ...pipeline.stages.map((s) => s.sort_order));
  return must(
    await db
      .from("pipeline_stages")
      .insert({ pipeline_id: pipeline.id, label: values.label, color: values.color, kind: values.kind, probability: values.probability, sort_order: maxOrder + 1 })
      .select("id")
      .single(),
  );
}

export async function reorderPipelineStages(db: Db, orderedIds: string[]) {
  const pipeline = await getDefaultPipeline(db);
  const known = new Set(pipeline.stages.map((s) => s.id));
  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
    throw new AppError("The stage list changed — reload and try again.");
  }
  for (const [i, id] of orderedIds.entries()) {
    check(await db.from("pipeline_stages").update({ sort_order: i + 1 }).eq("id", id));
  }
}

export async function deletePipelineStage(db: Db, id: string) {
  const pipeline = await getDefaultPipeline(db);
  const stage = pipeline.stages.find((s) => s.id === id);
  if (!stage) throw new AppError("Stage not found.");
  if (stage.key && ["new", "won", "lost"].includes(stage.key)) throw new AppError(`The ${stage.label} stage is required.`);
  const { count } = await db.from("opportunities").select("id", { count: "exact", head: true }).eq("stage_id", id);
  if (count) throw new AppError(`${count} opportunit${count === 1 ? "y is" : "ies are"} in this stage. Move them first.`);
  check(await db.from("pipeline_stages").delete().eq("id", id));
}

// ---------------------------------------------------------------------------
// Custom qualification questions
// ---------------------------------------------------------------------------

export async function listQualificationQuestions(db: Db, opts: { activeOnly?: boolean } = {}) {
  let q = db.from("qualification_questions").select("*").order("sort_order").order("created_at");
  if (opts.activeOnly) q = q.eq("active", true);
  return must(await q);
}

export async function saveQualificationQuestion(db: Db, values: z.output<typeof qualificationQuestionSchema>, id?: string) {
  if (id) {
    check(await db.from("qualification_questions").update(values).eq("id", id));
    return { id };
  }
  const count = (await listQualificationQuestions(db)).length;
  return must(await db.from("qualification_questions").insert({ ...values, sort_order: count + 1 }).select("id").single());
}

export async function deleteQualificationQuestion(db: Db, id: string) {
  check(await db.from("qualification_questions").delete().eq("id", id));
}
