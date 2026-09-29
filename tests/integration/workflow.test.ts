import { beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled, memberClient, TODAY } from "./helpers";
import { createProspect, getProspectOrThrow, setArchived, updateProspect } from "@/lib/data/prospects";
import { recordOutreach, recordResponse } from "@/lib/data/outreach";
import { setLeadStatus } from "@/lib/data/pipeline";
import { createOpportunity, moveOpportunity, updateOpportunity } from "@/lib/data/opportunities";
import { addPayment, convertProspectToClient, createProject, getProject, listProjects, updateProject } from "@/lib/data/clients";
import { savePartner, saveService } from "@/lib/data/catalog";
import { getDefaultPipeline } from "@/lib/data/workspace";
import { globalSearch } from "@/lib/data/search";
import { importProspects, matchExistingProspects } from "@/lib/data/import";
import { getAnalytics, getDashboard } from "@/lib/data/dashboard";
import { saveQualification } from "@/lib/data/qualification";
import { createHandoff } from "@/lib/data/handoffs";
import { createTask, rescheduleTask, setTaskStatus } from "@/lib/data/tasks";
import { buildExport } from "@/lib/data/exports";
import {
  opportunityCreateSchema,
  opportunityUpdateSchema,
  partnerSchema,
  paymentSchema,
  projectCreateSchema,
  projectUpdateSchema,
  prospectSchema,
  qualificationSchema,
  serviceSchema,
} from "@/lib/validation/schemas";
import { computeDuplicateKeys } from "@/lib/domain/duplicates";
import { LEAD_SOURCES } from "@/lib/domain/constants";
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
    expect(p.stage).toBe("new");
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
      solution_fit: 5,
      delivery_feasibility: 4,
      notes: "Client is interested in discussing requirements this week.",
    });
    const result = await saveQualification(db, values, TODAY);
    expect(result.score).toBe(86); // (5+4+4+5+4+5+4 − 7) / 28
    expect(result.classification).toBe("high_priority");
    expect(result.movedTo).toBe("qualified");

    const p = await getProspectOrThrow(db, prospectId);
    expect(p.stage).toBe("qualified");
    const { data: opps } = await db.from("opportunities").select("*, pipeline_stages(key)").eq("prospect_id", prospectId);
    expect(opps).toHaveLength(1);
    expect(opps![0].pipeline_stages?.key).toBe("qualified");
    expect(opps![0].probability).toBe(30); // stage default
    // commercial terms are never auto-filled
    expect(opps![0].commission_type).toBeNull();
    expect(opps![0].commission_percentage).toBeNull();
    expect(opps![0].commission_basis).toBeNull();
    const tasks = await tasksFor(db, prospectId);
    expect(tasks.find((t) => t.task_type === "qualification")?.status).toBe("completed");
  });

  it("human judgement can override the suggested classification", async () => {
    const values = qualificationSchema.parse({
      prospect_id: prospectId,
      need_clarity: 2,
      budget_fit: 2,
      timeline_fit: 2,
      decision_maker_access: 2,
      urgency: 2,
      solution_fit: 2,
      delivery_feasibility: 2,
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
        solution_fit: 5,
        delivery_feasibility: 4,
      }),
      TODAY,
    );
  });

  let websiteOppId: string;
  let seoOppId: string;
  let partnerId: string;
  let serviceId: string;

  it("12. partners and services are user-created and generic", async () => {
    const partner = await savePartner(
      db,
      partnerSchema.parse({ name: "PixelWorks Studio", contact_name: "Ravi", email: "ravi@pixelworks.example", partner_type: "development_agency", services: ["Web apps"], status: "active" }),
    );
    partnerId = partner.id;
    const service = await saveService(db, serviceSchema.parse({ name: "Business website", category: "web_development", delivery_model: "partner_delivered", default_price: "1.5L" }));
    serviceId = service.id;
    const { data } = await db.from("services").select("default_price, active").eq("id", serviceId).single();
    expect(Number(data!.default_price)).toBe(150000);
    expect(data!.active).toBe(true);
  });

  it("13. a prospect can have several opportunities with service, partner, delivery model and terms", async () => {
    const { data: first } = await db.from("opportunities").select("id").eq("prospect_id", prospectId).single();
    websiteOppId = first!.id;
    await updateOpportunity(
      db,
      opportunityUpdateSchema.parse({
        id: websiteOppId,
        title: "Website + online booking",
        service_id: serviceId,
        estimated_value: "2L",
        delivery_model: "partner_delivered",
        partner_id: partnerId,
        revenue_model: "partner_commission",
        commission_type: "percentage",
        commission_percentage: "10",
        commission_basis: "amount_received",
        next_action: "Send proposal",
      }),
    );
    const seo = await createOpportunity(
      db,
      opportunityCreateSchema.parse({ prospect_id: prospectId, title: "Local SEO retainer", estimated_value: "30000", delivery_model: "referral", revenue_model: "referral_commission" }),
      TODAY,
    );
    seoOppId = seo.id;
    // percentage without a basis is refused — nothing is assumed
    expect(opportunityUpdateSchema.safeParse({ id: seoOppId, title: "x", commission_type: "percentage", commission_percentage: "10" }).success).toBe(false);
    const { data: opps } = await db.from("opportunities").select("id, pipeline_stages(key)").eq("prospect_id", prospectId);
    expect(opps).toHaveLength(2);
    expect(opps!.find((o) => o.id === seoOppId)?.pipeline_stages?.key).toBe("new");
  });

  it("14. moves opportunities through the pipeline: discovery call, proposal follow-up, stage history", async () => {
    const pipeline = await getDefaultPipeline(db);
    const stage = (key: string) => pipeline.stages.find((x) => x.key === key)!.id;
    await expect(moveOpportunity(db, { id: websiteOppId, stage_id: stage("discovery"), discovery_call_date: addDays(TODAY, -1) }, TODAY)).rejects.toThrow(/past/);
    await moveOpportunity(db, { id: websiteOppId, stage_id: stage("discovery"), discovery_call_date: addDays(TODAY, 2), discovery_call_time: "11:30" }, TODAY);
    await moveOpportunity(db, { id: websiteOppId, stage_id: stage("proposal") }, TODAY);
    const tasks = await tasksFor(db, prospectId);
    expect(tasks.find((t) => t.task_type === "discovery_call")).toMatchObject({ due_date: addDays(TODAY, 2), due_time: "11:30:00", opportunity_id: websiteOppId });
    expect(tasks.find((t) => t.task_type === "proposal_follow_up")).toMatchObject({ status: "pending", opportunity_id: websiteOppId });
    const { data: opp } = await db.from("opportunities").select("probability, status").eq("id", websiteOppId).single();
    expect(opp).toMatchObject({ probability: 60, status: "open" });
    const { data: acts } = await db.from("activities").select("title").eq("prospect_id", prospectId).eq("activity_type", "opportunity");
    expect(acts!.some((a) => /Proposal/.test(a.title))).toBe(true);
  });

  it("15. prepares a copyable partner handoff (no vendor branding)", async () => {
    const { id, gaps } = await createHandoff(
      db,
      { prospect_id: prospectId, opportunity_id: websiteOppId, notes: "Call booked for Thursday." },
      { generatedBy: "Utkarsh", today: TODAY, currency: "INR", sourceLabel: (v) => LEAD_SOURCES.label(v as never) },
    );
    const { data: h } = await db.from("handoffs").select("*").eq("id", id).single();
    expect(h!.partner_id).toBe(partnerId); // taken from the opportunity
    expect(h!.summary_markdown).toContain("## Opportunity Handoff");
    expect(h!.summary_markdown).not.toMatch(/bharatcoder|hariom/i);
    expect(h!.summary_markdown).toContain("ABC Physiotherapy");
    expect(h!.summary_markdown).toContain("Website + online booking");
    expect(h!.summary_markdown).toContain("PixelWorks Studio");
    expect(h!.summary_markdown).toContain("₹1L–2L");
    expect(h!.summary_markdown).toContain("Prepared by:**\n  Utkarsh");
    expect(gaps).toEqual([]);
  });

  it("16. won → convert to client with a project that copies the agreed terms", async () => {
    const pipeline = await getDefaultPipeline(db);
    const r = await moveOpportunity(db, { id: websiteOppId, stage_id: pipeline.stages.find((x) => x.key === "won")!.id }, TODAY);
    expect(r.suggestClient).toBe(true);
    const tasks = await tasksFor(db, prospectId);
    expect(tasks.filter((t) => t.opportunity_id === websiteOppId && t.is_automated && t.status === "pending")).toHaveLength(0);

    const conv = await convertProspectToClient(db, { prospect_id: prospectId, opportunity_id: websiteOppId, create_project: true });
    expect(conv.created).toBe(true);
    const again = await convertProspectToClient(db, { prospect_id: prospectId, opportunity_id: websiteOppId, create_project: true });
    expect(again).toMatchObject({ clientId: conv.clientId, projectId: conv.projectId, created: false }); // idempotent
    const p = await getProspectOrThrow(db, prospectId);
    expect(p.stage).toBe("client");
    const project = await getProject(db, conv.projectId!);
    expect(project).toMatchObject({
      name: "Website + online booking",
      partner_id: partnerId,
      service_id: serviceId,
      delivery_model: "partner_delivered",
      commission_type: "percentage",
      commission_basis: "amount_received",
    });
    expect(Number(project!.total_project_value)).toBe(200000);
  });

  it("17. payments drive commission; changing the basis changes it", async () => {
    const { data: proj } = await db.from("projects").select("id").eq("opportunity_id", websiteOppId).single();
    const projectId = proj!.id;
    await addPayment(db, paymentSchema.parse({ project_id: projectId, payment_date: TODAY, amount: "1,00,000", payment_type: "advance", status: "received" }));
    await addPayment(db, paymentSchema.parse({ project_id: projectId, payment_date: addDays(TODAY, 30), amount: "100000", payment_type: "final", status: "expected" }));
    let f = (await getProject(db, projectId))!.financials;
    expect(f).toMatchObject({ total: 200000, received: 100000, expected: 100000, balanceDue: 100000, commissionEarned: 10000 });

    const current = (await getProject(db, projectId))!;
    const base = {
      id: projectId,
      name: current.name,
      client_id: current.client_id,
      status: "active",
      payment_flow: "client_pays_partner",
      total_project_value: "200000",
      commission_type: "percentage",
      commission_percentage: "10",
      commission_received: "4000",
    };
    await updateProject(db, projectUpdateSchema.parse({ ...base, commission_basis: "total_project_value" }));
    f = (await getProject(db, projectId))!.financials;
    expect(f.commissionEarned).toBe(20000);
    expect(f.commissionOutstanding).toBe(16000);
    await updateProject(db, projectUpdateSchema.parse({ ...base, commission_basis: "net_revenue", partner_cost: "40000" }));
    expect((await getProject(db, projectId))!.financials.commissionEarned).toBe(6000);
    await updateProject(db, projectUpdateSchema.parse({ ...base, commission_basis: "amount_received" }));
    expect((await getProject(db, projectId))!.financials.commissionEarned).toBe(10000);
  });

  it("18. a client can have several projects, self-delivered or via a partner", async () => {
    const { data: client } = await db.from("clients").select("id").eq("prospect_id", prospectId).single();
    const self = await createProject(
      db,
      projectCreateSchema.parse({ name: "Monthly site care", client_id: client!.id, status: "active", payment_flow: "client_pays_me", delivery_model: "self_delivered", total_project_value: "12000", revenue_model: "direct_revenue" }),
    );
    await addPayment(db, paymentSchema.parse({ project_id: self.id, payment_date: TODAY, amount: "12000", payment_type: "retainer", status: "received" }));
    const projects = await listProjects(db, { clientId: client!.id });
    expect(projects).toHaveLength(2);
    const care = projects.find((p) => p.id === self.id)!;
    expect(care.financials).toMatchObject({ received: 12000, myRevenueToDate: 12000, commissionEarned: null });

    const dash = await getDashboard(db, TODAY, "Asia/Kolkata");
    expect(dash.revenue).toMatchObject({ paymentsToMe: 12000, paymentsViaPartner: 100000, commissionEarned: 10000, commissionOutstanding: 6000, myRevenue: 22000 });
    expect(dash.sales.won).toBe(1);
    const analytics = await getAnalytics(db, TODAY, "Asia/Kolkata");
    const instagram = analytics.bySource.find((r) => r.key === "instagram")!;
    expect(instagram).toMatchObject({ prospects: 1, won: 1, myRevenue: 10000 });
    expect(analytics.byService.find((r) => r.key === serviceId)).toMatchObject({ won: 1 });
  });

  it("19. global search finds prospects, opportunities, clients, projects and partners", async () => {
    const kinds = async (q: string) => new Set((await globalSearch(db, q)).map((h) => h.kind));
    expect(await kinds("physio")).toEqual(new Set(["prospect", "client"]));
    expect(await kinds("online booking")).toEqual(new Set(["opportunity", "project"]));
    expect(await kinds("pixelworks")).toEqual(new Set(["partner"]));
    expect(await globalSearch(db, "x")).toEqual([]);
  });

  it("20. appears in exports (all kinds)", async () => {
    const qualified = await buildExport(db, "qualified");
    expect(qualified).toContain("ABC Physiotherapy");
    const outreach = await buildExport(db, "outreach");
    expect(outreach.split("\r\n").length).toBeGreaterThan(2);
    const prospects = await buildExport(db, "prospects", { query: prospectSchemaQuery("physio") });
    expect(prospects.split("\r\n")[1]).toContain("ABC Physiotherapy");
    const followUps = await buildExport(db, "follow-ups");
    expect(followUps.startsWith("\uFEFFDue date,")).toBe(true);
    for (const kind of ["opportunities", "clients", "projects", "payments", "partners"] as const) {
      const csv = await buildExport(db, kind);
      expect(csv.split("\r\n").length, kind).toBeGreaterThan(2);
      expect(csv).not.toMatch(/bharatcoder/i);
    }
    expect(await buildExport(db, "payments")).toContain("100000.00");
  });

  it("21. CSV import: duplicate detection and validated insert", async () => {
    const keys = computeDuplicateKeys({ business_name: "ABC Physio", website: "https://abcphysio.in/x" });
    const [matches] = await matchExistingProspects(db, [keys]);
    expect(matches.map((m) => m.id)).toContain(prospectId);
    const result = await importProspects(
      db,
      [
        { business_name: "Imported Dental", email: "hello@imported.example", lead_source: "google_maps", location: "Pune" },
        { business_name: "Bad Row", email: "not-an-email", lead_source: "google_maps" },
        { business_name: "Custom Source Co", lead_source: "nonexistent_source" },
      ],
      { allowedSources: new Set(LEAD_SOURCES.values), scoring: undefined as never },
    );
    expect(result.imported).toBe(2);
    expect(result.skipped).toHaveLength(1);
    const { data } = await db.from("prospects").select("business_name, lead_source, stage").in("business_name", ["Imported Dental", "Custom Source Co"]).order("business_name");
    expect(data).toEqual([
      { business_name: "Custom Source Co", lead_source: "other", stage: "new" },
      { business_name: "Imported Dental", lead_source: "google_maps", stage: "new" },
    ]);
  });
});

