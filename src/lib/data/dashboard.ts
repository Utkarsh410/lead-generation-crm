import { acquisitionRates, funnelCounts, weeklyCounts } from "@/lib/domain/metrics";
import { addDays, dateInTimezone } from "@/lib/domain/dates";
import { sumMoney } from "@/lib/domain/money";
import { fromMinor, projectFinancials, toMinor, weightedValue, type PaymentLike } from "@/lib/domain/commercials";
import { must } from "./errors";
import { listOpenTasks } from "./tasks";
import { getDefaultPipeline } from "./workspace";
import type { Db } from "./types";

async function activeProspects(db: Db) {
  return must(
    await db
      .from("prospects")
      .select("id, business_name, contact_name, stage, furthest_stage, estimated_value, opportunity_score, lead_temperature, created_at, last_contacted_at, next_follow_up_date, observed_problem, prospect_type, lead_source")
      .is("archived_at", null)
      .limit(5000),
  );
}

async function allOpportunities(db: Db) {
  const rows = must(
    await db
      .from("opportunities")
      .select("id, title, prospect_id, stage_id, status, estimated_value, probability, service_id, partner_id, delivery_model, revenue_model, created_at, closed_at, prospects(archived_at, business_name, lead_source), pipeline_stages(key, kind, label)")
      .limit(5000),
  );
  return rows.filter((o) => !o.prospects?.archived_at);
}

async function allProjects(db: Db) {
  return must(
    await db
      .from("projects")
      .select("id, name, opportunity_id, service_id, partner_id, status, total_project_value, payment_flow, partner_cost, commission_type, commission_percentage, fixed_commission, commission_basis, commission_custom_base, commission_received, revenue_model, delivery_model, payments(amount, status, payment_date)")
      .limit(5000),
  );
}

/** Revenue & commission totals across projects (all integer-safe via domain helpers). */
export function revenueTotals(projects: Awaited<ReturnType<typeof allProjects>>) {
  // accumulate in integer minor units — never add floats
  const t = { paymentsToMe: 0n, paymentsViaPartner: 0n, commissionEarned: 0n, commissionOutstanding: 0n, partnerCosts: 0n, myRevenue: 0n, projectValue: 0n };
  for (const p of projects) {
    if (p.status === "cancelled") continue;
    const f = projectFinancials(p, (p.payments ?? []) as PaymentLike[]);
    if (p.payment_flow === "client_pays_me") {
      t.paymentsToMe += toMinor(f.received);
      t.partnerCosts += toMinor(f.partnerCost);
    } else {
      t.paymentsViaPartner += toMinor(f.received);
    }
    t.commissionEarned += toMinor(f.commissionEarned);
    t.commissionOutstanding += toMinor(f.commissionOutstanding);
    t.myRevenue += toMinor(f.myRevenueToDate);
    t.projectValue += toMinor(f.total);
  }
  return {
    paymentsToMe: fromMinor(t.paymentsToMe),
    paymentsViaPartner: fromMinor(t.paymentsViaPartner),
    commissionEarned: fromMinor(t.commissionEarned),
    commissionOutstanding: fromMinor(t.commissionOutstanding),
    partnerCosts: fromMinor(t.partnerCosts),
    myRevenue: fromMinor(t.myRevenue),
    projectValue: fromMinor(t.projectValue),
  };
}

