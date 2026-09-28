import { z } from "zod";
import {
  COMPANY_SIZES,
  COMPLEXITY,
  HANDOFF_STATUSES,
  LEAD_SOURCES,
  OPPORTUNITY_STATUSES,
  OUTREACH_CHANNELS,
  OUTREACH_STAGES,
  PIPELINE_STAGES,
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

  lead_source: z.enum(LEAD_SOURCES.values, { error: "Choose a lead source" }),
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

export const prospectListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  stage: z.enum(PIPELINE_STAGES.values).optional().catch(undefined),
  type: z.enum(PROSPECT_TYPES.values).optional().catch(undefined),
  source: z.enum(LEAD_SOURCES.values).optional().catch(undefined),
  temp: z.enum(["cold", "warm", "hot"]).optional().catch(undefined),
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

export const stageChangeSchema = z.object({
  prospect_id: uuid,
  to: z.enum(PIPELINE_STAGES.values),
  discovery_call_date: optionalDate,
  discovery_call_time: optionalTime,
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

export const taskSchema = z.object({
  prospect_id: uuid.optional().nullable().or(z.literal("").transform(() => null)),
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

export const qualificationSchema = z
  .object({
    prospect_id: uuid,
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
    need_clarity: rating,
    budget_fit: rating,
    timeline_fit: rating,
    decision_maker_access: rating,
    urgency: rating,
    classification: optionalEnum(QUALIFICATION_CLASSES.values),
    notes: optionalText(4000),
    /** Move the prospect to "Qualified" when the final class is Qualified/High Priority. */
    advance_stage: z.boolean().optional().default(true),
  })
  .refine((v) => !v.budget_min || !v.budget_max || Number(v.budget_max) >= Number(v.budget_min), {
    message: "Maximum budget must be at least the minimum",
    path: ["budget_max"],
  });

// ---------------------------------------------------------------------------
// Opportunities / handoffs / reference data
// ---------------------------------------------------------------------------

export const opportunitySchema = z.object({
  id: uuid,
  title: requiredText("Title", 200),
  project_type: optionalEnum(PROJECT_TYPES.values),
  status: z.enum(OPPORTUNITY_STATUSES.values),
  estimated_value: optionalMoney,
  eligible_project_amount: optionalMoney,
  agreed_commission_pct: z
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
    }),
  eligible_amount_received: optionalMoney,
  commission_paid: optionalMoney,
  pass_through_notes: optionalText(2000),
  expected_close_date: optionalDate,
  notes: optionalText(4000),
});

export const handoffCreateSchema = z.object({
  prospect_id: uuid,
  notes: optionalText(4000),
});

export const handoffUpdateSchema = z.object({
  id: uuid,
  summary_markdown: requiredText("Summary", 20000),
  status: z.enum(HANDOFF_STATUSES.values),
  notes: optionalText(4000),
});

export const projectTypeSchema = z.object({
  id: uuid,
  name: requiredText("Name", 120),
  description: optionalText(2000),
  typical_client: optionalText(2000),
  typical_problem: optionalText(2000),
  potential_solution: optionalText(2000),
  discovery_questions: z.array(z.string().trim().min(1).max(500)).max(30),
  notes: optionalText(4000),
});

export const profileSchema = z.object({
  full_name: requiredText("Name", 120),
});
