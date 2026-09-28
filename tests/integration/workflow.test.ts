import { beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled, memberClient, TODAY } from "./helpers";
import { createProspect, getProspectOrThrow, setArchived, updateProspect } from "@/lib/data/prospects";
import { recordOutreach, recordResponse } from "@/lib/data/outreach";
import { changeStage } from "@/lib/data/pipeline";
import { saveQualification } from "@/lib/data/qualification";
import { createHandoff } from "@/lib/data/handoffs";
import { createTask, rescheduleTask, setTaskStatus } from "@/lib/data/tasks";
import { buildExport } from "@/lib/data/exports";
import { prospectSchema, qualificationSchema } from "@/lib/validation/schemas";
import { addDays } from "@/lib/domain/dates";
import type { Db } from "@/lib/supabase/types";

const base = {
  business_name: "ABC Physiotherapy",
  contact_name: "John Doe",
  job_title: "Founder",
  email: "john@abcphysio.in",
  phone: "+91 98765 43210",
  website: "abcphysio.in",
  instagram_url: "instagram.com/abcphysio",
  location: "Pune",
  industry: "Healthcare",
  lead_source: "instagram",
  prospect_type: "direct_business",
  observed_problem: "Current website does not support online appointment booking.",
  suggested_solution: "New website + appointment booking + enquiry management.",
  potential_project: "website",
  estimated_value: "1.5L",
  has_online_booking: "no",
  score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 2, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 2, project_value: 2 },
};

async function tasksFor(db: Db, prospectId: string) {
  const { data } = await db.from("tasks").select("*").eq("prospect_id", prospectId).order("created_at");
  return data ?? [];
}

