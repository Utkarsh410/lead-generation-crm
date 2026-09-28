import { toCsv, type CsvColumn } from "@/lib/domain/csv";
import {
  LEAD_SOURCES,
  OUTREACH_CHANNELS,
  OUTREACH_STAGES,
  PIPELINE_STAGES,
  PROJECT_TYPES,
  PROSPECT_TYPES,
  QUALIFICATION_CLASSES,
  RESPONSE_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  type ProjectType,
} from "@/lib/domain/constants";
import { FUNNEL_ORDER } from "@/lib/domain/constants";
import type { ProspectListQuery } from "@/lib/validation/schemas";
import { must, searchPattern } from "./errors";
import type { Db, Tables } from "./types";

export const EXPORT_KINDS = ["prospects", "qualified", "outreach", "follow-ups"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

type ProspectRow = Tables<"prospects">;

const money = (v: number | string | null) => (v === null ? "" : Number(v).toFixed(2));
const projectLabel = (v: string | null) => (v ? PROJECT_TYPES.label(v as ProjectType) : "");

export const PROSPECT_COLUMNS: CsvColumn<ProspectRow>[] = [
  { header: "Business", value: (r) => r.business_name },
  { header: "Contact", value: (r) => r.contact_name },
  { header: "Job title", value: (r) => r.job_title },
  { header: "Email", value: (r) => r.email },
  { header: "Phone", value: (r) => r.phone },
  { header: "WhatsApp", value: (r) => r.whatsapp },
  { header: "Website", value: (r) => r.website },
  { header: "LinkedIn", value: (r) => r.linkedin_url },
  { header: "Instagram", value: (r) => r.instagram_url },
  { header: "Location", value: (r) => r.location },
  { header: "Country", value: (r) => r.country },
  { header: "Industry", value: (r) => r.industry },
  { header: "Prospect type", value: (r) => PROSPECT_TYPES.label(r.prospect_type) },
  { header: "Source", value: (r) => LEAD_SOURCES.label(r.lead_source) },
  { header: "Source URL", value: (r) => r.source_url },
  { header: "Stage", value: (r) => PIPELINE_STAGES.label(r.stage) },
  { header: "Lead score", value: (r) => r.opportunity_score },
  { header: "Temperature", value: (r) => r.lead_temperature },
  { header: "Potential project", value: (r) => projectLabel(r.potential_project) },
  { header: "Estimated value (INR)", value: (r) => money(r.estimated_value) },
  { header: "Observed problem", value: (r) => r.observed_problem },
  { header: "Suggested solution", value: (r) => r.suggested_solution },
  { header: "Last contact", value: (r) => r.last_contacted_at },
  { header: "Next follow-up", value: (r) => r.next_follow_up_date },
  { header: "Archived", value: (r) => (r.archived_at ? "yes" : "no") },
  { header: "Demo", value: (r) => (r.is_demo ? "yes" : "no") },
  { header: "Created", value: (r) => r.created_at },
];

type QualifiedRow = ProspectRow & {
  qualification_assessments: Pick<
    Tables<"qualification_assessments">,
    "score" | "classification" | "project_type" | "budget_min" | "budget_max" | "timeline_notes" | "decision_maker_name" | "urgency" | "created_at"
  >[];
};

export const QUALIFIED_COLUMNS: CsvColumn<QualifiedRow>[] = [
  ...PROSPECT_COLUMNS.slice(0, 3),
  { header: "Email", value: (r) => r.email },
  { header: "Phone", value: (r) => r.phone },
  { header: "Industry", value: (r) => r.industry },
  { header: "Stage", value: (r) => PIPELINE_STAGES.label(r.stage) },
  { header: "Qualification", value: (r) => (r.qualification_assessments[0] ? QUALIFICATION_CLASSES.label(r.qualification_assessments[0].classification) : "") },
  { header: "Qualification score", value: (r) => r.qualification_assessments[0]?.score ?? "" },
  { header: "Project type", value: (r) => projectLabel(r.qualification_assessments[0]?.project_type ?? r.potential_project) },
  { header: "Budget min (INR)", value: (r) => money(r.qualification_assessments[0]?.budget_min ?? null) },
  { header: "Budget max (INR)", value: (r) => money(r.qualification_assessments[0]?.budget_max ?? null) },
  { header: "Timeline", value: (r) => r.qualification_assessments[0]?.timeline_notes },
  { header: "Decision maker", value: (r) => r.qualification_assessments[0]?.decision_maker_name },
  { header: "Urgency (1-5)", value: (r) => r.qualification_assessments[0]?.urgency ?? "" },
  { header: "Source", value: (r) => LEAD_SOURCES.label(r.lead_source) },
];

type MessageRow = Tables<"outreach_messages"> & { prospects: { business_name: string; contact_name: string | null } | null };

export const OUTREACH_COLUMNS: CsvColumn<MessageRow>[] = [
  { header: "Sent at", value: (r) => r.sent_at },
  { header: "Business", value: (r) => r.prospects?.business_name },
  { header: "Contact", value: (r) => r.prospects?.contact_name },
  { header: "Channel", value: (r) => OUTREACH_CHANNELS.label(r.channel) },
  { header: "Outreach stage", value: (r) => OUTREACH_STAGES.label(r.outreach_stage) },
  { header: "Subject", value: (r) => r.subject },
  { header: "Message", value: (r) => r.customized_message },
  { header: "Response", value: (r) => RESPONSE_STATUSES.label(r.response_status) },
  { header: "Response date", value: (r) => r.response_date },
  { header: "Response notes", value: (r) => r.response_notes },
  { header: "Notes", value: (r) => r.notes },
];

type TaskRow = Tables<"tasks"> & { prospects: { business_name: string } | null };

export const TASK_COLUMNS: CsvColumn<TaskRow>[] = [
  { header: "Due date", value: (r) => r.due_date },
  { header: "Due time", value: (r) => r.due_time },
  { header: "Business", value: (r) => r.prospects?.business_name ?? "(internal)" },
  { header: "Type", value: (r) => TASK_TYPES.label(r.task_type) },
  { header: "Title", value: (r) => r.title },
  { header: "Priority", value: (r) => TASK_PRIORITIES.label(r.priority) },
  { header: "Status", value: (r) => TASK_STATUSES.label(r.status) },
  { header: "Automated", value: (r) => (r.is_automated ? "yes" : "no") },
  { header: "Notes", value: (r) => r.notes },
  { header: "Completed at", value: (r) => r.completed_at },
];

const QUALIFIED_STAGES = FUNNEL_ORDER.slice(FUNNEL_ORDER.indexOf("qualified"));

export async function buildExport(
  db: Db,
  kind: ExportKind,
  opts: { query?: ProspectListQuery; ids?: string[] } = {},
): Promise<string> {
  switch (kind) {
    case "prospects": {
      const query = opts.query ?? {};
      let q = db.from("prospects").select("*").order("created_at", { ascending: false }).limit(10_000);
      if (opts.ids?.length) q = q.in("id", opts.ids);
      else {
        if (query.archived === "only") q = q.not("archived_at", "is", null);
        else if (query.archived !== "include") q = q.is("archived_at", null);
        if (query.stage) q = q.eq("stage", query.stage);
        if (query.type) q = q.eq("prospect_type", query.type);
        if (query.source) q = q.eq("lead_source", query.source);
        if (query.temp) q = q.eq("lead_temperature", query.temp);
        if (query.q) {
          const p = searchPattern(query.q);
          q = q.or(["business_name", "contact_name", "email", "industry", "location", "phone"].map((c) => `${c}.ilike.${p}`).join(","));
        }
      }
      return toCsv(must(await q), PROSPECT_COLUMNS);
    }
    case "qualified": {
      const rows = must(
        await db
          .from("prospects")
          .select("*, qualification_assessments(score, classification, project_type, budget_min, budget_max, timeline_notes, decision_maker_name, urgency, created_at)")
          .is("archived_at", null)
          .in("furthest_stage", QUALIFIED_STAGES as never)
          .order("updated_at", { ascending: false }),
      ) as unknown as QualifiedRow[];
      for (const r of rows) r.qualification_assessments.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return toCsv(rows, QUALIFIED_COLUMNS);
    }
    case "outreach": {
      const rows = must(
        await db.from("outreach_messages").select("*, prospects(business_name, contact_name)").order("sent_at", { ascending: false }).limit(10_000),
      );
      return toCsv(rows as MessageRow[], OUTREACH_COLUMNS);
    }
    case "follow-ups": {
      const rows = must(
        await db.from("tasks").select("*, prospects(business_name)").order("due_date", { ascending: true }).limit(10_000),
      );
      return toCsv(rows as TaskRow[], TASK_COLUMNS);
    }
  }
}
