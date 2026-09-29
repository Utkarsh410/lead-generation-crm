import { toCsv, type CsvColumn } from "@/lib/domain/csv";
import {
  OUTREACH_CHANNELS,
  OUTREACH_STAGES,
  LEAD_STATUSES,
  DELIVERY_MODELS,
  REVENUE_MODELS,
  COMMISSION_TYPES,
  COMMISSION_BASES,
  PROJECT_STATUSES,
  PAYMENT_TYPES,
  PAYMENT_STATUSES,
  PAYMENT_FLOWS,
  CLIENT_STATUSES,
  PARTNER_TYPES,
  PARTNER_STATUSES,
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

export const EXPORT_KINDS = ["prospects", "qualified", "outreach", "follow-ups", "opportunities", "clients", "projects", "payments", "partners"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

type ProspectRow = Tables<"prospects">;

const money = (v: number | string | null) => (v === null ? "" : Number(v).toFixed(2));
const projectLabel = (v: string | null) => (v ? PROJECT_TYPES.label(v as ProjectType) : "");

type SourceLabel = (source: string) => string;
const defaultSourceLabel: SourceLabel = (s) => s.replace(/_/g, " ");

/** Prospect columns; `sourceLabel` resolves the user's (custom) source labels. */
export const prospectColumns = (sourceLabel: SourceLabel = defaultSourceLabel): CsvColumn<ProspectRow>[] => [
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
  { header: "Source", value: (r) => sourceLabel(r.lead_source) },
  { header: "Source URL", value: (r) => r.source_url },
  { header: "Lead status", value: (r) => LEAD_STATUSES.label(r.stage) },
  { header: "Lead score", value: (r) => r.opportunity_score },
  { header: "Temperature", value: (r) => r.lead_temperature },
  { header: "Potential project", value: (r) => projectLabel(r.potential_project) },
  { header: "Estimated value", value: (r) => money(r.estimated_value) },
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

export const qualifiedColumns = (sourceLabel: SourceLabel = defaultSourceLabel): CsvColumn<QualifiedRow>[] => [
  ...prospectColumns(sourceLabel).slice(0, 3),
  { header: "Email", value: (r) => r.email },
  { header: "Phone", value: (r) => r.phone },
  { header: "Industry", value: (r) => r.industry },
  { header: "Lead status", value: (r) => LEAD_STATUSES.label(r.stage) },
  { header: "Qualification", value: (r) => (r.qualification_assessments[0] ? QUALIFICATION_CLASSES.label(r.qualification_assessments[0].classification) : "") },
  { header: "Qualification score", value: (r) => r.qualification_assessments[0]?.score ?? "" },
  { header: "Project type", value: (r) => projectLabel(r.qualification_assessments[0]?.project_type ?? r.potential_project) },
  { header: "Budget min", value: (r) => money(r.qualification_assessments[0]?.budget_min ?? null) },
  { header: "Budget max", value: (r) => money(r.qualification_assessments[0]?.budget_max ?? null) },
  { header: "Timeline", value: (r) => r.qualification_assessments[0]?.timeline_notes },
  { header: "Decision maker", value: (r) => r.qualification_assessments[0]?.decision_maker_name },
  { header: "Urgency (1-5)", value: (r) => r.qualification_assessments[0]?.urgency ?? "" },
  { header: "Source", value: (r) => sourceLabel(r.lead_source) },
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

const m = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : Number(v).toFixed(2));

export async function buildExport(
  db: Db,
  kind: ExportKind,
  opts: { query?: ProspectListQuery; ids?: string[]; sourceLabel?: SourceLabel } = {},
): Promise<string> {
  const sourceLabel = opts.sourceLabel ?? defaultSourceLabel;
  switch (kind) {
    case "prospects": {
      const query: ProspectListQuery = opts.query ?? ({} as ProspectListQuery);
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
      return toCsv(must(await q), prospectColumns(sourceLabel));
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
      return toCsv(rows, qualifiedColumns(sourceLabel));
    }
    case "outreach": {
      const rows = must(
        await db.from("outreach_messages").select("*, prospects(business_name, contact_name)").order("sent_at", { ascending: false }).limit(10_000),
      );
      return toCsv(rows as MessageRow[], OUTREACH_COLUMNS);
    }
    case "opportunities": {
      const rows = must(
        await db
          .from("opportunities")
          .select("*, prospects(business_name, lead_source), services(name), partners(name), pipeline_stages(label)")
          .order("created_at", { ascending: false })
          .limit(10_000),
      );
      return toCsv(rows, [
        { header: "Opportunity", value: (r) => r.title },
        { header: "Prospect", value: (r) => r.prospects?.business_name },
        { header: "Stage", value: (r) => r.pipeline_stages?.label },
        { header: "Status", value: (r) => r.status },
        { header: "Service", value: (r) => r.services?.name },
        { header: "Estimated value", value: (r) => m(r.estimated_value) },
        { header: "Probability %", value: (r) => r.probability },
        { header: "Expected close", value: (r) => r.expected_close_date },
        { header: "Delivery model", value: (r) => (r.delivery_model ? DELIVERY_MODELS.label(r.delivery_model) : "") },
        { header: "Partner", value: (r) => r.partners?.name },
        { header: "Revenue model", value: (r) => (r.revenue_model ? REVENUE_MODELS.label(r.revenue_model) : "") },
        { header: "Commission type", value: (r) => (r.commission_type ? COMMISSION_TYPES.label(r.commission_type) : "") },
        { header: "Commission %", value: (r) => r.commission_percentage },
        { header: "Fixed commission", value: (r) => m(r.fixed_commission) },
        { header: "Commission basis", value: (r) => (r.commission_basis ? COMMISSION_BASES.label(r.commission_basis) : "") },
        { header: "Next action", value: (r) => r.next_action },
        { header: "Source", value: (r) => (r.prospects ? sourceLabel(r.prospects.lead_source) : "") },
        { header: "Created", value: (r) => r.created_at },
      ]);
    }
    case "clients": {
      const rows = must(await db.from("clients").select("*").order("company").limit(10_000));
      return toCsv(rows, [
        { header: "Company", value: (r) => r.company },
        { header: "Primary contact", value: (r) => r.primary_contact },
        { header: "Email", value: (r) => r.email },
        { header: "Phone", value: (r) => r.phone },
        { header: "Website", value: (r) => r.website },
        { header: "Industry", value: (r) => r.industry },
        { header: "Location", value: (r) => r.location },
        { header: "Status", value: (r) => CLIENT_STATUSES.label(r.status) },
        { header: "Notes", value: (r) => r.notes },
      ]);
    }
    case "projects": {
      const rows = must(
        await db.from("projects").select("*, clients(company), services(name), partners(name), payments(amount, status)").order("created_at", { ascending: false }).limit(10_000),
      );
      return toCsv(rows, [
        { header: "Project", value: (r) => r.name },
        { header: "Client", value: (r) => r.clients?.company },
        { header: "Service", value: (r) => r.services?.name },
        { header: "Status", value: (r) => PROJECT_STATUSES.label(r.status) },
        { header: "Delivery model", value: (r) => (r.delivery_model ? DELIVERY_MODELS.label(r.delivery_model) : "") },
        { header: "Partner", value: (r) => r.partners?.name },
        { header: "Total value", value: (r) => m(r.total_project_value) },
        { header: "Payment flow", value: (r) => PAYMENT_FLOWS.label(r.payment_flow) },
        { header: "Partner cost", value: (r) => m(r.partner_cost) },
        { header: "Revenue model", value: (r) => (r.revenue_model ? REVENUE_MODELS.label(r.revenue_model) : "") },
        { header: "Commission type", value: (r) => (r.commission_type ? COMMISSION_TYPES.label(r.commission_type) : "") },
        { header: "Commission %", value: (r) => r.commission_percentage },
        { header: "Fixed commission", value: (r) => m(r.fixed_commission) },
        { header: "Commission basis", value: (r) => (r.commission_basis ? COMMISSION_BASES.label(r.commission_basis) : "") },
        { header: "Commission received", value: (r) => m(r.commission_received) },
        { header: "Start", value: (r) => r.start_date },
        { header: "Expected end", value: (r) => r.expected_end_date },
      ]);
    }
    case "payments": {
      const rows = must(
        await db.from("payments").select("*, projects(name, clients(company))").order("payment_date", { ascending: false }).limit(10_000),
      );
      return toCsv(rows, [
        { header: "Date", value: (r) => r.payment_date },
        { header: "Project", value: (r) => r.projects?.name },
        { header: "Client", value: (r) => r.projects?.clients?.company },
        { header: "Amount", value: (r) => m(r.amount) },
        { header: "Type", value: (r) => PAYMENT_TYPES.label(r.payment_type) },
        { header: "Status", value: (r) => PAYMENT_STATUSES.label(r.status) },
        { header: "Reference", value: (r) => r.reference },
        { header: "Notes", value: (r) => r.notes },
      ]);
    }
    case "partners": {
      const rows = must(await db.from("partners").select("*").order("name").limit(10_000));
      return toCsv(rows, [
        { header: "Partner", value: (r) => r.name },
        { header: "Type", value: (r) => PARTNER_TYPES.label(r.partner_type) },
        { header: "Status", value: (r) => PARTNER_STATUSES.label(r.status) },
        { header: "Contact", value: (r) => r.contact_name },
        { header: "Email", value: (r) => r.email },
        { header: "Phone", value: (r) => r.phone },
        { header: "Website", value: (r) => r.website },
        { header: "LinkedIn", value: (r) => r.linkedin_url },
        { header: "Location", value: (r) => r.location },
        { header: "Services", value: (r) => r.services.join("; ") },
        { header: "Notes", value: (r) => r.notes },
      ]);
    }
    case "follow-ups": {
      const rows = must(
        await db.from("tasks").select("*, prospects(business_name)").order("due_date", { ascending: true }).limit(10_000),
      );
      return toCsv(rows as TaskRow[], TASK_COLUMNS);
    }
  }
}
