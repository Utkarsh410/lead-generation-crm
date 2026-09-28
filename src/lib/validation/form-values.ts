import { RESEARCH_INDICATORS } from "@/lib/domain/constants";
import { normalizeScoreFactors } from "@/lib/domain/opportunity-score";
import type { Tables } from "@/lib/supabase/database.types";
import { triStateValue } from "./common";
import type { ProspectInput } from "./schemas";

const s = (v: string | null | undefined) => v ?? "";

/** Database row → raw form values for the prospect form. */
export function prospectToFormValues(p: Tables<"prospects">): ProspectInput {
  const indicators = Object.fromEntries(
    RESEARCH_INDICATORS.values.map((k) => [k, triStateValue(p[k])]),
  ) as Record<(typeof RESEARCH_INDICATORS.values)[number], "unknown" | "yes" | "no">;
  return {
    business_name: p.business_name,
    contact_name: s(p.contact_name),
    job_title: s(p.job_title),
    email: s(p.email),
    phone: s(p.phone),
    whatsapp: s(p.whatsapp),
    website: s(p.website),
    linkedin_url: s(p.linkedin_url),
    instagram_url: s(p.instagram_url),
    location: s(p.location),
    country: s(p.country),
    industry: s(p.industry),
    company_size: (p.company_size ?? "") as ProspectInput["company_size"],
    lead_source: p.lead_source,
    source_url: s(p.source_url),
    source_notes: s(p.source_notes),
    prospect_type: p.prospect_type,
    business_description: s(p.business_description),
    current_website_notes: s(p.current_website_notes),
    website_quality: (p.website_quality ?? "") as ProspectInput["website_quality"],
    social_presence: s(p.social_presence),
    observed_problem: s(p.observed_problem),
    potential_need: s(p.potential_need),
    suggested_solution: s(p.suggested_solution),
    research_notes: s(p.research_notes),
    ...indicators,
    potential_project: (p.potential_project ?? "") as ProspectInput["potential_project"],
    potential_project_notes: s(p.potential_project_notes),
    estimated_value: p.estimated_value === null ? "" : String(p.estimated_value),
    score_factors: normalizeScoreFactors(p.score_factors),
  };
}