describe.skipIf(!integrationEnabled)("acceptance workflow", () => {
  let db: Db;
  let prospectId: string;

  beforeAll(async () => {
    ({ db } = await memberClient("Utkarsh"));
  });

  it("1–4. creates a prospect with research, links and a computed opportunity score", async () => {
    const values = prospectSchema.parse(base);
    const result = await createProspect(db, values, { confirmDuplicate: false, firstOutreachDue: TODAY });
    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    prospectId = result.id;

    const p = await getProspectOrThrow(db, prospectId);
    expect(p.website).toBe("https://abcphysio.in");
    expect(p.website_domain).toBe("abcphysio.in");
    expect(p.phone_normalized).toBe("9876543210");
    expect(Number(p.estimated_value)).toBe(150000);
    expect(p.has_online_booking).toBe(false);
    expect(p.has_lms).toBeNull(); // never assumed
    expect(p.opportunity_score).toBe(90);
    expect(p.lead_temperature).toBe("hot");
    expect(p.stage).toBe("prospect");
    expect(p.next_follow_up_date).toBe(TODAY); // first outreach reminder
  });

  it("detects duplicates by domain/email/phone/name+location and allows override", async () => {
    const dup = prospectSchema.parse({ ...base, business_name: "ABC Physio Pvt Ltd", email: "HELLO@ABCPHYSIO.IN", website: "https://www.abcphysio.in/about" });
    const result = await createProspect(db, dup, { confirmDuplicate: false });
    expect(result.status).toBe("duplicates");
    if (result.status === "duplicates") {
      expect(result.duplicates[0].prospect.id).toBe(prospectId);
      expect(result.duplicates[0].reasons).toContain("website");
      expect(result.duplicates[0].reasons).toContain("phone");
    }
    const forced = await createProspect(db, dup, { confirmDuplicate: true });
    expect(forced.status).toBe("saved");
    if (forced.status === "saved") await setArchived(db, [forced.id], true);
  });

  it("edits a prospect and re-scores it (and ignores self when checking duplicates)", async () => {
    const values = prospectSchema.parse({ ...base, contact_name: "John D.", score_factors: { ...base.score_factors, urgency: 3 } });
    const result = await updateProspect(db, prospectId, values, { confirmDuplicate: false });
    // the archived forced duplicate still shares keys with this record → user must confirm
    expect(result.status).toBe("saved"); // keys unchanged → no duplicate check needed
    const p = await getProspectOrThrow(db, prospectId);
    expect(p.contact_name).toBe("John D.");
    expect(p.opportunity_score).toBe(93);
  });

  it("5–8. records first outreach → stage Contacted + Follow-up #1 in 3 days", async () => {
    const result = await recordOutreach(
      db,
      {
        prospect_id: prospectId,
        template_id: null,
        channel: "instagram",
        outreach_stage: "first_contact",
        subject: null,
        customized_message: "Hi John, noticed your site has no online booking…",
        sent_date: TODAY,
        notes: null,
        allow_placeholders: false,
      },
      TODAY,
    );
    expect(result.stage).toBe("contacted");
    const p = await getProspectOrThrow(db, prospectId);
    expect(p.stage).toBe("contacted");
    expect(p.last_contacted_at).not.toBeNull();

    const tasks = await tasksFor(db, prospectId);
    const firstOutreach = tasks.find((t) => t.task_type === "first_outreach");
    expect(firstOutreach?.status).toBe("completed");
    const fu1 = tasks.find((t) => t.sequence_step === "follow_up_1");
    expect(fu1).toMatchObject({ status: "pending", due_date: addDays(TODAY, 3), is_automated: true });
    expect(p.next_follow_up_date).toBe(addDays(TODAY, 3));
  });

  it("refuses to record messages with unfilled placeholders or future dates", async () => {
    const input = {
      prospect_id: prospectId,
      template_id: null,
      channel: "email" as const,
      outreach_stage: "follow_up_1" as const,
      subject: null,
      customized_message: "Hi {{first_name}}",
      sent_date: TODAY,
      notes: null,
      allow_placeholders: false,
    };
    await expect(recordOutreach(db, input, TODAY)).rejects.toThrow(/first_name/);
    await expect(recordOutreach(db, { ...input, customized_message: "Hi", sent_date: addDays(TODAY, 1) }, TODAY)).rejects.toThrow(/future/);
  });

  it("follow-up #1 sent → Follow-up #2 in 5 days", async () => {
    await recordOutreach(
      db,
      {
        prospect_id: prospectId,
        template_id: null,
        channel: "instagram",
        outreach_stage: "follow_up_1",
        subject: null,
        customized_message: "Just following up…",
        sent_date: addDays(TODAY, 0),
        notes: null,
        allow_placeholders: false,
      },
      TODAY,
    );
    const tasks = await tasksFor(db, prospectId);
    expect(tasks.find((t) => t.sequence_step === "follow_up_1")?.status).toBe("completed");
    expect(tasks.find((t) => t.sequence_step === "follow_up_2")).toMatchObject({ status: "pending", due_date: addDays(TODAY, 5) });
  });

  it("9. reply → cancels automated follow-ups, moves to Replied, adds qualify task", async () => {
    const { data: msgs } = await db.from("outreach_messages").select("id").eq("prospect_id", prospectId).order("sent_at", { ascending: false });
    await recordResponse(
      db,
      { message_id: msgs![0].id, response_status: "interested", response_date: TODAY, response_notes: "Wants a call this week", follow_up_date: null },
      TODAY,
    );
    const p = await getProspectOrThrow(db, prospectId);
    expect(p.stage).toBe("replied");
    const tasks = await tasksFor(db, prospectId);
    expect(tasks.find((t) => t.sequence_step === "follow_up_2")?.status).toBe("cancelled");
    expect(tasks.find((t) => t.task_type === "qualification")).toMatchObject({ status: "pending", priority: "urgent", due_date: TODAY });
  });

  it("10–11. qualification scores, classifies and advances to Qualified with an opportunity", async () => {
    const values = qualificationSchema.parse({
      prospect_id: prospectId,
      problem_description: "Current website does not support online appointment booking.",
      project_type: "website",
      required_features: "Website, appointment booking, enquiry management",
      timeline_notes: "4–6 weeks",
      budget_min: "1L",
      budget_max: "2L",
      decision_maker_identified: true,
      decision_maker_name: "Founder",
      need_clarity: 5,
      budget_fit: 4,
      timeline_fit: 4,
      decision_maker_access: 5,
      urgency: 4,
      notes: "Client is interested in discussing requirements this week.",
    });
    const result = await saveQualification(db, values, TODAY);
    expect(result.score).toBe(85);
    expect(result.classification).toBe("high_priority");
    expect(result.movedTo).toBe("qualified");

    const p = await getProspectOrThrow(db, prospectId);
    expect(p.stage).toBe("qualified");
    const { data: opps } = await db.from("opportunities").select("*").eq("prospect_id", prospectId);
    expect(opps).toHaveLength(1);
    expect(opps![0].agreed_commission_pct).toBeNull(); // never auto-filled
    const tasks = await tasksFor(db, prospectId);
    expect(tasks.find((t) => t.task_type === "qualification")?.status).toBe("completed");
    expect(tasks.find((t) => t.task_type === "handoff")?.status).toBe("pending");
  });

  it("human judgement can override the suggested classification", async () => {
    const values = qualificationSchema.parse({
      prospect_id: prospectId,
      need_clarity: 2,
      budget_fit: 2,
      timeline_fit: 2,
      decision_maker_access: 2,
      urgency: 2,
      classification: "potential",
      advance_stage: false,
    });
    const r = await saveQualification(db, values, TODAY);
    expect(r.suggested).toBe("unqualified");
    expect(r.classification).toBe("potential");
    // re-assess back to the real values for the handoff below
    await saveQualification(
      db,
      qualificationSchema.parse({
        prospect_id: prospectId,
        problem_description: "Current website does not support online appointment booking.",
        budget_min: "1L",
        budget_max: "2L",
        timeline_notes: "4–6 weeks",
        decision_maker_identified: true,
        decision_maker_name: "Founder",
        need_clarity: 5,
        budget_fit: 4,
        timeline_fit: 4,
        decision_maker_access: 5,
        urgency: 4,
      }),
      TODAY,
    );
  });

  it("12. schedules a discovery call via stage change (past dates rejected)", async () => {
    await expect(
      changeStage(db, { prospect_id: prospectId, to: "discovery_call", discovery_call_date: addDays(TODAY, -1) }, TODAY),
    ).rejects.toThrow(/past/);
    await changeStage(db, { prospect_id: prospectId, to: "discovery_call", discovery_call_date: addDays(TODAY, 2), discovery_call_time: "11:30" }, TODAY);
    const tasks = await tasksFor(db, prospectId);
    expect(tasks.find((t) => t.task_type === "discovery_call")).toMatchObject({ due_date: addDays(TODAY, 2), due_time: "11:30:00" });
    const { data: acts } = await db.from("activities").select("activity_type, metadata").eq("prospect_id", prospectId).eq("activity_type", "stage_change");
    expect(acts!.map((a) => (a.metadata as { to: string }).to)).toEqual(expect.arrayContaining(["contacted", "replied", "qualified", "discovery_call"]));
  });

  it("13–14. prepares a copyable handoff and completes the handoff reminder", async () => {
    const { id, gaps } = await createHandoff(db, { prospect_id: prospectId, notes: "Call booked for Thursday." }, { generatedBy: "Utkarsh", today: TODAY });
    const { data: h } = await db.from("handoffs").select("*").eq("id", id).single();
    expect(h!.summary_markdown).toContain("## BharatCoder Lead Handoff");
    expect(h!.summary_markdown).toContain("ABC Physiotherapy");
    expect(h!.summary_markdown).toContain("₹1L–2L");
    expect(h!.summary_markdown).toContain("Lead generated by:**\n  Utkarsh");
    expect(gaps).toEqual([]);
    const tasks = await tasksFor(db, prospectId);
    expect(tasks.find((t) => t.task_type === "handoff")?.status).toBe("completed");
  });

  it("15. tracks the lead to Won and closes the opportunity + automated tasks", async () => {
    for (const to of ["technical_discussion", "proposal_sent", "negotiation", "won"] as const) {
      await changeStage(db, { prospect_id: prospectId, to }, TODAY);
    }
    const p = await getProspectOrThrow(db, prospectId);
    expect(p.stage).toBe("won");
    expect(p.furthest_stage).toBe("won");
    const { data: opps } = await db.from("opportunities").select("status, closed_at").eq("prospect_id", prospectId);
    expect(opps![0].status).toBe("won");
    const tasks = await tasksFor(db, prospectId);
    expect(tasks.filter((t) => t.is_automated && t.status === "pending")).toHaveLength(0);
  });

  it("16. appears in exports (qualified leads, outreach history, follow-ups)", async () => {
    const qualified = await buildExport(db, "qualified");
    expect(qualified).toContain("ABC Physiotherapy");
    const outreach = await buildExport(db, "outreach");
    expect(outreach.split("\r\n").length).toBeGreaterThan(2);
    const prospects = await buildExport(db, "prospects", { query: { q: "physio" } });
    expect(prospects.split("\r\n")[1]).toContain("ABC Physiotherapy");
    const followUps = await buildExport(db, "follow-ups");
    expect(followUps.startsWith("﻿Due date,")).toBe(true);
  });
});

