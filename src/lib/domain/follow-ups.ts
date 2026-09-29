// Follow-up "automation": pure functions that decide which reminder tasks to
// create, complete or cancel. Nothing here (or anywhere in LeadOS) sends a message.

import { addDays } from "./dates";
import {
  FUNNEL_ORDER,
  type LeadStatus,
  type OutreachStage,
  type ResponseStatus,
  type TaskPriority,
  type TaskType,
} from "./constants";

// Defaults; users can change the follow-up intervals in Settings.
export const FOLLOW_UP_1_DELAY_DAYS = 3;
export const FOLLOW_UP_2_DELAY_DAYS = 5;
export const PROPOSAL_FOLLOW_UP_DELAY_DAYS = 3;

export type FollowUpDelays = { followUp1: number; followUp2: number };
export const DEFAULT_DELAYS: FollowUpDelays = { followUp1: FOLLOW_UP_1_DELAY_DAYS, followUp2: FOLLOW_UP_2_DELAY_DAYS };

export type SequenceStep = "follow_up_1" | "follow_up_2";

export type TaskDraft = {
  task_type: TaskType;
  title: string;
  due_date: string;
  due_time?: string | null;
  priority: TaskPriority;
  notes?: string | null;
  is_automated: boolean;
  sequence_step?: SequenceStep | null;
};

export type OpenTask = {
  id: string;
  task_type: TaskType;
  status: "pending" | "snoozed" | "completed" | "cancelled";
  is_automated: boolean;
  sequence_step: SequenceStep | null;
};

export type TaskPlan = {
  create: TaskDraft[];
  complete: string[];
  cancel: string[];
  /** Lead status to move to (only ever forwards), or null to leave it. */
  stage: LeadStatus | null;
};

const emptyPlan = (): TaskPlan => ({ create: [], complete: [], cancel: [], stage: null });

const isOpen = (t: OpenTask) => t.status === "pending" || t.status === "snoozed";

export function stageIndex(stage: LeadStatus): number {
  const i = FUNNEL_ORDER.indexOf(stage);
  return i === -1 ? -1 : i; // nurture / lost are outside the funnel
}

/**
 * Returns `target` if it moves the lead forward, else null. Lost leads and
 * clients are never moved automatically; a nurtured lead that re-engages is.
 */
export function forwardStage(current: LeadStatus, target: LeadStatus): LeadStatus | null {
  if (current === "lost" || current === "client") return null;
  if (current === "nurture") return target;
  return stageIndex(target) > stageIndex(current) ? target : null;
}

/** What happens after the user records that an outreach message was sent. */
export function planAfterOutreachSent(args: {
  outreachStage: OutreachStage;
  sentDate: string; // YYYY-MM-DD in the business timezone
  businessName: string;
  prospectStage: LeadStatus;
  openTasks: OpenTask[];
  delays?: FollowUpDelays;
}): TaskPlan {
  const plan = emptyPlan();
  const open = args.openTasks.filter(isOpen);
  const name = args.businessName;
  const delays = args.delays ?? DEFAULT_DELAYS;

  switch (args.outreachStage) {
    case "first_contact": {
      // this outreach fulfils any "First Outreach" reminder…
      plan.complete.push(...open.filter((t) => t.task_type === "first_outreach").map((t) => t.id));
      // …and restarts the sequence (avoid duplicate follow-up #1/#2 reminders)
      plan.cancel.push(...open.filter((t) => t.is_automated && t.sequence_step).map((t) => t.id));
      plan.create.push({
        task_type: "follow_up",
        title: `Follow-up #1 — ${name}`,
        due_date: addDays(args.sentDate, delays.followUp1),
        priority: "medium",
        notes: "Automatic reminder: no reply yet? Send Follow-up #1. (Cancelled automatically if they reply.)",
        is_automated: true,
        sequence_step: "follow_up_1",
      });
      break;
    }
    case "follow_up_1": {
      plan.complete.push(...open.filter((t) => t.sequence_step === "follow_up_1").map((t) => t.id));
      plan.cancel.push(...open.filter((t) => t.sequence_step === "follow_up_2").map((t) => t.id));
      plan.create.push({
        task_type: "follow_up",
        title: `Follow-up #2 — ${name}`,
        due_date: addDays(args.sentDate, delays.followUp2),
        priority: "medium",
        notes: "Automatic reminder: still no reply? Send the closing-the-loop Follow-up #2.",
        is_automated: true,
        sequence_step: "follow_up_2",
      });
      break;
    }
    case "follow_up_2": {
      plan.complete.push(...open.filter((t) => t.sequence_step === "follow_up_2").map((t) => t.id));
      break;
    }
    case "proposal_follow_up": {
      plan.complete.push(...open.filter((t) => t.task_type === "proposal_follow_up").map((t) => t.id));
      break;
    }
    default:
      break;
  }

  const initialStages: OutreachStage[] = ["first_contact", "follow_up_1", "follow_up_2"];
  if (initialStages.includes(args.outreachStage)) {
    plan.stage = forwardStage(args.prospectStage, "contacted");
  }
  return plan;
}

