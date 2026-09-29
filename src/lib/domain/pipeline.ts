// Side effects of (a) changing a prospect's lead status and (b) moving an
// opportunity through its sales pipeline. Both changes are logged to the
// prospect's timeline by database triggers. Everything here only creates or
// cancels reminders — nothing is ever sent.

import { addDays } from "./dates";
import type { LeadStatus, StageKey, StageKind } from "./constants";
import { PROPOSAL_FOLLOW_UP_DELAY_DAYS, forwardStage, type OpenTask, type TaskDraft } from "./follow-ups";

export class StageChangeError extends Error {}

const isOpen = (t: OpenTask) => t.status === "pending" || t.status === "snoozed";

// ---------------------------------------------------------------------------
// Lead status (prospect)
// ---------------------------------------------------------------------------

export type LeadStatusPlan = {
  cancelTaskIds: string[];
  /** Create a first opportunity when a prospect is qualified and has none. */
  createOpportunity: boolean;
};

export function planLeadStatusChange(args: {
  from: LeadStatus;
  to: LeadStatus;
  hasOpportunity: boolean;
  openTasks: OpenTask[];
}): LeadStatusPlan {
  if (args.from === args.to) throw new StageChangeError("The prospect already has this status.");
  const open = args.openTasks.filter(isOpen);
  const plan: LeadStatusPlan = { cancelTaskIds: [], createOpportunity: false };
  // the automated outreach sequence ends once the lead replied, is parked, lost or a client
  if (["replied", "qualified", "nurture", "client", "lost"].includes(args.to)) {
    plan.cancelTaskIds = open.filter((t) => t.is_automated && t.sequence_step).map((t) => t.id);
  }
  if (args.to === "qualified" && !args.hasOpportunity) plan.createOpportunity = true;
  return plan;
}

// ---------------------------------------------------------------------------
// Opportunity stage
// ---------------------------------------------------------------------------

export type OpportunityStageTarget = { key: StageKey | null; kind: StageKind; label: string };

export type OpportunityStagePlan = {
  createTasks: TaskDraft[];
  cancelTaskIds: string[];
  /** Lead status the prospect should move to (forward only), if any. */
  leadStatus: LeadStatus | null;
  /** Won: offer to convert the prospect into a client / create a project. */
  suggestClient: boolean;
};

const QUALIFIED_KEYS: Array<StageKey | null> = ["qualified", "discovery", "proposal", "negotiation", "won"];

export function planOpportunityStageChange(args: {
  opportunityName: string;
  fromStageId: string;
  toStageId: string;
  to: OpportunityStageTarget;
  prospectStatus: LeadStatus;
  today: string;
  openTasks: OpenTask[];
  discoveryCall?: { date: string; time?: string | null } | null;
  proposalFollowUpDays?: number;
}): OpportunityStagePlan {
  if (args.fromStageId === args.toStageId) throw new StageChangeError("The opportunity is already in this stage.");
  const open = args.openTasks.filter(isOpen);
  const name = args.opportunityName;
  const plan: OpportunityStagePlan = { createTasks: [], cancelTaskIds: [], leadStatus: null, suggestClient: false };

  if (args.to.key === "discovery" && args.discoveryCall) {
    if (args.discoveryCall.date < args.today) throw new StageChangeError("The discovery call date cannot be in the past.");
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

  if (args.to.key === "proposal") {
    plan.createTasks.push({
      task_type: "proposal_follow_up",
      title: `Follow up on proposal — ${name}`,
      due_date: addDays(args.today, args.proposalFollowUpDays ?? PROPOSAL_FOLLOW_UP_DELAY_DAYS),
      priority: "high",
      is_automated: true,
      sequence_step: null,
    });
  }

  if (args.to.kind === "won" || args.to.kind === "lost") {
    plan.cancelTaskIds = open.filter((t) => t.is_automated).map((t) => t.id);
  }
  plan.suggestClient = args.to.kind === "won";

  // an opportunity at Qualified or beyond means the lead itself is qualified
  if (QUALIFIED_KEYS.includes(args.to.key) || args.to.kind === "won") {
    plan.leadStatus = forwardStage(args.prospectStatus, "qualified");
  }
  return plan;
}
