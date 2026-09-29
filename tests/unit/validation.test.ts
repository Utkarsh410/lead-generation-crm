import { describe, expect, it } from "vitest";
import {
  opportunityCreateSchema,
  opportunityUpdateSchema,
  outreachMessageSchema,
  paymentSchema,
  projectCreateSchema,
  prospectListQuerySchema,
  prospectSchema,
  qualificationSchema,
  responseSchema,
  taskSchema,
} from "@/lib/validation/schemas";
import { prospectToFormValues } from "@/lib/validation/form-values";
import { TASK_COLUMNS, prospectColumns } from "@/lib/data/exports";
import { toCsv } from "@/lib/domain/csv";
import { nextStepFor } from "@/lib/domain/next-step";
import type { Tables } from "@/lib/supabase/database.types";

const ID = "7d4b3c2a-1f00-4a4b-9c7d-2e1f0a9b8c7d";
const minimal = { business_name: "Acme", lead_source: "referral", prospect_type: "startup" };

describe("prospect validation", () => {
  it("accepts a minimal prospect and turns empty strings into null", () => {
    const v = prospectSchema.parse({ ...minimal, email: "", phone: "  ", website: "", estimated_value: "" });
    expect(v.email).toBeNull();
    expect(v.phone).toBeNull();
    expect(v.website).toBeNull();
    expect(v.estimated_value).toBeNull();
    expect(v.has_website).toBeNull(); // indicators default to unknown
  });

  it("requires a business name (whitespace is not a name)", () => {
    expect(prospectSchema.safeParse({ ...minimal, business_name: "   " }).success).toBe(false);
    expect(prospectSchema.safeParse({ lead_source: "referral", prospect_type: "startup" }).success).toBe(false);
  });

  it("rejects invalid emails, phones, URLs and enums", () => {
    const cases: Record<string, unknown> = {
      email: "not-an-email",
      phone: "call me",
      whatsapp: "123",
      website: "javascript:alert(1)",
      linkedin_url: "no spaces allowed here",
      lead_source: "Not A Key!",
      prospect_type: "unicorn",
      company_size: "huge",
    };
    for (const [field, value] of Object.entries(cases)) {
      const r = prospectSchema.safeParse({ ...minimal, [field]: value });
      expect(r.success, field).toBe(false);
    }
  });

  it("accepts custom lead source keys (checked against the user's list on save)", () => {
    expect(prospectSchema.parse({ ...minimal, lead_source: "podcast_guests" }).lead_source).toBe("podcast_guests");
  });

  it("normalises email case and adds https to bare domains", () => {
    const v = prospectSchema.parse({ ...minimal, email: " Priya@Example.COM ", website: "example.com" });
    expect(v.email).toBe("priya@example.com");
    expect(v.website).toBe("https://example.com");
  });

  it("validates money and score factors", () => {
    expect(prospectSchema.parse({ ...minimal, estimated_value: "₹1.5L" }).estimated_value).toBe("150000.00");
    expect(prospectSchema.safeParse({ ...minimal, estimated_value: "-5000" }).success).toBe(false);
    expect(prospectSchema.safeParse({ ...minimal, estimated_value: "lots" }).success).toBe(false);
    expect(prospectSchema.safeParse({ ...minimal, score_factors: { urgency: 7 } }).success).toBe(false);
    expect(prospectSchema.parse({ ...minimal, score_factors: { urgency: "2" } }).score_factors.urgency).toBe(2);
  });

  it("list query ignores garbage params instead of failing", () => {
    expect(prospectListQuerySchema.parse({ stage: "nope", page: "-3", sort: "drop table", q: "abc" })).toEqual({
      q: "abc",
      stage: undefined,
      page: undefined,
      sort: undefined,
      type: undefined,
      source: undefined,
      temp: undefined,
      archived: undefined,
      demo: undefined,
      dir: undefined,
    });
  });

  it("round-trips a database row through the edit form", () => {
    const row = {
      ...Object.fromEntries(Object.keys(prospectSchema.shape).map((k) => [k, null])),
      business_name: "Acme",
      lead_source: "referral",
      prospect_type: "startup",
      has_website: true,
      has_lms: false,
      estimated_value: 150000,
      score_factors: { urgency: 3 },
    } as unknown as Tables<"prospects">;
    const form = prospectToFormValues(row);
    expect(form.has_website).toBe("yes");
    expect(form.has_lms).toBe("no");
    expect(form.has_ecommerce).toBe("unknown");
    const parsed = prospectSchema.parse(form);
    expect(parsed.has_website).toBe(true);
    expect(parsed.has_lms).toBe(false);
    expect(parsed.has_ecommerce).toBeNull();
    expect(parsed.estimated_value).toBe("150000.00");
  });
});