export class FollowUpRuleError extends Error {}

/** What happens after the user records a prospect's response. */
export function planAfterResponse(args: {
  status: ResponseStatus;
  today: string;
  businessName: string;
  prospectStage: LeadStatus;
  openTasks: OpenTask[];
  /** Required for "not_now" (contact me later). */
  followUpDate?: string | null;
}): TaskPlan {
  const plan = emptyPlan();
  const open = args.openTasks.filter(isOpen);
  const automated = open.filter((t) => t.is_automated).map((t) => t.id);
  const name = args.businessName;

  switch (args.status) {
    case "replied":
    case "interested": {
      plan.cancel.push(...automated);
      plan.stage = forwardStage(args.prospectStage, "replied");
      plan.create.push({
        task_type: "qualification",
        title: `Reply to ${name} and qualify`,
        due_date: args.today,
        priority: args.status === "interested" ? "urgent" : "high",
        notes: "They responded — reply, then run the qualification questions.",
        is_automated: true,
        sequence_step: null,
      });
      break;
    }
    case "not_interested": {
      plan.cancel.push(...automated);
      break;
    }
    case "wrong_contact": {
      plan.cancel.push(...automated);
      plan.create.push({
        task_type: "internal_follow_up",
        title: `Find the right contact at ${name}`,
        due_date: addDays(args.today, 1),
        priority: "medium",
        is_automated: true,
        sequence_step: null,
      });
      break;
    }
    case "not_now": {
      if (!args.followUpDate) {
        throw new FollowUpRuleError("Choose when to follow up (they asked to be contacted later).");
      }
      if (args.followUpDate < args.today) {
        throw new FollowUpRuleError("The follow-up date cannot be in the past.");
      }
      plan.cancel.push(...automated);
      // park the lead in Nurture until the agreed date (clients/lost stay as they are)
      if (["new", "contacted", "replied", "qualified"].includes(args.prospectStage)) plan.stage = "nurture";
      plan.create.push({
        task_type: "follow_up",
        title: `Re-engage ${name} (asked to follow up later)`,
        due_date: args.followUpDate,
        priority: "medium",
        notes: "They asked to be contacted later — use a Re-engagement template.",
        is_automated: false,
        sequence_step: null,
      });
      break;
    }
    case "no_response":
    case "sent":
    case "delivered":
      break;
  }
  return plan;
}

/** Reminder created when a prospect moves to Proposal Sent. */
export function proposalFollowUpTask(businessName: string, today: string): TaskDraft {
  return {
    task_type: "proposal_follow_up",
    title: `Follow up on proposal — ${businessName}`,
    due_date: addDays(today, PROPOSAL_FOLLOW_UP_DELAY_DAYS),
    priority: "high",
    is_automated: true,
    sequence_step: null,
  };
}
