import { ACTIVE_OPPORTUNITY_STAGES, PIPELINE_STAGES, type PipelineStage } from "@/lib/domain/constants";
import { acquisitionRates, funnelCounts, weeklyCounts } from "@/lib/domain/metrics";
import { addDays, dateInTimezone } from "@/lib/domain/dates";
import { sumMoney } from "@/lib/domain/money";
import { must } from "./errors";
import { listOpenTasks } from "./tasks";
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

export async function getDashboard(db: Db, today: string) {
  const [prospects, tasks] = await Promise.all([activeProspects(db), listOpenTasks(db, { dueOnOrBefore: addDays(today, 7) })]);

  const counts = funnelCounts(prospects.map((p) => ({ stage: p.stage, reachedStage: p.furthest_stage })));
  const pipeline = PIPELINE_STAGES.list.map((s) => {
    const inStage = prospects.filter((p) => p.stage === s.value);
    return { stage: s.value, label: s.label, count: inStage.length, value: sumMoney(inStage.map((p) => p.estimated_value)) };
  });

  const needsOutreach = prospects
    .filter((p) => p.stage === "prospect" && !p.last_contacted_at)
    .sort((a, b) => b.opportunity_score - a.opportunity_score);

  return {
    metrics: {
      total: counts.total,
      newProspects: prospects.filter((p) => p.stage === "prospect").length,
      addedThisWeek: prospects.filter((p) => dateInTimezone(p.created_at) >= addDays(today, -6)).length,
      contacted: counts.contacted,
      replies: counts.replied,
      qualified: counts.qualified,
      activeOpportunities: prospects.filter((p) => ACTIVE_OPPORTUNITY_STAGES.includes(p.stage)).length,
    },
    rates: acquisitionRates(counts),
    counts,
    pipeline,
    overdue: tasks.filter((t) => t.due_date < today),
    dueToday: tasks.filter((t) => t.due_date === today),
    discoveryCalls: tasks.filter((t) => t.task_type === "discovery_call"),
    proposals: prospects
      .filter((p) => p.stage === "proposal_sent" || p.stage === "negotiation")
      .map((p) => ({ ...p, followUp: tasks.find((t) => t.prospects?.id === p.id && t.task_type === "proposal_follow_up") ?? null })),
    needsOutreach,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

const POSITIVE: string[] = ["replied", "interested", "not_now", "not_interested", "wrong_contact"];

export async function getAnalytics(db: Db, today: string, weeks = 8) {
  const since = `${addDays(today, -7 * weeks - 7)}T00:00:00Z`;
  const [prospects, messages, stageChanges, tasksDone, opportunities] = await Promise.all([
    activeProspects(db),
    db.from("outreach_messages").select("outreach_stage, sent_at, response_status, response_date, prospect_id").gte("sent_at", since).then((r) => must(r)),
    db.from("activities").select("occurred_at, metadata, prospect_id").eq("activity_type", "stage_change").gte("occurred_at", since).then((r) => must(r)),
    db.from("tasks").select("completed_at").eq("status", "completed").gte("completed_at", since).then((r) => must(r)),
    db.from("opportunities").select("created_at").gte("created_at", since).then((r) => must(r)),
  ]);

  const day = (ts: string) => dateInTimezone(ts);
  const qualifiedDates = stageChanges
    .filter((a) => (a.metadata as { to?: PipelineStage } | null)?.to === "qualified")
    .map((a) => day(a.occurred_at));

  const series = [
    { key: "added", label: "Prospects added", data: weeklyCounts(prospects.map((p) => day(p.created_at)), today, weeks) },
    {
      key: "contacted",
      label: "Prospects contacted (first message)",
      data: weeklyCounts(messages.filter((m) => m.outreach_stage === "first_contact").map((m) => day(m.sent_at)), today, weeks),
    },
    {
      key: "responses",
      label: "Responses",
      data: weeklyCounts(messages.filter((m) => m.response_date && POSITIVE.includes(m.response_status)).map((m) => day(m.response_date!)), today, weeks),
    },
    { key: "qualified", label: "Qualified leads", data: weeklyCounts(qualifiedDates, today, weeks) },
    { key: "followups", label: "Follow-ups completed", data: weeklyCounts(tasksDone.map((t) => day(t.completed_at!)), today, weeks) },
    { key: "opportunities", label: "Opportunities created", data: weeklyCounts(opportunities.map((o) => day(o.created_at)), today, weeks) },
  ];

  const counts = funnelCounts(prospects.map((p) => ({ stage: p.stage, reachedStage: p.furthest_stage })));

  // by source / prospect type — where are replies coming from?
  const breakdown = (key: "lead_source" | "prospect_type") => {
    const groups = new Map<string, typeof prospects>();
    for (const p of prospects) groups.set(p[key], [...(groups.get(p[key]) ?? []), p]);
    return [...groups.entries()]
      .map(([k, rows]) => {
        const c = funnelCounts(rows.map((p) => ({ stage: p.stage, reachedStage: p.furthest_stage })));
        return { key: k, ...c, ...acquisitionRates(c) };
      })
      .sort((a, b) => b.total - a.total);
  };

  return { series, counts, rates: acquisitionRates(counts), bySource: breakdown("lead_source"), byType: breakdown("prospect_type") };
}
