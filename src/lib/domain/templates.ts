// {{variable}} rendering for outreach templates. Unfilled variables are left in
// place (and reported) so a half-personalised message is never mistaken for a
// finished one.

import { PROJECT_TYPES, type ProjectType } from "./constants";

export const TEMPLATE_VARIABLES = [
  { key: "first_name", label: "First name", source: "Contact name" },
  { key: "last_name", label: "Last name", source: "Contact name" },
  { key: "company_name", label: "Company name", source: "Business name" },
  { key: "industry", label: "Industry", source: "Industry" },
  { key: "service_area", label: "Service area", source: "What the agency/business offers — type it" },
  { key: "specific_problem", label: "Specific problem", source: "Research → Observed problem" },
  { key: "personalized_observation", label: "Personalised observation", source: "Type something specific you noticed" },
  { key: "potential_solution", label: "Potential solution", source: "Research → Suggested solution" },
  { key: "project_type", label: "Project type", source: "Potential project" },
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]["key"];
export type TemplateVariables = Partial<Record<TemplateVariable, string | null | undefined>>;

const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type RenderResult = {
  text: string;
  /** Known variables that had no value (left as {{placeholder}}). */
  missing: TemplateVariable[];
  /** Placeholders that are not supported variables (left untouched). */
  unknown: string[];
};

export function renderTemplate(template: string | null | undefined, vars: TemplateVariables): RenderResult {
  const missing = new Set<TemplateVariable>();
  const unknown = new Set<string>();
  const text = (template ?? "").replace(PLACEHOLDER, (match, rawName: string) => {
    const name = rawName.toLowerCase();
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
): TemplateVariables {
  const { first, last } = splitName(prospect.contact_name);
  const projectType = prospect.potential_project
    ? PROJECT_TYPES.label(prospect.potential_project as ProjectType)
    : "";
  const base: TemplateVariables = {
    first_name: first,
    last_name: last,
    company_name: prospect.business_name ?? "",
    industry: prospect.industry ?? "",
    service_area: "",
    specific_problem: lowerFirst(prospect.observed_problem),
    personalized_observation: "",
    potential_solution: lowerFirst(prospect.suggested_solution),
    project_type: projectType,
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