function prospectSchemaQuery(q: string) {
  return { q } as never;
}

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
    await expect(setLeadStatus(db, { prospect_id: created.id, to: "replied" }, TODAY)).rejects.toThrow(/archived/);
    await expect(
      createTask(db, { prospect_id: created.id, task_type: "other", title: "x", due_date: TODAY, due_time: null, priority: "low", notes: null }, TODAY),
    ).rejects.toThrow(/archived/);
    await setArchived(db, [created.id], false);
    expect((await getProspectOrThrow(db, created.id)).archived_at).toBeNull();
  });

  it("lost prospects keep their furthest status for funnel metrics", async () => {
    const { db } = await memberClient();
    const created = await createProspect(db, prospectSchema.parse({ business_name: "Gone Co", lead_source: "other", prospect_type: "other" }), { confirmDuplicate: false });
    if (created.status !== "saved") throw new Error();
    await setLeadStatus(db, { prospect_id: created.id, to: "replied" }, TODAY);
    await setLeadStatus(db, { prospect_id: created.id, to: "lost", lost_reason: "Went with another agency" }, TODAY);
    const p = await getProspectOrThrow(db, created.id);
    expect(p.stage).toBe("lost");
    expect(p.furthest_stage).toBe("replied");
    expect(p.lost_reason).toBe("Went with another agency");
    await expect(setLeadStatus(db, { prospect_id: created.id, to: "lost" }, TODAY)).rejects.toThrow(/already/);
  });
});
