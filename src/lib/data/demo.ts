// Generic demo data. Every demo row is flagged is_demo (prospects, clients,
// partners, services); everything else hangs off those and cascades, so
// "Remove demo data" in Settings deletes it all without touching real records.
// Dates are relative to "today" so the dashboard always has something to show.

import { computeDuplicateKeys } from "@/lib/domain/duplicates";
import { calculateOpportunityScore, type ScoreFactors, type ScoringConfig } from "@/lib/domain/opportunity-score";
import { assessQualification } from "@/lib/domain/qualification";
import { addDays } from "@/lib/domain/dates";
import { generateHandoff } from "@/lib/domain/handoff";
import {
  OUTREACH_CHANNELS,
  OUTREACH_STAGES,
  RESPONSE_STATUSES,
  type CommissionBasis,
  type CommissionType,
  type DeliveryModel,
  type LeadStatus,
  type OutreachChannel,
  type OutreachStage,
  type PaymentFlow,
  type ProjectStatus,
  type ResponseStatus,
  type RevenueModel,
  type StageKey,
  type TaskPriority,
  type TaskType,
} from "@/lib/domain/constants";
import { AppError, check, must } from "./errors";
import { getDefaultPipeline } from "./workspace";
import type { Db, Json, TablesInsert } from "./types";

type DemoMessage = {
  stage: OutreachStage;
  channel: OutreachChannel;
  daysAgo: number;
  body: string;
  response?: ResponseStatus;
  responseDaysAgo?: number;
  responseNotes?: string;
};

type DemoTask = { type: TaskType; title: string; dueInDays: number; priority: TaskPriority; automated?: boolean; step?: "follow_up_1" | "follow_up_2"; time?: string; opportunity?: number };

type Terms = {
  revenue_model?: RevenueModel;
  commission_type?: CommissionType;
  commission_percentage?: string;
  fixed_commission?: string;
  commission_basis?: CommissionBasis;
  commission_notes?: string;
};

type DemoOpportunity = Terms & {
  title: string;
  stage: StageKey;
  service: string; // demo service name
  value: string;
  delivery: DeliveryModel;
  partner?: string; // demo partner name
  closeInDays?: number;
  nextAction?: string;
  description?: string;
  project?: {
    status: ProjectStatus;
    flow: PaymentFlow;
    partnerCost?: string;
    commissionReceived?: string;
    payments: Array<{ daysAgo: number; amount: string; type: "advance" | "milestone" | "final" | "retainer"; status: "received" | "expected" }>;
  };
};

type DemoProspect = {
  prospect: Omit<TablesInsert<"prospects">, "owner_id" | "score_factors" | "stage"> & { stage: LeadStatus; score_factors: ScoreFactors };
  addedDaysAgo: number;
  messages?: DemoMessage[];
  tasks?: DemoTask[];
  qualification?: { need: number; budget: number; timeline: number; dm: number; urgency: number; fit: number; feasibility: number; problem: string; budgetMin?: string; budgetMax?: string; timeline_notes?: string; decisionMaker?: string };
  opportunities?: DemoOpportunity[];
  handoff?: { opportunity: number };
};

const PARTNERS = [
  { name: "Northwind Dev Studio", contact_name: "Ravi Menon", email: "ravi@northwind.example", partner_type: "development_agency" as const, status: "active" as const, location: "Bengaluru", services: ["Web apps", "Mobile apps", "APIs"], notes: "Reliable for custom builds; 2-week lead time." },
  { name: "PixelPerfect Design", contact_name: "Sara Thomas", email: "sara@pixelperfect.example", partner_type: "designer" as const, status: "active" as const, location: "Kochi", services: ["Branding", "UI design"], notes: "White-label design support." },
  { name: "GrowthStack SEO", contact_name: "Aman Gill", email: "aman@growthstack.example", partner_type: "seo_agency" as const, status: "interested" as const, location: "Chandigarh", services: ["SEO", "Content"], notes: "Pays 10% referral on amount received." },
];

const SERVICES = [
  { name: "Business website", category: "web_development", pricing_model: "fixed_price" as const, default_price: "80000", delivery_model: "self_delivered" as const, description: "Mobile-friendly website with enquiry forms." },
  { name: "Custom web app / CRM", category: "software_development", pricing_model: "per_project" as const, delivery_model: "partner_delivered" as const, description: "Workflow software, dashboards and CRMs." },
  { name: "AI automation", category: "ai", pricing_model: "custom" as const, delivery_model: "joint_delivery" as const, description: "AI assistants and automated workflows." },
  { name: "SEO retainer", category: "seo", pricing_model: "retainer" as const, delivery_model: "referral" as const, description: "Ongoing SEO — referred to a partner." },
];