describe("other schemas", () => {
  it("tasks require a valid date and title", () => {
    expect(taskSchema.safeParse({ task_type: "follow_up", title: "", due_date: "2026-10-01", priority: "low" }).success).toBe(false);
    expect(taskSchema.safeParse({ task_type: "follow_up", title: "x", due_date: "2026-02-30", priority: "low" }).success).toBe(false);
    expect(taskSchema.safeParse({ task_type: "follow_up", title: "x", due_date: "2026-10-01", due_time: "25:00", priority: "low" }).success).toBe(false);
    expect(taskSchema.parse({ task_type: "follow_up", title: "x", due_date: "2026-10-01", priority: "low", prospect_id: "" }).prospect_id).toBeNull();
  });

  it("not-now responses require a follow-up date", () => {
    const base = { message_id: ID, response_status: "not_now", response_date: "2026-09-28" };
    expect(responseSchema.safeParse(base).success).toBe(false);
    expect(responseSchema.safeParse({ ...base, follow_up_date: "2026-12-01" }).success).toBe(true);
  });

  it("outreach requires a non-empty message", () => {
    const base = { prospect_id: ID, channel: "email", outreach_stage: "first_contact", sent_date: "2026-09-28" };
    expect(outreachMessageSchema.safeParse({ ...base, customized_message: "   " }).success).toBe(false);
    expect(outreachMessageSchema.safeParse({ ...base, customized_message: "Hi" }).success).toBe(true);
  });

  it("qualification ratings must be 1–5 and budget max ≥ min", () => {
    const ok = {
      prospect_id: ID,
      need_clarity: 3,
      budget_fit: 3,
      timeline_fit: 3,
      decision_maker_access: 3,
      urgency: 3,
      solution_fit: 4,
      delivery_feasibility: 2,
    };
    expect(qualificationSchema.safeParse(ok).success).toBe(true);
    expect(qualificationSchema.parse({ ...ok, custom_answers: [{ question: "Agency before?", answer: "Yes" }] }).custom_answers).toHaveLength(1);
    expect(qualificationSchema.safeParse({ ...ok, urgency: 0 }).success).toBe(false);
    expect(qualificationSchema.safeParse({ ...ok, urgency: 6 }).success).toBe(false);
    expect(qualificationSchema.safeParse({ ...ok, budget_min: "2L", budget_max: "1L" }).success).toBe(false);
  });

  it("commission percentage must be 0–100 with ≤2 decimals and needs an explicit basis", () => {
    const base = { id: ID, title: "Deal", commission_type: "percentage", commission_basis: "amount_received" };
    expect(opportunityUpdateSchema.parse({ ...base, commission_percentage: "12.5%" }).commission_percentage).toBe("12.5");
    for (const bad of ["101", "-1", "12.345", "ten"]) {
      expect(opportunityUpdateSchema.safeParse({ ...base, commission_percentage: bad }).success, bad).toBe(false);
    }
    // no basis → rejected, with the error on the basis field
    const r = opportunityUpdateSchema.safeParse({ ...base, commission_basis: "", commission_percentage: "10" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["commission_basis"]);
    // terms are optional overall — nothing is assumed
    const none = opportunityCreateSchema.parse({ prospect_id: ID, title: "Deal" });
    expect(none.commission_type).toBeNull();
    expect(none.commission_percentage).toBeNull();
    expect(none.probability).toBeNull();
  });

  it("projects validate money flow, dates and terms; payments need a positive amount", () => {
    const base = { name: "Website", client_id: ID, status: "active", payment_flow: "client_pays_me" };
    expect(projectCreateSchema.safeParse(base).success).toBe(true);
    expect(projectCreateSchema.safeParse({ ...base, payment_flow: "barter" }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ ...base, start_date: "2026-10-10", expected_end_date: "2026-10-01" }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ ...base, commission_type: "percentage", commission_percentage: "5", commission_basis: "custom" }).success).toBe(false);
    expect(projectCreateSchema.parse({ ...base, total_project_value: "2L" }).total_project_value).toBe("200000.00");
    const pay = { project_id: ID, payment_date: "2026-09-28", payment_type: "advance", status: "received" };
    expect(paymentSchema.safeParse({ ...pay, amount: "0" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...pay, amount: "" }).success).toBe(false);
    expect(paymentSchema.parse({ ...pay, amount: "50,000" }).amount).toBe("50000.00");
  });
});

