import { z } from "zod";
import {
  CLIENT_STATUSES,
  COMMISSION_BASES,
  COMMISSION_TYPES,
  CURRENCIES,
  DELIVERY_MODELS,
  LEAD_STATUSES,
  LOOKUP_KINDS,
  PARTNER_STATUSES,
  PARTNER_TYPES,
  PAYMENT_FLOWS,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  PRICING_MODELS,
  PROJECT_STATUSES,
  REVENUE_MODELS,
  STAGE_COLORS,
  STAGE_KINDS,
  COMPANY_SIZES,
  COMPLEXITY,
  HANDOFF_STATUSES,
  OUTREACH_CHANNELS,
  OUTREACH_STAGES,
  PROJECT_TYPES,
  PROSPECT_TYPES,
  QUALIFICATION_CLASSES,
  RESEARCH_INDICATORS,
  RESPONSE_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  TEMPLATE_AUDIENCES,
  TEMPLATE_CHANNELS,
  WEBSITE_QUALITY,
} from "@/lib/domain/constants";
import { SCORE_FACTORS } from "@/lib/domain/opportunity-score";
import { QUALIFICATION_CRITERIA } from "@/lib/domain/qualification";
import { validateCommercialTerms } from "@/lib/domain/commercials";
import {
  optionalDate,
  optionalEmail,
  optionalEnum,
  optionalMoney,
  optionalPhone,
  optionalText,
  optionalTime,
  optionalUrl,
  requiredDate,
  requiredText,
  triState,
  uuid,
} from "./common";

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------

const indicatorShape = Object.fromEntries(RESEARCH_INDICATORS.values.map((k) => [k, triState])) as Record<
  (typeof RESEARCH_INDICATORS.values)[number],
  typeof triState
>;

const scoreFactorShape = Object.fromEntries(
  SCORE_FACTORS.map((f) => [f.key, z.coerce.number().int().min(0).max(3).optional().default(0)]),
) as Record<(typeof SCORE_FACTORS)[number]["key"], z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber>>>;

export const prospectSchema = z.object({
  business_name: requiredText("Business name", 200),
  contact_name: optionalText(120),
  job_title: optionalText(120),
  email: optionalEmail,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  website: optionalUrl,
  linkedin_url: optionalUrl,
  instagram_url: optionalUrl,
  location: optionalText(120),
  country: optionalText(80),
  industry: optionalText(120),
  company_size: optionalEnum(COMPANY_SIZES.values),

  // built-in or custom source key (custom sources are checked against the user's list in the action)
  lead_source: z
    .string({ error: "Choose a lead source" })
    .trim()
    .regex(/^[a-z0-9_]{1,60}$/, "Choose a lead source"),
  source_url: optionalUrl,
  source_notes: optionalText(2000),
  prospect_type: z.enum(PROSPECT_TYPES.values, { error: "Choose a prospect type" }),

  business_description: optionalText(4000),
  current_website_notes: optionalText(4000),
  website_quality: optionalEnum(WEBSITE_QUALITY.values),
  social_presence: optionalText(2000),
  observed_problem: optionalText(4000),
  potential_need: optionalText(4000),
  suggested_solution: optionalText(4000),
  research_notes: optionalText(8000),
  ...indicatorShape,

  potential_project: optionalEnum(PROJECT_TYPES.values),
  potential_project_notes: optionalText(2000),
  estimated_value: optionalMoney,
  score_factors: z.object(scoreFactorShape).optional().default({} as never),
});

export type ProspectInput = z.input<typeof prospectSchema>;
export type ProspectValues = z.output<typeof prospectSchema>;

export const prospectCreateSchema = prospectSchema.extend({
  /** Set after the user reviewed potential duplicates and chose to create anyway. */
  confirm_duplicate: z.boolean().optional().default(false),
});

const optionalQueryText = z.string().trim().max(200).optional().catch(undefined).transform((v) => (v ? v : undefined));

export const prospectListQuerySchema = z.object({
  q: optionalQueryText,
  stage: z.enum(LEAD_STATUSES.values).optional().catch(undefined),
  type: z.enum(PROSPECT_TYPES.values).optional().catch(undefined),
  source: z.string().regex(/^[a-z0-9_]{1,60}$/).optional().catch(undefined),
  industry: optionalQueryText,
  location: optionalQueryText,
  temp: z.enum(["cold", "warm", "hot"]).optional().catch(undefined),
  min_score: z.coerce.number().int().min(0).max(100).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  archived: z.enum(["only", "include"]).optional().catch(undefined),
  demo: z.enum(["hide", "only"]).optional().catch(undefined),
  sort: z
    .enum([
      "opportunity_score",
      "business_name",
      "stage",
      "estimated_value",
      "last_contacted_at",
      "next_follow_up_date",
      "created_at",
      "industry",
      "prospect_type",
      "lead_source",
    ])
    .optional()
    .catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});
