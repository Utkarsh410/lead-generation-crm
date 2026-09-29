// Enumerations used across the app. Values mirror the CHECK constraints in
// supabase/migrations (0001 core schema, 0004 generic CRM) — keep them in sync.

type Option<T extends string> = { value: T; label: string };

function options<const T extends string>(entries: Record<T, string>) {
  const list = (Object.keys(entries) as T[]).map((value) => ({ value, label: entries[value] }));
  const values = list.map((o) => o.value) as [T, ...T[]];
  const label = (value: T | null | undefined): string =>
    value ? (entries[value] ?? value) : "—";
  return { list: list as Option<T>[], values, label, entries };
}

/** Lead status of a prospect (the lead-generation funnel). Deals live on opportunities. */
export const LEAD_STATUSES = options({
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  qualified: "Qualified",
  nurture: "Nurture",
  client: "Client",
  lost: "Lost",
});
export type LeadStatus = (typeof LEAD_STATUSES.values)[number];

/** Lead statuses in funnel order (Nurture and Lost sit outside the funnel). */
export const FUNNEL_ORDER: LeadStatus[] = ["new", "contacted", "replied", "qualified", "client"];

/** Built-in opportunity stage keys (custom stages have no key). */
export const STAGE_KEYS = options({
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  qualified: "Qualified",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  nurture: "Nurture",
});
export type StageKey = (typeof STAGE_KEYS.values)[number];

export const STAGE_KINDS = options({
  open: "Open",
  won: "Won",
  lost: "Lost",
  parked: "Parked (nurture)",
});
export type StageKind = (typeof STAGE_KINDS.values)[number];

export const STAGE_COLORS = ["slate", "sky", "blue", "indigo", "violet", "amber", "orange", "green", "red", "teal"] as const;
export type StageColor = (typeof STAGE_COLORS)[number];

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
  website: "Website",
  agency_prospecting: "Agency Prospecting",
  other: "Other",
});
/** Built-in source keys; users can add custom sources (stored in lookup_values). */
export type LeadSource = string;

export const PROSPECT_TYPES = options({
  direct_business: "Direct Business",
  startup: "Startup",
  agency: "Agency",
  freelancer: "Freelancer",
  creator: "Creator",
  consultant: "Consultant",
  professional: "Professional",
  other: "Other",
});
export type ProspectType = (typeof PROSPECT_TYPES.values)[number];

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
  phone: "Phone script",
  other: "Other",
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
  general: "Any prospect",
  direct_business: "Direct Business",
  startup: "Startup",
  agency: "Agency",
  freelancer: "Freelancer",
  creator: "Creator",
  consultant: "Consultant",
  professional: "Professional",
  other: "Other",
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
  partner_outreach: "Partner Outreach",
  client_check_in: "Client Check-in",
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
  client_follow_up: "Client Follow-up",
  partner_follow_up: "Partner Follow-up",
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
  sent: "Sent to partner",
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
  client: "Client",
  project: "Project",
  payment: "Payment",
  archived: "Archived",
  restored: "Restored",
});
export type ActivityType = (typeof ACTIVITY_TYPES.values)[number];

// ---------------------------------------------------------------------------
// Business model: how a deal is delivered and how I earn from it
// ---------------------------------------------------------------------------

export const DELIVERY_MODELS = options({
  self_delivered: "Self-delivered",
  partner_delivered: "Partner-delivered",
  referral: "Referral",
  white_label: "White-label",
  joint_delivery: "Joint delivery",
});
export type DeliveryModel = (typeof DELIVERY_MODELS.values)[number];

export const REVENUE_MODELS = options({
  direct_revenue: "Direct Revenue",
  referral_commission: "Referral Commission",
  partner_commission: "Partner Commission",
  revenue_share: "Revenue Share",
  fixed_fee: "Fixed Fee",
  other: "Other",
});
export type RevenueModel = (typeof REVENUE_MODELS.values)[number];

export const COMMISSION_TYPES = options({
  none: "No commission",
  percentage: "Percentage",
  fixed: "Fixed amount",
});
export type CommissionType = (typeof COMMISSION_TYPES.values)[number];

export const COMMISSION_BASES = options({
  total_project_value: "Total Project Value",
  amount_received: "Amount Received",
  net_revenue: "Net Revenue",
  custom: "Custom",
});
export type CommissionBasis = (typeof COMMISSION_BASES.values)[number];

export const PAYMENT_FLOWS = options({
  client_pays_me: "Client pays me",
  client_pays_partner: "Client pays the partner",
});
export type PaymentFlow = (typeof PAYMENT_FLOWS.values)[number];

export const PARTNER_TYPES = options({
  development_agency: "Development agency",
  marketing_agency: "Marketing agency",
  freelancer: "Freelancer",
  designer: "Designer",
  developer: "Developer",
  consultant: "Consultant",
  software_company: "Software company",
  seo_agency: "SEO agency",
  other: "Other",
});
export type PartnerType = (typeof PARTNER_TYPES.values)[number];

export const PARTNER_STATUSES = options({
  prospect: "Prospect",
  contacted: "Contacted",
  interested: "Interested",
  active: "Active",
  inactive: "Inactive",
});
export type PartnerStatus = (typeof PARTNER_STATUSES.values)[number];

export const CLIENT_STATUSES = options({
  active: "Active",
  inactive: "Inactive",
  past_client: "Past Client",
  nurture: "Nurture",
});
export type ClientStatus = (typeof CLIENT_STATUSES.values)[number];

export const PROJECT_STATUSES = options({
  not_started: "Not Started",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
});
export type ProjectStatus = (typeof PROJECT_STATUSES.values)[number];

export const PAYMENT_TYPES = options({
  advance: "Advance",
  milestone: "Milestone",
  final: "Final",
  retainer: "Retainer",
  other: "Other",
});
export type PaymentType = (typeof PAYMENT_TYPES.values)[number];

export const PAYMENT_STATUSES = options({
  expected: "Expected",
  received: "Received",
  failed: "Failed",
  refunded: "Refunded",
});
export type PaymentStatus = (typeof PAYMENT_STATUSES.values)[number];

export const PRICING_MODELS = options({
  fixed_price: "Fixed price",
  per_project: "Per project",
  hourly: "Hourly",
  retainer: "Retainer",
  commission: "Commission",
  custom: "Custom",
});
export type PricingModel = (typeof PRICING_MODELS.values)[number];

/** Starter values for user-editable lookups (Settings → Lookups). */
export const DEFAULT_SERVICE_CATEGORIES = options({
  web_development: "Web Development",
  software_development: "Software Development",
  ai: "AI",
  automation: "Automation",
  marketing: "Marketing",
  seo: "SEO",
  design: "Design",
  data: "Data",
  consulting: "Consulting",
  lead_generation: "Lead Generation",
  other: "Other",
});

export const DEFAULT_INDUSTRIES = [
  "Healthcare",
  "Education / coaching",
  "E-commerce",
  "Real estate",
  "Professional services",
  "Marketing agency",
  "SaaS",
  "Hospitality",
  "Manufacturing",
  "Retail",
];

export const LOOKUP_KINDS = options({
  lead_source: "Lead sources",
  industry: "Industries",
  service_category: "Service categories",
});
export type LookupKind = (typeof LOOKUP_KINDS.values)[number];

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"] as const;
