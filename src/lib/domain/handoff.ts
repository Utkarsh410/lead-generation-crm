// Generates an "Opportunity Handoff" summary for any partner (or for your own
// records when self-delivering) from the prospect, the chosen opportunity, the
// partner and the latest qualification. Output is Markdown plus a JSON snapshot.

import {
  COMPLEXITY,
  DELIVERY_MODELS,
  PROJECT_TYPES,
  PROSPECT_TYPES,
  QUALIFICATION_CLASSES,
  type Complexity,
  type DeliveryModel,
  type ProjectType,
  type ProspectType,
  type QualificationClass,
} from "./constants";
import { formatBudgetRange, formatMoneyCompact } from "./money";
import { normalizeCustomAnswers } from "./qualification";

export type HandoffProspect = {
  business_name: string;
  contact_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  location: string | null;
  country: string | null;
  industry: string | null;
  prospect_type: ProspectType;
  lead_source: string;
  source_url: string | null;
  observed_problem: string | null;
  suggested_solution: string | null;
  potential_project: string | null;
  estimated_value: string | number | null;
  recommended_services: string[] | null;
};

export type HandoffQualification = {
  business_model: string | null;
  current_technology: string | null;
  problem_description: string | null;
  current_solution: string | null;
  whats_not_working: string | null;
  cost_of_inaction: string | null;
  project_type: ProjectType | null;
  required_features: string | null;
  integrations: string | null;
  number_of_users: string | null;
  estimated_complexity: Complexity | null;
  desired_launch_date: string | null;
  timeline_notes: string | null;
  budget_min: string | number | null;
  budget_max: string | number | null;
  budget_notes: string | null;
  decision_maker_identified: boolean;
  decision_maker_name: string | null;
  decision_process: string | null;
  other_stakeholders: string | null;
  urgency: number;
  score: number;
  classification: QualificationClass;
  notes: string | null;
  custom_answers?: unknown;
};

export type HandoffOpportunity = {
  title: string;
  description: string | null;
  estimated_value: string | number | null;
  delivery_model: DeliveryModel | null;
  service_name: string | null;
  expected_close_date: string | null;
};

export type HandoffPartner = {
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
};

export type HandoffInput = {
  prospect: HandoffProspect;
  opportunity: HandoffOpportunity | null;
  partner: HandoffPartner | null;
  qualification: HandoffQualification | null;
  generatedBy: string;
  generatedOn: string; // YYYY-MM-DD
  notes?: string | null;
  sourceLabel?: (source: string) => string;
  currency?: string;
};

export type HandoffResult = {
  markdown: string;
  snapshot: Record<string, string>;
  /** Information the partner will likely ask for that is still missing. */
  gaps: string[];
};