export type ProspectListQuery = z.output<typeof prospectListQuerySchema>;

export const contactSchema = z.object({
  prospect_id: uuid,
  name: requiredText("Name", 120),
  job_title: optionalText(120),
  email: optionalEmail,
  phone: optionalPhone,
  notes: optionalText(1000),
});

export const noteSchema = z.object({
  prospect_id: uuid,
  details: requiredText("Note", 4000),
});

export const recommendedServicesSchema = z.object({
  prospect_id: uuid,
  services: z.array(z.string().trim().min(1).max(120)).max(20),
});

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export const leadStatusSchema = z.object({
  prospect_id: uuid,
  to: z.enum(LEAD_STATUSES.values),
  lost_reason: optionalText(1000),
});

// ---------------------------------------------------------------------------
// Outreach
// ---------------------------------------------------------------------------

export const templateSchema = z.object({
  name: requiredText("Template name", 160),
  channel: z.enum(TEMPLATE_CHANNELS.values),
  audience: z.enum(TEMPLATE_AUDIENCES.values),
  outreach_stage: z.enum(OUTREACH_STAGES.values),
  subject: optionalText(300),
  body: requiredText("Message", 8000),
  is_generic: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
});

export const outreachMessageSchema = z.object({
  prospect_id: uuid,
  template_id: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  channel: z.enum(OUTREACH_CHANNELS.values),
  outreach_stage: z.enum(OUTREACH_STAGES.values),
  subject: optionalText(300),
  customized_message: requiredText("Message", 8000),
  sent_date: requiredDate,
  notes: optionalText(2000),
  /** The user acknowledged unresolved {{placeholders}} (e.g. intentionally kept). */
  allow_placeholders: z.boolean().optional().default(false),
});

export const responseSchema = z
  .object({
    message_id: uuid,
    response_status: z.enum(RESPONSE_STATUSES.values),
    response_date: requiredDate,
    response_notes: optionalText(4000),
    follow_up_date: optionalDate,
  })
  .refine((v) => v.response_status !== "not_now" || v.follow_up_date !== null, {
    message: "Choose when to follow up",
    path: ["follow_up_date"],
  });

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

const optionalUuid = uuid.optional().nullable().or(z.literal("").transform(() => null));

export const taskSchema = z.object({
  prospect_id: optionalUuid,
  opportunity_id: optionalUuid,
  client_id: optionalUuid,
  partner_id: optionalUuid,
  task_type: z.enum(TASK_TYPES.values),
  title: requiredText("Title", 200),
  due_date: requiredDate,
  due_time: optionalTime,
  priority: z.enum(TASK_PRIORITIES.values),
  notes: optionalText(2000),
});

export const taskStatusSchema = z.object({
  id: uuid,
  status: z.enum(TASK_STATUSES.values),
});

export const rescheduleSchema = z.object({
  id: uuid,
  due_date: requiredDate,
  snooze: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Qualification
// ---------------------------------------------------------------------------

const rating = z.coerce
  .number({ error: "Rate 1–5" })
  .int("Rate 1–5")
  .min(1, "Rate 1–5")
  .max(5, "Rate 1–5");

const ratingShape = Object.fromEntries(QUALIFICATION_CRITERIA.map((c) => [c.key, rating])) as Record<
  (typeof QUALIFICATION_CRITERIA)[number]["key"],
  typeof rating
>;

export const qualificationSchema = z
  .object({
    prospect_id: uuid,
    opportunity_id: optionalUuid,
    business_model: optionalText(1000),
    current_technology: optionalText(1000),
    problem_description: optionalText(4000),
    current_solution: optionalText(2000),
    whats_not_working: optionalText(2000),
    cost_of_inaction: optionalText(2000),
    project_type: optionalEnum(PROJECT_TYPES.values),
    required_features: optionalText(4000),
    integrations: optionalText(2000),
    number_of_users: optionalText(200),
    estimated_complexity: optionalEnum(COMPLEXITY.values),
    desired_launch_date: optionalDate,
    timeline_notes: optionalText(1000),
    budget_min: optionalMoney,
    budget_max: optionalMoney,
    budget_notes: optionalText(1000),
    decision_maker_identified: z.boolean().optional().default(false),
    decision_maker_name: optionalText(200),
    decision_process: optionalText(2000),
    other_stakeholders: optionalText(1000),
    ...ratingShape,
    custom_answers: z
      .array(z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().max(2000) }))
      .max(30)
      .optional()
      .default([]),
    classification: optionalEnum(QUALIFICATION_CLASSES.values),
    notes: optionalText(4000),
    /** Move the lead to "Qualified" when the final class is Qualified/High Priority. */
    advance_stage: z.boolean().optional().default(true),
  })
  .refine((v) => !v.budget_min || !v.budget_max || Number(v.budget_max) >= Number(v.budget_min), {
    message: "Maximum budget must be at least the minimum",
    path: ["budget_max"],
  });