const first = (name: string, company: string, observation: string, me: string) =>
  `Hi ${name},\n\nI came across ${company} and noticed ${observation}.\n\nI help businesses like yours turn that into more enquiries and less manual work. Would you be open to a quick conversation?\n\nBest,\n${me}`;

function demoProspects(me: string): DemoProspect[] {
  return [
    {
      addedDaysAgo: 2,
      prospect: {
        business_name: "Brightline Marketing", contact_name: "Neha Iyer", job_title: "Managing Partner", email: "neha@brightline.example", website: "https://brightline.example",
        location: "Mumbai", country: "India", industry: "Marketing agency", company_size: "11-50", lead_source: "linkedin", prospect_type: "agency", stage: "contacted",
        observed_problem: "Case studies mention client dashboards but the team has no developers.", suggested_solution: "White-label dashboards delivered with a partner",
        potential_project: "dashboard", estimated_value: "150000",
        score_factors: { clear_problem: 2, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 2, urgency: 1, project_value: 2 },
      },
      messages: [{ stage: "first_contact", channel: "email", daysAgo: 3, body: first("Neha", "Brightline Marketing", "your client reporting case studies", me) }],
      tasks: [{ type: "follow_up", title: "Follow-up #1 — Brightline Marketing", dueInDays: 0, priority: "medium", automated: true, step: "follow_up_1" }],
      opportunities: [{ title: "White-label client dashboards", stage: "contacted", service: "Custom web app / CRM", value: "150000", delivery: "white_label", partner: "Northwind Dev Studio", closeInDays: 30 }],
    },
    {
      addedDaysAgo: 9,
      prospect: {
        business_name: "RankUp SEO Co.", contact_name: "Vikram Shah", job_title: "Founder", email: "vikram@rankup.example", website: "https://rankup.example",
        location: "Jaipur", country: "India", industry: "SEO agency", company_size: "2-10", lead_source: "cold_email", prospect_type: "agency", stage: "contacted",
        observed_problem: "Audits keep flagging slow sites they can't rebuild themselves.", suggested_solution: "Site rebuilds for their SEO clients",
        potential_project: "website", estimated_value: "60000",
        score_factors: { clear_problem: 3, dev_requirement: 2, business_active: 2, decision_maker: 3, contact_info: 3, tech_gap: 2, urgency: 1, project_value: 1 },
      },
      messages: [{ stage: "first_contact", channel: "email", daysAgo: 5, body: first("Vikram", "RankUp SEO Co.", "your site-speed audits", me) }],
      tasks: [{ type: "follow_up", title: "Follow-up #1 — RankUp SEO Co.", dueInDays: -2, priority: "medium", automated: true, step: "follow_up_1" }],
    },
    {
      addedDaysAgo: 30,
      prospect: {
        business_name: "CarePlus Physiotherapy", contact_name: "Dr. Meera Joshi", job_title: "Owner", phone: "+91 98220 11223", whatsapp: "+91 98220 11223", website: "https://careplus.example",
        location: "Pune", country: "India", industry: "Healthcare", company_size: "2-10", lead_source: "instagram", prospect_type: "direct_business", stage: "client",
        website_quality: "poor", has_online_booking: false, has_whatsapp: true,
        observed_problem: "No online appointment booking; patients ask for timings in comments.", suggested_solution: "Website with booking and WhatsApp reminders",
        potential_project: "website", estimated_value: "120000",
        score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 2, project_value: 2 },
      },
      messages: [{ stage: "first_contact", channel: "instagram", daysAgo: 26, body: "Hi Dr. Meera! Loved your posture reels. Patients keep asking for timings — want a quick idea for online booking?", response: "interested", responseDaysAgo: 25 }],
      qualification: { need: 5, budget: 4, timeline: 4, dm: 5, urgency: 4, fit: 5, feasibility: 5, problem: "Appointments by phone only; missed bookings.", budgetMin: "100000", budgetMax: "150000", timeline_notes: "6 weeks", decisionMaker: "Dr. Meera Joshi (Owner)" },
      opportunities: [
        {
          title: "Website + booking system", stage: "won", service: "Business website", value: "120000", delivery: "self_delivered",
          revenue_model: "direct_revenue", commission_type: "none",
          project: { status: "active", flow: "client_pays_me", payments: [{ daysAgo: 12, amount: "60000", type: "advance", status: "received" }, { daysAgo: -20, amount: "60000", type: "final", status: "expected" }] },
        },
        { title: "Patient follow-up automation", stage: "discovery", service: "AI automation", value: "45000", delivery: "joint_delivery", partner: "Northwind Dev Studio", closeInDays: 21, nextAction: "Share automation examples" },
      ],
    },
    {
      addedDaysAgo: 28,
      prospect: {
        business_name: "Smile Studio Dental", contact_name: "Dr. Priya Deshpande", job_title: "Founder", email: "hello@smilestudio.example", phone: "+91 97650 88990", website: "https://smilestudio.example",
        location: "Nagpur", country: "India", industry: "Healthcare", company_size: "11-50", lead_source: "google_maps", prospect_type: "direct_business", stage: "qualified",
        observed_problem: "Three branches, appointments on paper registers.", suggested_solution: "Appointment management system with reminders",
        potential_project: "web_application", estimated_value: "220000",
        score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 2, project_value: 2 },
      },
      messages: [{ stage: "first_contact", channel: "email", daysAgo: 24, body: first("Priya", "Smile Studio Dental", "your three branches", me), response: "interested", responseDaysAgo: 22 }],
      qualification: { need: 5, budget: 4, timeline: 4, dm: 5, urgency: 3, fit: 4, feasibility: 4, problem: "Double-booking across branches.", budgetMin: "180000", budgetMax: "250000", timeline_notes: "8 weeks", decisionMaker: "Dr. Priya Deshpande" },
      opportunities: [
        {
          title: "Multi-branch appointment system", stage: "proposal", service: "Custom web app / CRM", value: "220000", delivery: "partner_delivered", partner: "Northwind Dev Studio", closeInDays: 10,
          revenue_model: "direct_revenue", commission_type: "none", nextAction: "Follow up on proposal",
        },
      ],
      tasks: [{ type: "proposal_follow_up", title: "Follow up on proposal — Smile Studio Dental", dueInDays: -1, priority: "high", automated: true, opportunity: 0 }],
      handoff: { opportunity: 0 },
    },
    {
      addedDaysAgo: 14,
      prospect: {
        business_name: "Apex Coaching Academy", contact_name: "Ramesh Gupta", job_title: "Director", email: "director@apex.example", phone: "+91 94140 55667",
        location: "Kota", country: "India", industry: "Education / coaching", company_size: "51-200", lead_source: "referral", prospect_type: "direct_business", stage: "replied",
        observed_problem: "Course material and test results shared only on WhatsApp.", suggested_solution: "LMS with student portal",
        potential_project: "lms", estimated_value: "400000",
        score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 2, project_value: 3 },
      },
      messages: [{ stage: "first_contact", channel: "email", daysAgo: 6, body: first("Ramesh", "Apex Coaching Academy", "your results page", me), response: "replied", responseDaysAgo: 1, responseNotes: "Asked for examples and a rough cost." }],
      tasks: [{ type: "qualification", title: "Reply to Apex Coaching Academy and qualify", dueInDays: 0, priority: "high", automated: true }],
    },
    {
      addedDaysAgo: 40,
      prospect: {
        business_name: "Kora Handloom", contact_name: "Anjali Rathore", job_title: "Owner", email: "anjali@kora.example", instagram_url: "https://instagram.com/kora.example",
        location: "Jaipur", country: "India", industry: "E-commerce", company_size: "2-10", lead_source: "instagram", prospect_type: "direct_business", stage: "client",
        observed_problem: "Orders over Instagram DMs; payments via UPI screenshots.", suggested_solution: "Online store with payments and order dashboard",
        potential_project: "ecommerce", estimated_value: "140000",
        score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 2, tech_gap: 3, urgency: 2, project_value: 2 },
      },
      messages: [{ stage: "first_contact", channel: "instagram", daysAgo: 38, body: "Hi Anjali! Your block-print sarees are beautiful. Orders over DMs must be hard to track — happy to share an idea.", response: "interested", responseDaysAgo: 37 }],
      opportunities: [
        {
          title: "E-commerce store", stage: "won", service: "Custom web app / CRM", value: "200000", delivery: "partner_delivered", partner: "Northwind Dev Studio",
          revenue_model: "direct_revenue", commission_type: "none",
          project: { status: "active", flow: "client_pays_me", partnerCost: "120000", payments: [{ daysAgo: 20, amount: "100000", type: "advance", status: "received" }, { daysAgo: -15, amount: "100000", type: "final", status: "expected" }] },
        },
      ],
    },
    {
      addedDaysAgo: 18,
      prospect: {
        business_name: "FleetMint", contact_name: "Arjun Rao", job_title: "Co-founder & CEO", email: "arjun@fleetmint.example", website: "https://fleetmint.example",
        location: "Bengaluru", country: "India", industry: "SaaS", company_size: "2-10", lead_source: "linkedin", prospect_type: "startup", stage: "qualified",
        observed_problem: "Running fleet ops on spreadsheets while hiring a CTO.", suggested_solution: "SaaS MVP with admin dashboard",
        potential_project: "saas", estimated_value: "600000",
        score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 2, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 3, project_value: 3 },
      },
      messages: [{ stage: "first_contact", channel: "linkedin", daysAgo: 15, body: "Hi Arjun, saw FleetMint is hiring a founding engineer. Happy to share how an MVP could ship while you hire.", response: "interested", responseDaysAgo: 13 }],
      qualification: { need: 4, budget: 3, timeline: 3, dm: 5, urgency: 5, fit: 4, feasibility: 3, problem: "Needs an MVP for 3 pilot customers.", budgetMin: "500000", budgetMax: "800000", timeline_notes: "10–12 weeks", decisionMaker: "Arjun Rao" },
      opportunities: [
        { title: "Fleet tracking MVP", stage: "discovery", service: "Custom web app / CRM", value: "600000", delivery: "partner_delivered", partner: "Northwind Dev Studio", closeInDays: 30, nextAction: "Scoping call with the dev partner" },
        { title: "Ops automation (phase 2)", stage: "nurture", service: "AI automation", value: "150000", delivery: "self_delivered" },
      ],
      tasks: [{ type: "discovery_call", title: "Discovery call — FleetMint", dueInDays: 2, priority: "high", time: "16:00", opportunity: 0 }],
    },
    {
      addedDaysAgo: 21,
      prospect: {
        business_name: "UrbanNest Realty", contact_name: "Kabir Malhotra", job_title: "Director", email: "kabir@urbannest.example", website: "https://urbannest.example",
        location: "Gurugram", country: "India", industry: "Real estate", company_size: "11-50", lead_source: "networking", prospect_type: "direct_business", stage: "client",
        observed_problem: "Listings site ranks poorly; leads come only from portals.", suggested_solution: "SEO retainer via a partner",
        potential_project: "website", estimated_value: "300000",
        score_factors: { clear_problem: 2, dev_requirement: 2, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 2, urgency: 2, project_value: 3 },
      },
      opportunities: [
        {
          title: "SEO retainer (referral)", stage: "won", service: "SEO retainer", value: "300000", delivery: "referral", partner: "GrowthStack SEO",
          revenue_model: "referral_commission", commission_type: "percentage", commission_percentage: "10", commission_basis: "amount_received",
          commission_notes: "10% of what the client pays GrowthStack, paid monthly.",
          project: { status: "active", flow: "client_pays_partner", commissionReceived: "5000", payments: [{ daysAgo: 30, amount: "50000", type: "retainer", status: "received" }, { daysAgo: 0, amount: "50000", type: "retainer", status: "received" }, { daysAgo: -30, amount: "50000", type: "retainer", status: "expected" }] },
        },
      ],
    },
    {
      addedDaysAgo: 1,
      prospect: {
        business_name: "Mehta Advisory", contact_name: "Kunal Mehta", job_title: "Principal Consultant", email: "kunal@mehta-advisory.example", phone: "+91 98200 44556",
        location: "Mumbai", country: "India", industry: "Professional services", company_size: "2-10", lead_source: "referral", prospect_type: "consultant", stage: "new",
        observed_problem: "Clients email documents; staff chase them every quarter.", suggested_solution: "Client portal for document uploads",
        potential_project: "web_application", estimated_value: "250000",
        score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 2, project_value: 3 },
      },
      tasks: [{ type: "first_outreach", title: "First outreach — Mehta Advisory", dueInDays: 0, priority: "high" }],
    },
    {
      addedDaysAgo: 20,
      prospect: {
        business_name: "Sharma Hardware & Tools", contact_name: "Rajesh Sharma", job_title: "Owner", phone: "+91 99100 22334",
        location: "Ludhiana", country: "India", industry: "Retail", company_size: "11-50", lead_source: "google_maps", prospect_type: "direct_business", stage: "lost",
        lost_reason: "Happy with their current billing software.",
        observed_problem: "Stock tracked in a paper register.", suggested_solution: "Inventory dashboard",
        potential_project: "dashboard",
        score_factors: { clear_problem: 2, dev_requirement: 1, business_active: 3, decision_maker: 3, contact_info: 2, tech_gap: 1, urgency: 0, project_value: 1 },
      },
      messages: [{ stage: "first_contact", channel: "whatsapp", daysAgo: 18, body: "Namaste Rajesh ji, I help local shops track stock without registers. Can I show you a quick example?", response: "not_interested", responseDaysAgo: 16, responseNotes: "Happy with current software." }],
      opportunities: [{ title: "Inventory dashboard", stage: "lost", service: "Custom web app / CRM", value: "90000", delivery: "self_delivered" }],
    },
  ];
}

