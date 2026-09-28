import { describe, expect, it } from "vitest";
import {
  opportunitySchema,
  outreachMessageSchema,
  prospectListQuerySchema,
  prospectSchema,
  qualificationSchema,
  responseSchema,
  taskSchema,
} from "@/lib/validation/schemas";
import { prospectToFormValues } from "@/lib/validation/form-values";
import { PROSPECT_COLUMNS, TASK_COLUMNS } from "@/lib/data/exports";
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
      lead_source: "tiktok",
      prospect_type: "unicorn",
      company_size: "huge",
    };
    for (const [field, value] of Object.entries(cases)) {
      const r = prospectSchema.safeParse({ ...minimal, [field]: value });
      expect(r.success, field).toBe(false);
    }
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
    const ok = { prospect_id: ID, need_clarity: 3, budget_fit: 3, timeline_fit: 3, decision_maker_access: 3, urgency: 3 };
    expect(qualificationSchema.safeParse(ok).success).toBe(true);
    expect(qualificationSchema.safeParse({ ...ok, urgency: 0 }).success).toBe(false);
    expect(qualificationSchema.safeParse({ ...ok, urgency: 6 }).success).toBe(false);
    expect(qualificationSchema.safeParse({ ...ok, budget_min: "2L", budget_max: "1L" }).success).toBe(false);
  });

  it("commission percentage must be 0–100 with ≤2 decimals", () => {
    const base = { id: ID, title: "Deal", status: "open" };
    expect(opportunitySchema.parse({ ...base, agreed_commission_pct: "12.5%" }).agreed_commission_pct).toBe("12.5");
    expect(opportunitySchema.parse({ ...base, agreed_commission_pct: "" }).agreed_commission_pct).toBeNull();
    for (const bad of ["101", "-1", "12.345", "ten"]) {
      expect(opportunitySchema.safeParse({ ...base, agreed_commission_pct: bad }).success, bad).toBe(false);
    }
  });
});

describe("CSV export columns", () => {
  it("exports prospects with readable labels and fixed-point money", () => {
    const row = {
      business_name: "=Evil Co",
      contact_name: "Priya, Shah",
      prospect_type: "seo_agency",
      lead_source: "google_maps",
      stage: "discovery_call",
      estimated_value: 150000,
      archived_at: null,
      is_demo: true,
    } as unknown as Tables<"prospects">;
    const [header, line] = toCsv([row], PROSPECT_COLUMNS).replace("﻿", "").split("\r\n");
    expect(header.split(",")[0]).toBe("Business");
    expect(line).toContain("'=Evil Co");
    expect(line).toContain('"Priya, Shah"');
    expect(line).toContain("SEO Agency");
    expect(line).toContain("Google Maps");
    expect(line).toContain("Discovery Call");
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
    hasHandoff: false,
  };
  it("guides each stage to an action", () => {
    expect(nextStepFor({ ...base, stage: "prospect", hasContactMethod: false }).action).toBe("research");
    expect(nextStepFor({ ...base, stage: "prospect" }).action).toBe("first_outreach");
    expect(nextStepFor({ ...base, stage: "contacted", nextFollowUpDate: "2026-09-27" }).action).toBe("follow_up");
    expect(nextStepFor({ ...base, stage: "contacted", nextFollowUpDate: "2026-10-01" }).action).toBe("record_response");
    expect(nextStepFor({ ...base, stage: "replied" }).action).toBe("qualify");
    expect(nextStepFor({ ...base, stage: "qualified", hasQualification: true }).action).toBe("handoff");
    expect(nextStepFor({ ...base, stage: "won" }).action).toBe("track_commission");
    expect(nextStepFor({ ...base, stage: "won", archived: true }).action).toBe("restore");
  });
});