// ---------------------------------------------------------------------------
// Opportunities / handoffs / reference data
// ---------------------------------------------------------------------------

/** "12.5%" / 12.5 → "12.5"; blank → null. */
const optionalPercent = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    const s = String(v).trim().replace(/%$/, "");
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(s) || Number(s) > 100) {
      ctx.addIssue({ code: "custom", message: "Enter a percentage between 0 and 100 (max 2 decimals)" });
      return z.NEVER;
    }
    return s;
  });

const commercialShape = {
  revenue_model: optionalEnum(REVENUE_MODELS.values),
  commission_type: optionalEnum(COMMISSION_TYPES.values),
  commission_percentage: optionalPercent,
  fixed_commission: optionalMoney,
  commission_basis: optionalEnum(COMMISSION_BASES.values),
  commission_notes: optionalText(2000),
};

/** Adds commercial-terms errors (percentage needs a % and an explicit basis, …). */
function checkTerms(
  v: { commission_type: string | null; commission_percentage: string | null; fixed_commission: string | null; commission_basis: string | null; commission_custom_base?: string | null },
  ctx: z.RefinementCtx,
) {
  for (const message of validateCommercialTerms(v as never)) {
    const path = message.includes("basis")
      ? "commission_basis"
      : message.includes("custom")
        ? "commission_custom_base"
        : message.includes("percentage")
          ? "commission_percentage"
          : "fixed_commission";
    ctx.addIssue({ code: "custom", message, path: [path] });
  }
}