describe.skipIf(!integrationEnabled)("follow-up edge cases", () => {
  it("not now → custom follow-up; not interested stops sequence; past dates rejected", async () => {
    const { db } = await memberClient();
    const created = await createProspect(db, prospectSchema.parse({ business_name: "Later Co", lead_source: "linkedin", prospect_type: "startup" }), { confirmDuplicate: false });
    if (created.status !== "saved") throw new Error();
    const { messageId } = await recordOutreach(
      db,
      { prospect_id: created.id, template_id: null, channel: "linkedin", outreach_stage: "first_contact", subject: null, customized_message: "Hi!", sent_date: TODAY, notes: null, allow_placeholders: false },
      TODAY,
    );
    await expect(
      recordResponse(db, { message_id: messageId, response_status: "not_now", response_date: TODAY, response_notes: null, follow_up_date: null }, TODAY),
    ).rejects.toThrow(/Choose when/);
    await expect(
      recordResponse(db, { message_id: messageId, response_status: "not_now", response_date: TODAY, response_notes: null, follow_up_date: addDays(TODAY, -3) }, TODAY),
    ).rejects.toThrow(/past/);
    await recordResponse(db, { message_id: messageId, response_status: "not_now", response_date: TODAY, response_notes: "Q1", follow_up_date: "2027-01-15" }, TODAY);
    const tasks = await tasksFor(db, created.id);
    expect(tasks.find((t) => t.sequence_step === "follow_up_1")?.status).toBe("cancelled");
    expect(tasks.find((t) => t.due_date === "2027-01-15")?.status).toBe("pending");

    // tasks: create / complete / reschedule with past-date protection
    await expect(
      createTask(db, { prospect_id: created.id, task_type: "other", title: "x", due_date: addDays(TODAY, -1), due_time: null, priority: "low", notes: null }, TODAY),
    ).rejects.toThrow(/past/);
    const t = await createTask(db, { prospect_id: created.id, task_type: "other", title: "Check website", due_date: TODAY, due_time: null, priority: "low", notes: null }, TODAY);
    await expect(rescheduleTask(db, t.id, addDays(TODAY, -2), TODAY, false)).rejects.toThrow(/past/);
    await rescheduleTask(db, t.id, addDays(TODAY, 7), TODAY, true);
    await setTaskStatus(db, t.id, "completed");
    await expect(rescheduleTask(db, t.id, addDays(TODAY, 9), TODAY, false)).rejects.toThrow(/open tasks/);

    // archiving cancels open follow-ups and blocks new activity
    await setArchived(db, [created.id], true);
    const after = await tasksFor(db, created.id);
    expect(after.filter((x) => x.status === "pending" || x.status === "snoozed")).toHaveLength(0);
    await expect(changeStage(db, { prospect_id: created.id, to: "replied" }, TODAY)).rejects.toThrow(/archived/);
    await expect(
      createTask(db, { prospect_id: created.id, task_type: "other", title: "x", due_date: TODAY, due_time: null, priority: "low", notes: null }, TODAY),
    ).rejects.toThrow(/archived/);
    await setArchived(db, [created.id], false);
    expect((await getProspectOrThrow(db, created.id)).archived_at).toBeNull();
  });

  it("lost prospects keep their furthest stage for funnel metrics", async () => {
    const { db } = await memberClient();
    const created = await createProspect(db, prospectSchema.parse({ business_name: "Gone Co", lead_source: "other", prospect_type: "other" }), { confirmDuplicate: false });
    if (created.status !== "saved") throw new Error();
    await changeStage(db, { prospect_id: created.id, to: "replied" }, TODAY);
    await changeStage(db, { prospect_id: created.id, to: "lost", lost_reason: "Went with another agency" }, TODAY);
    const p = await getProspectOrThrow(db, created.id);
    expect(p.stage).toBe("lost");
    expect(p.furthest_stage).toBe("replied");
    expect(p.lost_reason).toBe("Went with another agency");
    await expect(changeStage(db, { prospect_id: created.id, to: "lost" }, TODAY)).rejects.toThrow(/already/);
  });
});
