// {{variable}} rendering for outreach templates. Unfilled variables are left in
// place (and reported) so a half-personalised message is never mistaken for a
// finished one.

import { PROJECT_TYPES, TEMPLATE_AUDIENCES, type ProjectType, type TemplateAudience } from "./constants";

export const TEMPLATE_VARIABLES = [
  { key: "first_name", label: "First name", source: "Contact name" },
  { key: "last_name", label: "Last name", source: "Contact name" },
  { key: "company_name", label: "Company name", source: "Business name" },
  { key: "industry", label: "Industry", source: "Industry" },
  { key: "specific_problem", label: "Specific problem", source: "Research → Observed problem" },
  { key: "observation", label: "Observation", source: "Type something specific you noticed" },
  { key: "service", label: "Service", source: "The service you're pitching (opportunity / potential project)" },
  { key: "solution", label: "Solution", source: "Research → Suggested solution" },
  { key: "my_name", label: "My name", source: "Settings → My profile" },
  { key: "my_business", label: "My business", source: "Settings → Business profile" },
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]["key"];
export type TemplateVariables = Partial<Record<TemplateVariable, string | null | undefined>>;

/** Older variable names still used in existing templates → current variable. */
export const LEGACY_VARIABLE_ALIASES: Record<string, TemplateVariable> = {
  personalized_observation: "observation",
  potential_solution: "solution",
  project_type: "service",
  service_area: "service",
};

const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type RenderResult = {
  text: string;
  /** Known variables that had no value (left as {{placeholder}}). */
  missing: TemplateVariable[];
  /** Placeholders that are not supported variables (left untouched). */
  unknown: string[];
};

/** Variables used by a template body/subject (legacy names resolved). */
export function templateVariablesUsed(...texts: Array<string | null | undefined>): TemplateVariable[] {
  const used = new Set<TemplateVariable>();
  for (const t of texts) {
    for (const m of (t ?? "").matchAll(PLACEHOLDER)) {
      const name = m[1].toLowerCase();
      const key = (LEGACY_VARIABLE_ALIASES[name] ?? name) as TemplateVariable;
      if (KNOWN.has(key)) used.add(key);
    }
  }
  return [...used];
}

export function renderTemplate(template: string | null | undefined, vars: TemplateVariables): RenderResult {
  const missing = new Set<TemplateVariable>();
  const unknown = new Set<string>();
  const text = (template ?? "").replace(PLACEHOLDER, (match, rawName: string) => {
    const lower = rawName.toLowerCase();
    const name = LEGACY_VARIABLE_ALIASES[lower] ?? lower;
    if (!KNOWN.has(name)) {
      unknown.add(rawName);
      return match;
    }
    const value = vars[name as TemplateVariable]?.trim();
    if (!value) {
      missing.add(name as TemplateVariable);
      return `{{${name}}}`;
    }
    return value;
  });
  return { text, missing: [...missing], unknown: [...unknown] };
}

/** Any {{placeholder}} still present in a message. */
export function findPlaceholders(text: string | null | undefined): string[] {
  const found = new Set<string>();
  for (const m of (text ?? "").matchAll(PLACEHOLDER)) found.add(m[1]);
  return [...found];
}

export function splitName(fullName: string | null | undefined): { first: string; last: string } {
  const parts = (fullName ?? "")
    .trim()
    .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function buildTemplateVariables(
  prospect: {
    contact_name?: string | null;
    business_name?: string | null;
    industry?: string | null;
    observed_problem?: string | null;
    suggested_solution?: string | null;
    potential_project?: string | null;
  },
  overrides: TemplateVariables = {},
  me: { name?: string | null; business?: string | null; service?: string | null } = {},
): TemplateVariables {
  const { first, last } = splitName(prospect.contact_name);
  const projectType = prospect.potential_project ? PROJECT_TYPES.label(prospect.potential_project as ProjectType) : "";
  const base: TemplateVariables = {
    first_name: first,
    last_name: last,
    company_name: prospect.business_name ?? "",
    industry: prospect.industry ?? "",
    specific_problem: lowerFirst(prospect.observed_problem),
    observation: "",
    service: me.service ?? (projectType ? projectType.toLowerCase() : ""),
    solution: lowerFirst(prospect.suggested_solution),
    my_name: me.name ?? "",
    my_business: me.business ?? "",
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== null && value.trim() !== "") {
      base[key as TemplateVariable] = value;
    }
  }
  return base;
}

function lowerFirst(value: string | null | undefined): string {
  const v = (value ?? "").trim().replace(/\.$/, "");
  if (!v) return "";
  // keep acronyms/proper nouns ("SEO", "WhatsApp") intact
  if (/^[A-Z]{2,}/.test(v) || /^[A-Z][a-z]*[A-Z]/.test(v)) return v;
  return v.charAt(0).toLowerCase() + v.slice(1);
}

export const PERSONALIZE_WARNING = "Personalize this message before sending.";

export type PersonalizationCheck = {
  warnings: string[];
  /** Blocking: the message still contains {{placeholders}}. */
  hasUnfilledPlaceholders: boolean;
};

export function checkPersonalization(args: {
  isGenericTemplate: boolean;
  renderedTemplate: string;
  finalMessage: string;
}): PersonalizationCheck {
  const warnings: string[] = [];
  const placeholders = findPlaceholders(args.finalMessage);
  if (args.isGenericTemplate) warnings.push(PERSONALIZE_WARNING);
  if (placeholders.length) {
    warnings.push(`Fill in or remove: ${placeholders.map((p) => `{{${p}}}`).join(", ")}`);
  }
  if (
    args.isGenericTemplate &&
    normalizeWhitespace(args.finalMessage) === normalizeWhitespace(args.renderedTemplate)
  ) {
    warnings.push("The message is identical to the template — add something specific to this prospect.");
  }
  return { warnings, hasUnfilledPlaceholders: placeholders.length > 0 };
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Template audiences relevant to a prospect, most specific first ("general" last). */
export function audiencesForProspect(p: { prospect_type?: string | null }): TemplateAudience[] {
  const type = p.prospect_type ?? "";
  const out: TemplateAudience[] = [];
  if ((TEMPLATE_AUDIENCES.values as readonly string[]).includes(type) && type !== "general") out.push(type as TemplateAudience);
  out.push("general");
  return out;
}