const opportunityFields = {
  title: requiredText("Opportunity name", 200),
  service_id: optionalUuid,
  description: optionalText(4000),
  estimated_value: optionalMoney,
  expected_close_date: optionalDate,
  probability: z
    .union([z.coerce.number().int().min(0, "0–100").max(100, "0–100"), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  delivery_model: optionalEnum(DELIVERY_MODELS.values),
  partner_id: optionalUuid,
  project_type: optionalEnum(PROJECT_TYPES.values),
  next_action: optionalText(500),
  next_action_date: optionalDate,
  notes: optionalText(4000),
  ...commercialShape,
};

export const opportunityCreateSchema = z
  .object({ prospect_id: uuid, stage_id: optionalUuid, ...opportunityFields })
  .superRefine((v, ctx) => checkTerms(v, ctx));

export const opportunityUpdateSchema = z.object({ id: uuid, ...opportunityFields }).superRefine((v, ctx) => checkTerms(v, ctx));

export const opportunityStageSchema = z.object({
  id: uuid,
  stage_id: uuid,
  discovery_call_date: optionalDate,
  discovery_call_time: optionalTime,
  lost_reason: optionalText(1000),
});

export const clientSchema = z.object({
  company: requiredText("Company", 200),
  primary_contact: optionalText(120),
  email: optionalEmail,
  phone: optionalPhone,
  website: optionalUrl,
  industry: optionalText(120),
  location: optionalText(120),
  notes: optionalText(4000),
  status: z.enum(CLIENT_STATUSES.values),
});

export const convertToClientSchema = z.object({
  prospect_id: uuid,
  opportunity_id: optionalUuid,
  create_project: z.boolean().optional().default(true),
});

const projectFields = {
  name: requiredText("Project name", 200),
  client_id: uuid,
  opportunity_id: optionalUuid,
  service_id: optionalUuid,
  partner_id: optionalUuid,
  delivery_model: optionalEnum(DELIVERY_MODELS.values),
  total_project_value: optionalMoney,
  start_date: optionalDate,
  expected_end_date: optionalDate,
  status: z.enum(PROJECT_STATUSES.values),
  notes: optionalText(4000),
  payment_flow: z.enum(PAYMENT_FLOWS.values),
  partner_cost: optionalMoney,
  commission_custom_base: optionalMoney,
  commission_received: optionalMoney,
  ...commercialShape,
};

function checkProject(
  v: { start_date: string | null; expected_end_date: string | null } & Parameters<typeof checkTerms>[0],
  ctx: z.RefinementCtx,
) {
  checkTerms(v, ctx);
  if (v.start_date && v.expected_end_date && v.expected_end_date < v.start_date) {
    ctx.addIssue({ code: "custom", message: "End date is before the start date", path: ["expected_end_date"] });
  }
}

export const projectCreateSchema = z.object(projectFields).superRefine(checkProject);
export const projectUpdateSchema = z.object({ id: uuid, ...projectFields }).superRefine(checkProject);

export const paymentSchema = z.object({
  project_id: uuid,
  payment_date: requiredDate,
  amount: optionalMoney.refine((v) => v !== null && Number(v) > 0, "Enter an amount greater than zero"),
  payment_type: z.enum(PAYMENT_TYPES.values),
  status: z.enum(PAYMENT_STATUSES.values),
  reference: optionalText(200),
  notes: optionalText(1000),
});
export const paymentUpdateSchema = paymentSchema.extend({ id: uuid });

export const partnerSchema = z.object({
  name: requiredText("Partner name", 200),
  contact_name: optionalText(120),
  email: optionalEmail,
  phone: optionalPhone,
  website: optionalUrl,
  linkedin_url: optionalUrl,
  location: optionalText(120),
  partner_type: z.enum(PARTNER_TYPES.values),
  services: z.array(z.string().trim().min(1).max(120)).max(30).optional().default([]),
  notes: optionalText(4000),
  status: z.enum(PARTNER_STATUSES.values),
});

export const serviceSchema = z.object({
  name: requiredText("Service name", 120),
  category: optionalText(80),
  description: optionalText(2000),
  target_customer: optionalText(1000),
  typical_problem: optionalText(1000),
  delivery_model: optionalEnum(DELIVERY_MODELS.values),
  pricing_model: optionalEnum(PRICING_MODELS.values),
  default_price: optionalMoney,
  discovery_questions: z.array(z.string().trim().min(1).max(500)).max(30).optional().default([]),
  notes: optionalText(4000),
  active: z.boolean().optional().default(true),
});

export const lookupSchema = z.object({
  kind: z.enum(LOOKUP_KINDS.values),
  label: requiredText("Label", 80),
  /** built-in key being relabelled/hidden; otherwise derived from the label */
  value: z.string().regex(/^[a-z0-9_]{1,60}$/).optional(),
  active: z.boolean().optional().default(true),
});

export const pipelineStageSchema = z.object({
  id: optionalUuid,
  label: requiredText("Stage name", 60),
  color: z.enum(STAGE_COLORS),
  kind: z.enum(STAGE_KINDS.values),
  probability: z.coerce.number().int().min(0).max(100),
});

export const qualificationQuestionSchema = z.object({
  question: requiredText("Question", 300),
  help_text: optionalText(300),
  active: z.boolean().optional().default(true),
});

export const handoffCreateSchema = z.object({
  prospect_id: uuid,
  opportunity_id: optionalUuid,
  partner_id: optionalUuid,
  notes: optionalText(4000),
});

export const handoffUpdateSchema = z.object({
  id: uuid,
  summary_markdown: requiredText("Summary", 20000),
  status: z.enum(HANDOFF_STATUSES.values),
  notes: optionalText(4000),
});

export const profileSchema = z.object({
  full_name: requiredText("Name", 120),
  phone: optionalPhone,
  website: optionalUrl,
  linkedin_url: optionalUrl,
});

export const businessProfileSchema = z.object({
  business_name: optionalText(120),
  business_description: optionalText(2000),
  business_website: optionalUrl,
});

export const defaultsSchema = z.object({
  currency: z.enum(CURRENCIES),
  timezone: z
    .string()
    .trim()
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone"),
  follow_up_1_days: z.coerce.number().int().min(1).max(60),
  follow_up_2_days: z.coerce.number().int().min(1).max(60),
});

export const scoringSchema = z
  .object({
    weights: z.record(z.enum(SCORE_FACTORS.map((f) => f.key) as [string, ...string[]]), z.coerce.number().min(0).max(100)),
    hot: z.coerce.number().int().min(1).max(100),
    warm: z.coerce.number().int().min(1).max(99),
  })
  .refine((v) => v.hot > v.warm, { message: "Hot must be higher than Warm", path: ["hot"] })
  .refine((v) => Object.values(v.weights).some((w) => w > 0), { message: "At least one weight must be above zero", path: ["weights"] });

export const importCommitSchema = z.object({
  rows: z
    .array(
      z.object({
        business_name: z.string(),
        contact_name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        website: z.string().optional(),
        linkedin_url: z.string().optional(),
        instagram_url: z.string().optional(),
        industry: z.string().optional(),
        location: z.string().optional(),
        lead_source: z.string(),
        research_notes: z.string().optional(),
      }),
    )
    .min(1, "Nothing to import")
    .max(1000, "Import at most 1,000 rows at a time"),
});