const ts = (today: string, daysAgo: number, time = "05:00:00") => `${addDays(today, -daysAgo)}T${time}Z`;
const FURTHEST: Record<LeadStatus, TablesInsert<"prospects">["furthest_stage"]> = {
  new: "new", contacted: "contacted", replied: "replied", qualified: "qualified", client: "client", nurture: "replied", lost: "contacted",
};

export async function hasDemoData(db: Db): Promise<boolean> {
  const [{ count: p }, { count: c }, { count: pa }, { count: s }] = await Promise.all([
    db.from("prospects").select("id", { count: "exact", head: true }).eq("is_demo", true),
    db.from("clients").select("id", { count: "exact", head: true }).eq("is_demo", true),
    db.from("partners").select("id", { count: "exact", head: true }).eq("is_demo", true),
    db.from("services").select("id", { count: "exact", head: true }).eq("is_demo", true),
  ]);
  return (p ?? 0) + (c ?? 0) + (pa ?? 0) + (s ?? 0) > 0;
}

export async function loadDemoData(db: Db, today: string, opts: { myName: string; scoring?: ScoringConfig; currency?: string }) {
  if (await hasDemoData(db)) throw new AppError("Demo data is already loaded. Remove it first to reload.");
  const pipeline = await getDefaultPipeline(db);
  const stageId = (key: StageKey) => {
    const s = pipeline.stages.find((x) => x.key === key);
    if (!s) throw new AppError(`Your pipeline has no “${key}” stage — restore the default stages first.`);
    return s.id;
  };

  const partners = must(await db.from("partners").insert(PARTNERS.map((p) => ({ ...p, is_demo: true }))).select("id, name"));
  const services = must(await db.from("services").insert(SERVICES.map((s) => ({ ...s, is_demo: true }))).select("id, name"));
  const partnerId = (name?: string) => (name ? (partners.find((p) => p.name === name)?.id ?? null) : null);
  const serviceId = (name: string) => services.find((s) => s.name === name)?.id ?? null;

  const items = demoProspects(opts.myName || "Me");
  for (const item of items) {
    const p = item.prospect;
    const score = calculateOpportunityScore(p.score_factors, opts.scoring);
    const created = must(
      await db
        .from("prospects")
        .insert({
          ...p,
          ...computeDuplicateKeys(p),
          score_factors: p.score_factors as Json,
          opportunity_score: score.score,
          lead_temperature: score.temperature,
          furthest_stage: FURTHEST[p.stage],
          is_demo: true,
          created_at: ts(today, item.addedDaysAgo, "04:30:00"),
          stage_changed_at: ts(today, Math.max(0, item.addedDaysAgo - 2)),
        })
        .select("id")
        .single(),
    );
    const id = created.id;
    const activities: TablesInsert<"activities">[] = [
      { prospect_id: id, activity_type: "prospect_created", title: "Prospect added", occurred_at: ts(today, item.addedDaysAgo, "04:30:00") },
    ];

    for (const m of item.messages ?? []) {
      const msg = must(
        await db
          .from("outreach_messages")
          .insert({
            prospect_id: id,
            channel: m.channel,
            outreach_stage: m.stage,
            subject: m.channel === "email" ? `Quick idea for ${p.business_name}` : null,
            customized_message: m.body,
            sent_at: ts(today, m.daysAgo),
            response_status: m.response ?? (m.daysAgo > 6 ? "no_response" : "sent"),
            response_date: m.response ? ts(today, m.responseDaysAgo ?? m.daysAgo, "09:00:00") : null,
            response_notes: m.responseNotes ?? null,
          })
          .select("id")
          .single(),
      );
      activities.push({
        prospect_id: id,
        activity_type: "outreach_sent",
        title: `${OUTREACH_CHANNELS.label(m.channel)} — ${OUTREACH_STAGES.label(m.stage)} sent`,
        details: m.body.slice(0, 200),
        metadata: { message_id: msg.id },
        occurred_at: ts(today, m.daysAgo),
      });
      if (m.response) {
        activities.push({
          prospect_id: id,
          activity_type: "response_recorded",
          title: `Response: ${RESPONSE_STATUSES.label(m.response)}`,
          details: m.responseNotes ?? null,
          occurred_at: ts(today, m.responseDaysAgo ?? m.daysAgo, "09:00:00"),
        });
      }
    }

    let qualificationId: string | null = null;
    if (item.qualification) {
      const q = item.qualification;
      const ratings = { need_clarity: q.need, budget_fit: q.budget, timeline_fit: q.timeline, decision_maker_access: q.dm, urgency: q.urgency, solution_fit: q.fit, delivery_feasibility: q.feasibility };
      const r = assessQualification(ratings);
      const row = must(
        await db
          .from("qualification_assessments")
          .insert({
            prospect_id: id,
            ...ratings,
            problem_description: q.problem,
            budget_min: q.budgetMin ?? null,
            budget_max: q.budgetMax ?? null,
            timeline_notes: q.timeline_notes ?? null,
            decision_maker_identified: Boolean(q.decisionMaker),
            decision_maker_name: q.decisionMaker ?? null,
            project_type: (p.potential_project as never) ?? null,
            score: r.score,
            suggested_classification: r.suggested,
            classification: r.suggested,
            created_at: ts(today, Math.round(item.addedDaysAgo / 2), "07:00:00"),
          })
          .select("id, score, classification")
          .single(),
      );
      qualificationId = row.id;
      activities.push({ prospect_id: id, activity_type: "qualification", title: `Qualification: ${row.classification} (${row.score}/100)`, occurred_at: ts(today, Math.round(item.addedDaysAgo / 2), "07:00:00") });
    }

    const oppIds: string[] = [];
    let clientId: string | null = null;
    for (const o of item.opportunities ?? []) {
      const opp = must(
        await db
          .from("opportunities")
          .insert({
            prospect_id: id,
            pipeline_id: pipeline.id,
            stage_id: stageId(o.stage),
            title: o.title,
            description: o.description ?? null,
            service_id: serviceId(o.service),
            partner_id: partnerId(o.partner),
            estimated_value: o.value,
            delivery_model: o.delivery,
            expected_close_date: o.closeInDays !== undefined ? addDays(today, o.closeInDays) : null,
            next_action: o.nextAction ?? null,
            revenue_model: o.revenue_model ?? null,
            commission_type: o.commission_type ?? null,
            commission_percentage: o.commission_percentage ?? null,
            fixed_commission: o.fixed_commission ?? null,
            commission_basis: o.commission_basis ?? null,
            commission_notes: o.commission_notes ?? null,
            created_at: ts(today, Math.max(0, item.addedDaysAgo - 3), "06:00:00"),
          })
          .select("id")
          .single(),
      );
      oppIds.push(opp.id);
      activities.push({ prospect_id: id, activity_type: "opportunity", title: `Opportunity created: ${o.title}`, occurred_at: ts(today, Math.max(0, item.addedDaysAgo - 3), "06:00:00") });

      if (o.project) {
        if (!clientId) {
          const client = must(
            await db
              .from("clients")
              .insert({ prospect_id: id, company: p.business_name, primary_contact: p.contact_name ?? null, email: p.email ?? null, phone: p.phone ?? null, website: p.website ?? null, industry: p.industry ?? null, location: p.location ?? null, status: "active", is_demo: true })
              .select("id")
              .single(),
          );
          clientId = client.id;
          activities.push({ prospect_id: id, activity_type: "client", title: "Converted to client", occurred_at: ts(today, Math.max(0, item.addedDaysAgo - 8), "08:00:00") });
        }
        const project = must(
          await db
            .from("projects")
            .insert({
              client_id: clientId,
              opportunity_id: opp.id,
              service_id: serviceId(o.service),
              partner_id: partnerId(o.partner),
              name: o.title,
              delivery_model: o.delivery,
              total_project_value: o.value,
              start_date: addDays(today, -Math.max(0, item.addedDaysAgo - 10)),
              status: o.project.status,
              payment_flow: o.project.flow,
              partner_cost: o.project.partnerCost ?? null,
              revenue_model: o.revenue_model ?? null,
              commission_type: o.commission_type ?? null,
              commission_percentage: o.commission_percentage ?? null,
              fixed_commission: o.fixed_commission ?? null,
              commission_basis: o.commission_basis ?? null,
              commission_received: o.project.commissionReceived ?? "0",
              commission_notes: o.commission_notes ?? null,
            })
            .select("id")
            .single(),
        );
        if (o.project.payments.length) {
          must(
            await db
              .from("payments")
              .insert(o.project.payments.map((pm) => ({ project_id: project.id, payment_date: addDays(today, -pm.daysAgo), amount: pm.amount, payment_type: pm.type, status: pm.status })))
              .select("id"),
          );
        }
      }
    }

    if (item.handoff) {
      const oppId = oppIds[item.handoff.opportunity];
      const o = item.opportunities![item.handoff.opportunity];
      const prospectRow = must(await db.from("prospects").select("*").eq("id", id).single());
      const qual = qualificationId ? must(await db.from("qualification_assessments").select("*").eq("id", qualificationId).single()) : null;
      const partner = PARTNERS.find((x) => x.name === o.partner) ?? null;
      const h = generateHandoff({
        prospect: prospectRow,
        qualification: qual,
        opportunity: { title: o.title, description: o.description ?? null, estimated_value: o.value, delivery_model: o.delivery, service_name: o.service, expected_close_date: null },
        partner: partner ? { name: partner.name, contact_name: partner.contact_name, email: partner.email, phone: null } : null,
        generatedBy: opts.myName || "Me",
        generatedOn: addDays(today, -1),
        currency: opts.currency,
      });
      check(
        await db.from("handoffs").insert({
          prospect_id: id,
          opportunity_id: oppId,
          partner_id: partnerId(o.partner),
          qualification_id: qualificationId,
          summary_markdown: h.markdown,
          snapshot: { ...h.snapshot, _gaps: h.gaps } as unknown as Json,
          status: "sent",
          sent_at: ts(today, 1),
          created_at: ts(today, 1),
        }),
      );
      activities.push({ prospect_id: id, activity_type: "handoff", title: `Handoff sent to ${o.partner}`, occurred_at: ts(today, 1) });
    }

    for (const t of item.tasks ?? []) {
      check(
        await db.from("tasks").insert({
          prospect_id: id,
          opportunity_id: t.opportunity !== undefined ? oppIds[t.opportunity] : null,
          task_type: t.type,
          title: t.title,
          due_date: addDays(today, t.dueInDays),
          due_time: t.time ?? null,
          priority: t.priority,
          is_automated: t.automated ?? false,
          sequence_step: t.step ?? null,
        }),
      );
    }
    check(await db.from("activities").insert(activities, { defaultToNull: false }));
  }

  // a partner follow-up so the partner workflow is visible too
  check(
    await db.from("tasks").insert({
      partner_id: partnerId("GrowthStack SEO"),
      task_type: "partner_follow_up",
      title: "Confirm referral terms with GrowthStack SEO",
      due_date: addDays(today, 3),
      priority: "medium",
    }),
  );
  return { prospects: items.length, partners: partners.length, services: services.length };
}

export async function removeDemoData(db: Db): Promise<number> {
  const prospects = must(await db.from("prospects").delete().eq("is_demo", true).select("id"));
  // clients (and their projects/payments), then partners and services
  check(await db.from("clients").delete().eq("is_demo", true));
  check(await db.from("partners").delete().eq("is_demo", true));
  check(await db.from("services").delete().eq("is_demo", true));
  return prospects.length;
}

/** Exposed for tests: the demo mix must cover the requested examples. */
export const DEMO_PROSPECTS = demoProspects("Me").map((d) => ({
  type: d.prospect.prospect_type,
  industry: d.prospect.industry,
  stage: d.prospect.stage,
  deliveryModels: (d.opportunities ?? []).map((o) => o.delivery),
  opportunities: (d.opportunities ?? []).length,
}));
