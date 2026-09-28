// Enumerations used across the app. Values mirror the CHECK constraints in
// supabase/migrations/20260928000001_core_schema.sql — keep them in sync.

type Option<T extends string> = { value: T; label: string };

function options<const T extends string>(entries: Record<T, string>) {
  const list = (Object.keys(entries) as T[]).map((value) => ({ value, label: entries[value] }));
  const values = list.map((o) => o.value) as [T, ...T[]];
  const label = (value: T | null | undefined): string =>
    value ? (entries[value] ?? value) : "—";
  return { list: list as Option<T>[], values, label, entries };
}

export const PIPELINE_STAGES = options({
  prospect: "Prospect",
  contacted: "Contacted",
  replied: "Replied",
  qualified: "Qualified",
  discovery_call: "Discovery Call",
  technical_discussion: "Technical Discussion",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
});
export type PipelineStage = (typeof PIPELINE_STAGES.values)[number];

/** Stages in funnel order (Lost is terminal and outside the funnel). */
export const FUNNEL_ORDER: PipelineStage[] = [
  "prospect",
  "contacted",
  "replied",
  "qualified",
  "discovery_call",
  "technical_discussion",
  "proposal_sent",
  "negotiation",
  "won",
];

/** Stages counted as an active opportunity (qualified and still open). */
export const ACTIVE_OPPORTUNITY_STAGES: PipelineStage[] = [
  "qualified",
  "discovery_call",
  "technical_discussion",
  "proposal_sent",
  "negotiation",
];

export const LEAD_SOURCES = options({
  google_maps: "Google Maps",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  cold_email: "Cold Email",
  whatsapp: "WhatsApp",
  referral: "Referral",
  upwork: "Upwork",
  contra: "Contra",
  freelancer: "Freelancer",
  networking: "Networking",
  agency_prospecting: "Agency Prospecting",
  other: "Other",
});
export type LeadSource = (typeof LEAD_SOURCES.values)[number];

export const PROSPECT_TYPES = options({
  direct_business: "Direct Business",
  startup: "Startup",
  marketing_agency: "Marketing Agency",
  seo_agency: "SEO Agency",
  branding_agency: "Branding Agency",
  social_media_agency: "Social Media Agency",
  web_design_agency: "Web Design Agency",
  other: "Other",
});
export type ProspectType = (typeof PROSPECT_TYPES.values)[number];

export const AGENCY_TYPES: ProspectType[] = [
  "marketing_agency",
  "seo_agency",
  "branding_agency",
  "social_media_agency",
  "web_design_agency",
];

export const COMPANY_SIZES = options({
  "1": "Solo (1)",
  "2-10": "2–10",
  "11-50": "11–50",
  "51-200": "51–200",
  "201-500": "201–500",
  "500+": "500+",
});
export type CompanySize = (typeof COMPANY_SIZES.values)[number];

export const WEBSITE_QUALITY = options({
  none: "No website",
  poor: "Poor",
  average: "Average",
  good: "Good",
  excellent: "Excellent",
});
export type WebsiteQuality = (typeof WEBSITE_QUALITY.values)[number];

export const RESEARCH_INDICATORS = options({
  has_website: "Has website",
  website_needs_improvement: "Website needs improvement",
  has_online_booking: "Online booking",
  has_lead_form: "Lead / enquiry form",
  has_whatsapp: "WhatsApp contact",
  has_customer_portal: "Customer portal",
  has_admin_panel: "Admin panel",
  has_ecommerce: "E-commerce",
  has_lms: "LMS",
  has_automation: "Automation",
  has_ai_features: "AI features",
});
export type ResearchIndicator = (typeof RESEARCH_INDICATORS.values)[number];

export const TEMPLATE_CHANNELS = options({
  email: "Email",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
});
export type TemplateChannel = (typeof TEMPLATE_CHANNELS.values)[number];

export const OUTREACH_CHANNELS = options({
  email: "Email",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  phone: "Phone call",
  other: "Other",
});
export type OutreachChannel = (typeof OUTREACH_CHANNELS.values)[number];