describe("CSV export columns", () => {
  it("exports prospects with readable labels and fixed-point money", () => {
    const row = {
      business_name: "=Evil Co",
      contact_name: "Priya, Shah",
      prospect_type: "agency",
      lead_source: "podcast_guests",
      stage: "qualified",
      estimated_value: 150000,
      archived_at: null,
      is_demo: true,
    } as unknown as Tables<"prospects">;
    const label = (s: string) => (s === "podcast_guests" ? "Podcast guests" : s);
    const [header, line] = toCsv([row], prospectColumns(label)).replace("﻿", "").split("\r\n");
    expect(header.split(",")[0]).toBe("Business");
    expect(line).toContain("'=Evil Co");
    expect(line).toContain('"Priya, Shah"');
    expect(line).toContain("Agency");
    expect(line).toContain("Podcast guests");
    expect(line).toContain("Qualified");
    expect(header).not.toContain("INR");
    expect(line).toContain("150000.00");
  });

  it("labels internal tasks without a prospect", () => {
    const csv = toCsv([{ due_date: "2026-10-01", prospects: null, task_type: "other", title: "Plan week", priority: "low", status: "pending", is_automated: false } as never], TASK_COLUMNS);
    expect(csv).toContain("(internal)");
  });
});

describe("next step", () => {
  const base = {
    archived: false,
    hasObservedProblem: true,
    hasContactMethod: true,
    messagesSent: 0,
    awaitingResponse: false,
    nextFollowUpDate: null,
    today: "2026-09-28",
    hasQualification: false,
    opportunities: [],
    isClient: false,
  };
  const opp = (stageKey: "qualified" | "proposal" | "negotiation" | "won", stageKind: "open" | "won" = "open") => ({ id: "o1", title: "Website", stageKey, stageKind });

  it("guides each lead status to an action", () => {
    expect(nextStepFor({ ...base, stage: "new", hasContactMethod: false }).action).toBe("research");
    expect(nextStepFor({ ...base, stage: "new" }).action).toBe("first_outreach");
    expect(nextStepFor({ ...base, stage: "contacted", nextFollowUpDate: "2026-09-27" }).action).toBe("follow_up");
    expect(nextStepFor({ ...base, stage: "contacted", nextFollowUpDate: "2026-10-01" }).action).toBe("record_response");
    expect(nextStepFor({ ...base, stage: "replied" }).action).toBe("qualify");
    expect(nextStepFor({ ...base, stage: "replied", hasQualification: true }).action).toBe("create_opportunity");
    expect(nextStepFor({ ...base, stage: "qualified" }).action).toBe("create_opportunity");
    expect(nextStepFor({ ...base, stage: "nurture" }).action).toBe("re_engage");
    expect(nextStepFor({ ...base, stage: "qualified", archived: true }).action).toBe("restore");
  });

  it("follows the most important open opportunity", () => {
    expect(nextStepFor({ ...base, stage: "qualified", opportunities: [opp("qualified")] }).action).toBe("schedule_call");
    expect(nextStepFor({ ...base, stage: "qualified", opportunities: [opp("qualified"), { ...opp("proposal"), id: "o2" }] }).action).toBe("proposal_follow_up");
    expect(nextStepFor({ ...base, stage: "qualified", opportunities: [opp("negotiation")] }).action).toBe("advance_opportunity");
  });

  it("won deals lead to client conversion, then client care", () => {
    expect(nextStepFor({ ...base, stage: "qualified", opportunities: [opp("won", "won")] }).action).toBe("convert_client");
    expect(nextStepFor({ ...base, stage: "client", isClient: true, opportunities: [opp("won", "won")] }).action).toBe("manage_client");
  });
});