export function urgencyLabel(rating: number | null | undefined): string {
  if (!rating) return "Unknown";
  if (rating >= 4) return "High";
  if (rating === 3) return "Medium";
  return "Low";
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const clean = (v: string | null | undefined) => (v ?? "").trim();
const join = (parts: Array<string | null | undefined>, sep = " · ") => parts.map(clean).filter(Boolean).join(sep);

export function generateHandoff(input: HandoffInput): HandoffResult {
  const { prospect: p, qualification: q, opportunity: o, partner } = input;
  const currency = input.currency ?? "INR";
  const gaps: string[] = [];

  const contactLine = join([
    p.contact_name ? join([p.contact_name, p.job_title ? `(${p.job_title})` : null], " ") : null,
    p.email,
    p.phone,
    p.whatsapp && p.whatsapp !== p.phone ? `WhatsApp ${p.whatsapp}` : null,
  ]);
  if (!p.contact_name) gaps.push("Contact person");
  if (!p.email && !p.phone && !p.whatsapp) gaps.push("Direct contact details (email/phone)");

  const problem = join(
    [q?.problem_description || p.observed_problem, q?.whats_not_working ? `What's not working: ${q.whats_not_working}` : null],
    "\n  ",
  );
  if (!problem) gaps.push("Problem statement");

  const requirements = join([o?.description, q?.required_features ? `Features: ${q.required_features}` : null, p.suggested_solution], "\n  ");
  const projectType = q?.project_type ?? (p.potential_project as ProjectType | null);
  if (!requirements && !projectType) gaps.push("Requirements");

  let budget: string;
  if (q && (q.budget_min !== null || q.budget_max !== null)) {
    budget = formatBudgetRange(q.budget_min, q.budget_max, currency);
  } else if (o?.estimated_value !== null && o?.estimated_value !== undefined && o.estimated_value !== "") {
    budget = `Not confirmed (estimate ${formatMoneyCompact(o.estimated_value, currency)})`;
    gaps.push("Confirmed budget range");
  } else if (p.estimated_value !== null && p.estimated_value !== undefined && p.estimated_value !== "") {
    budget = `Not confirmed (estimate ${formatMoneyCompact(p.estimated_value, currency)})`;
    gaps.push("Confirmed budget range");
  } else {
    budget = "Not discussed";
    gaps.push("Budget range");
  }
  if (q?.budget_notes) budget = `${budget} — ${q.budget_notes}`;

  const launch = formatDate(q?.desired_launch_date);
  const timeline = join([launch ? `Target launch ${launch}` : null, q?.timeline_notes], " — ") || "Not discussed";
  if (timeline === "Not discussed") gaps.push("Timeline");

  const decisionMaker = q
    ? q.decision_maker_identified
      ? join([q.decision_maker_name || "Identified", q.decision_process ? `Process: ${q.decision_process}` : null], " — ")
      : "Not yet identified"
    : p.contact_name && p.job_title
      ? `${p.contact_name} (${p.job_title}) — unconfirmed`
      : "Unknown";
  if (!q?.decision_maker_identified) gaps.push("Confirmed decision maker");
  if (!q) gaps.push("Qualification assessment");

  const snapshot: Record<string, string> = {
    Client: p.business_name,
    Opportunity: o?.title ?? "—",
  };
  if (o?.service_name) snapshot.Service = o.service_name;
  snapshot.Contact = contactLine || "—";
  snapshot.Industry = join([p.industry, PROSPECT_TYPES.label(p.prospect_type)], " · ") || "—";
  snapshot.Location = join([p.location, p.country], ", ") || "—";
  snapshot.Website = p.website || "—";
  snapshot.Problem = problem || "—";
  snapshot.Requirements = requirements || "—";
  snapshot["Project type"] = projectType ? PROJECT_TYPES.label(projectType) : "—";
  snapshot.Budget = budget;
  snapshot.Timeline = timeline;
  snapshot["Decision maker"] = decisionMaker;
  snapshot.Urgency = q ? `${urgencyLabel(q.urgency)} (${q.urgency}/5)` : "Unknown";
  if (q) {
    snapshot.Qualification = `${QUALIFICATION_CLASSES.label(q.classification)} (score ${q.score}/100)`;
    if (q.business_model) snapshot["Business model"] = q.business_model;
    if (q.current_technology || q.current_solution) snapshot["Current system"] = join([q.current_technology, q.current_solution], " — ");
    if (q.cost_of_inaction) snapshot["If not solved"] = q.cost_of_inaction;
    if (q.integrations) snapshot.Integrations = q.integrations;
    if (q.number_of_users) snapshot.Users = q.number_of_users;
    if (q.estimated_complexity) snapshot["Estimated complexity"] = COMPLEXITY.label(q.estimated_complexity);
    if (q.other_stakeholders) snapshot["Other stakeholders"] = q.other_stakeholders;
    for (const a of normalizeCustomAnswers(q.custom_answers)) {
      if (a.answer.trim()) snapshot[a.question] = a.answer;
    }
  }
  if (o?.delivery_model) snapshot["Delivery model"] = DELIVERY_MODELS.label(o.delivery_model);
  snapshot.Partner = partner ? join([partner.name, partner.contact_name, partner.email, partner.phone]) : "—";
  if (p.recommended_services?.length) snapshot["Suggested services"] = p.recommended_services.join(", ");
  snapshot.Notes = join([input.notes, q?.notes], "\n  ") || "—";
  snapshot.Source = join([input.sourceLabel ? input.sourceLabel(p.lead_source) : p.lead_source, p.source_url], " — ");
  snapshot["Prepared by"] = input.generatedBy || "—";
  snapshot.Date = formatDate(input.generatedOn) ?? input.generatedOn;

  const lines = ["## Opportunity Handoff", ""];
  for (const [label, value] of Object.entries(snapshot)) {
    lines.push(`**${label}:**`, `  ${value}`, "");
  }
  if (gaps.length) {
    lines.push("**Still to confirm:**");
    for (const gap of gaps) lines.push(`- ${gap}`);
    lines.push("");
  }
  return { markdown: lines.join("\n").trimEnd() + "\n", snapshot, gaps };
}