export const TEMPLATE_AUDIENCES = options({
  direct_business: "Direct Business",
  marketing_agency: "Marketing Agency",
  seo_agency: "SEO Agency",
  branding_agency: "Branding Agency",
  social_media_agency: "Social Media Agency",
  startup: "Startup",
  education: "Education",
  healthcare: "Healthcare",
  ecommerce: "E-commerce",
  professional_services: "Professional Services",
  general: "General (any)",
});
export type TemplateAudience = (typeof TEMPLATE_AUDIENCES.values)[number];

export const OUTREACH_STAGES = options({
  first_contact: "First Contact",
  follow_up_1: "Follow-up #1",
  follow_up_2: "Follow-up #2",
  interested_response: "Interested Response",
  discovery_call_invitation: "Discovery Call Invitation",
  post_call_follow_up: "Post-Call Follow-up",
  proposal_follow_up: "Proposal Follow-up",
  re_engagement: "Re-engagement",
});
export type OutreachStage = (typeof OUTREACH_STAGES.values)[number];

export const RESPONSE_STATUSES = options({
  sent: "Sent",
  delivered: "Delivered",
  replied: "Replied",
  no_response: "No Response",
  interested: "Interested",
  not_interested: "Not Interested",
  not_now: "Not Now",
  wrong_contact: "Wrong Contact",
});
export type ResponseStatus = (typeof RESPONSE_STATUSES.values)[number];

export const TASK_TYPES = options({
  first_outreach: "First Outreach",
  follow_up: "Follow-up",
  discovery_call: "Discovery Call",
  proposal_follow_up: "Proposal Follow-up",
  qualification: "Qualification",
  internal_follow_up: "Internal Follow-up",
  handoff: "Handoff",
  other: "Other",
});
export type TaskType = (typeof TASK_TYPES.values)[number];

export const TASK_PRIORITIES = options({
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
});
export type TaskPriority = (typeof TASK_PRIORITIES.values)[number];

export const TASK_STATUSES = options({
  pending: "Pending",
  completed: "Completed",
  snoozed: "Snoozed",
  cancelled: "Cancelled",
});
export type TaskStatus = (typeof TASK_STATUSES.values)[number];

export const PROJECT_TYPES = options({
  website: "Website",
  ecommerce: "E-commerce",
  web_application: "Web Application",
  saas: "SaaS",
  crm: "CRM",
  erp: "ERP",
  lms: "LMS",
  dashboard: "Dashboard",
  ai_genai: "AI/GenAI",
  api_backend: "API/Backend",
  automation: "Automation",
  mobile_application: "Mobile Application",
  custom_software: "Custom Software",
  other: "Other",
});
export type ProjectType = (typeof PROJECT_TYPES.values)[number];

export const COMPLEXITY = options({
  low: "Low",
  medium: "Medium",
  high: "High",
  unknown: "Unknown",
});
export type Complexity = (typeof COMPLEXITY.values)[number];

export const QUALIFICATION_CLASSES = options({
  unqualified: "Unqualified",
  potential: "Potential",
  qualified: "Qualified",
  high_priority: "High Priority",
});
export type QualificationClass = (typeof QUALIFICATION_CLASSES.values)[number];

export const LEAD_TEMPERATURES = options({
  cold: "Cold",
  warm: "Warm",
  hot: "Hot",
});
export type LeadTemperature = (typeof LEAD_TEMPERATURES.values)[number];

export const HANDOFF_STATUSES = options({
  draft: "Draft",
  sent: "Sent to BharatCoder",
  accepted: "Accepted",
  declined: "Declined",
});
export type HandoffStatus = (typeof HANDOFF_STATUSES.values)[number];

export const OPPORTUNITY_STATUSES = options({
  open: "Open",
  won: "Won",
  lost: "Lost",
});
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES.values)[number];

export const ACTIVITY_TYPES = options({
  prospect_created: "Prospect created",
  prospect_updated: "Prospect updated",
  note: "Note",
  stage_change: "Stage change",
  outreach_sent: "Outreach sent",
  response_recorded: "Response recorded",
  task_created: "Task created",
  task_completed: "Task completed",
  task_rescheduled: "Task rescheduled",
  task_cancelled: "Task cancelled",
  qualification: "Qualification",
  handoff: "Handoff",
  opportunity: "Opportunity",
  archived: "Archived",
  restored: "Restored",
});
export type ActivityType = (typeof ACTIVITY_TYPES.values)[number];