export async function getDashboard(db: Db, today: string, timezone: string) {
  const [prospects, tasks, opportunities, projects, pipeline] = await Promise.all([
    activeProspects(db),
    listOpenTasks(db, { dueOnOrBefore: addDays(today, 7) }),
    allOpportunities(db),
    allProjects(db),
    getDefaultPipeline(db),
  ]);

  const counts = funnelCounts(prospects.map((p) => ({ stage: p.stage, reachedStage: p.furthest_stage })));
  const open = opportunities.filter((o) => o.pipeline_stages?.kind === "open");
  const won = opportunities.filter((o) => o.status === "won");
  const lost = opportunities.filter((o) => o.status === "lost");
  const proposals = open.filter((o) => o.pipeline_stages?.key === "proposal");

  const pipelineBars = pipeline.stages.map((s) => {
    const inStage = opportunities.filter((o) => o.stage_id === s.id);
    return { stage: s.id, label: s.label, kind: s.kind, count: inStage.length, value: sumMoney(inStage.map((o) => o.estimated_value)) };
  });

  const weekAgo = addDays(today, -6);
  return {
    leads: {
      total: counts.total,
      newProspects: prospects.filter((p) => p.stage === "new").length,
      addedThisWeek: prospects.filter((p) => dateInTimezone(p.created_at, timezone) >= weekAgo).length,
      contacted: counts.contacted,
      replies: counts.replied,
      qualified: counts.qualified,
      opportunities: opportunities.length,
    },
    rates: acquisitionRates(counts),
    sales: {
      open: open.length,
      pipelineValue: sumMoney(open.map((o) => o.estimated_value)),
      weightedValue: weightedValue(open),
      proposals: proposals.length,
      won: won.length,
      wonValue: sumMoney(won.map((o) => o.estimated_value)),
      lost: lost.length,
    },
    revenue: revenueTotals(projects),
    pipeline: pipelineBars,
    overdue: tasks.filter((t) => t.due_date < today),
    dueToday: tasks.filter((t) => t.due_date === today),
    discoveryCalls: tasks.filter((t) => t.task_type === "discovery_call"),
    proposals: proposals.map((o) => ({
      ...o,
      followUp: tasks.find((t) => t.opportunity_id === o.id && t.task_type === "proposal_follow_up") ?? null,
    })),
    needsOutreach: prospects.filter((p) => p.stage === "new" && !p.last_contacted_at).sort((a, b) => b.opportunity_score - a.opportunity_score),
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

const RESPONDED: string[] = ["replied", "interested", "not_now", "not_interested", "wrong_contact"];

export async function getAnalytics(db: Db, today: string, timezone: string, weeks = 8) {
  const since = `${addDays(today, -7 * weeks - 7)}T00:00:00Z`;
  const [prospects, messages, statusChanges, tasksDone, opportunities, projects, services] = await Promise.all([
    activeProspects(db),
    db.from("outreach_messages").select("outreach_stage, sent_at, response_status, response_date").gte("sent_at", since).then((r) => must(r)),
    db.from("activities").select("occurred_at, metadata").eq("activity_type", "stage_change").gte("occurred_at", since).then((r) => must(r)),
    db.from("tasks").select("completed_at").eq("status", "completed").gte("completed_at", since).then((r) => must(r)),
    allOpportunities(db),
    allProjects(db),
    db.from("services").select("id, name").then((r) => must(r)),
  ]);

  const day = (ts: string) => dateInTimezone(ts, timezone);
  const series = [
    { key: "added", label: "Prospects added", data: weeklyCounts(prospects.map((p) => day(p.created_at)), today, weeks) },
    { key: "contacted", label: "Prospects contacted (first message)", data: weeklyCounts(messages.filter((m) => m.outreach_stage === "first_contact").map((m) => day(m.sent_at)), today, weeks) },
    { key: "responses", label: "Responses", data: weeklyCounts(messages.filter((m) => m.response_date && RESPONDED.includes(m.response_status)).map((m) => day(m.response_date!)), today, weeks) },
    { key: "qualified", label: "Leads qualified", data: weeklyCounts(statusChanges.filter((a) => (a.metadata as { to?: string } | null)?.to === "qualified").map((a) => day(a.occurred_at)), today, weeks) },
    { key: "opportunities", label: "Opportunities created", data: weeklyCounts(opportunities.map((o) => day(o.created_at)), today, weeks) },
    { key: "won", label: "Opportunities won", data: weeklyCounts(opportunities.filter((o) => o.status === "won" && o.closed_at).map((o) => day(o.closed_at!)), today, weeks) },
    { key: "followups", label: "Follow-ups completed", data: weeklyCounts(tasksDone.map((t) => day(t.completed_at!)), today, weeks) },
  ];

  const counts = funnelCounts(prospects.map((p) => ({ stage: p.stage, reachedStage: p.furthest_stage })));
  const prospectById = new Map(prospects.map((p) => [p.id, p]));

  // ---- by source ---------------------------------------------------------
  const sourceKeys = [...new Set(prospects.map((p) => p.lead_source))];
  const bySource = sourceKeys
    .map((source) => {
      const ps = prospects.filter((p) => p.lead_source === source);
      const c = funnelCounts(ps.map((p) => ({ stage: p.stage, reachedStage: p.furthest_stage })));
      const ids = new Set(ps.map((p) => p.id));
      const opps = opportunities.filter((o) => ids.has(o.prospect_id));
      const won = opps.filter((o) => o.status === "won");
      const oppIds = new Set(opps.map((o) => o.id));
      return {
        key: source,
        prospects: c.total,
        contacted: c.contacted,
        replied: c.replied,
        qualified: c.qualified,
        opportunities: opps.length,
        won: won.length,
        wonValue: sumMoney(won.map((o) => o.estimated_value)),
        myRevenue: revenueTotals(projects.filter((p) => p.opportunity_id && oppIds.has(p.opportunity_id))).myRevenue,
        responseRate: acquisitionRates(c).responseRate,
      };
    })
    .sort((a, b) => b.prospects - a.prospects);

  // ---- by service ---------------------------------------------------------
  const byService = services
    .map((s) => {
      const opps = opportunities.filter((o) => o.service_id === s.id);
      const prospectIds = new Set(opps.map((o) => o.prospect_id));
      const qualified = [...prospectIds].filter((id) => {
        const p = prospectById.get(id);
        return p && ["qualified", "client"].includes(p.furthest_stage);
      }).length;
      const won = opps.filter((o) => o.status === "won");
      const serviceProjects = projects.filter((p) => p.service_id === s.id);
      return {
        key: s.id,
        name: s.name,
        prospects: prospectIds.size,
        qualified,
        opportunities: opps.length,
        won: won.length,
        wonValue: sumMoney(won.map((o) => o.estimated_value)),
        myRevenue: revenueTotals(serviceProjects).myRevenue,
      };
    })
    .filter((s) => s.opportunities > 0 || s.prospects > 0)
    .sort((a, b) => b.opportunities - a.opportunities);

  return { series, counts, rates: acquisitionRates(counts), bySource, byService, revenue: revenueTotals(projects) };
}
