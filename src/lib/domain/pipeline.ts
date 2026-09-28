// Side effects of moving a prospect between pipeline stages. The stage change
// itself is logged to the timeline by a database trigger.

import { ACTIVE_OPPORTUNITY_STAGES, type PipelineStage } from "./constants";
import { proposalFollowUpTask, stageIndex, type OpenTask, type TaskDraft } from "./follow-ups";

export class StageChangeError extends Error {}

export type StageChangePlan = {
  createTasks: TaskDraft[];
  cancelTaskIds: string[];
  /** Create an opportunity record (first time the prospect becomes qualified). */
  createOpportunity: boolean;
  /** New status for existing open opportunities, if any. */
  opportunityStatus: "open" | "won" | "lost" | null;
};

export function planStageChange(args: {
  from: PipelineStage;
  to: PipelineStage;
  businessName: string;
  today: string;
  hasOpportunity: boolean;
  openTasks: OpenTask[];
  discoveryCall?: { date: string; time?: string | null } | null;
  lostReason?: string | null;
}): StageChangePlan {
  const { from, to, today, businessName: name } = args;
  if (from === to) throw new StageChangeError("The prospect is already in this stage.");

  const plan: StageChangePlan = {
    createTasks: [],
    cancelTaskIds: [],
    createOpportunity: false,
    opportunityStatus: null,
  };
  const open = args.openTasks.filter((t) => t.status === "pending" || t.status === "snoozed");

  const reachesQualified =
    to !== "lost" && stageIndex(to) >= stageIndex("qualified") && stageIndex(from) < stageIndex("qualified");
  if (reachesQualified && !args.hasOpportunity) plan.createOpportunity = true;

  if (to === "qualified") {
    plan.createTasks.push({
      task_type: "handoff",
      title: `Prepare BharatCoder handoff — ${name}`,
      due_date: today,
      priority: "high",
      is_automated: true,
      sequence_step: null,
    });
  }

  if (to === "discovery_call" && args.discoveryCall) {
    if (args.discoveryCall.date < today) {
      throw new StageChangeError("The discovery call date cannot be in the past.");
    }
    plan.createTasks.push({
      task_type: "discovery_call",
      title: `Discovery call — ${name}`,
      due_date: args.discoveryCall.date,
      due_time: args.discoveryCall.time || null,
      priority: "high",
      is_automated: false,
      sequence_step: null,
    });
  }

  if (to === "proposal_sent") {
    plan.createTasks.push(proposalFollowUpTask(name, today));
  }

  if (to === "won" || to === "lost") {
    // the outreach sequence is over either way
    plan.cancelTaskIds.push(...open.filter((t) => t.is_automated).map((t) => t.id));
    plan.opportunityStatus = to;
  } else if ((from === "won" || from === "lost") && ACTIVE_OPPORTUNITY_STAGES.includes(to)) {
    plan.opportunityStatus = "open"; // re-opened
  }

  // moving out of the early outreach stages ends the automated follow-up sequence
  if (stageIndex(to) >= stageIndex("replied") && to !== "lost" && to !== "won") {
    plan.cancelTaskIds.push(
      ...open.filter((t) => t.is_automated && t.sequence_step).map((t) => t.id),
    );
  }

  plan.cancelTaskIds = [...new Set(plan.cancelTaskIds)];
  return plan;
}
