// "What should I do next with this prospect?" — a small rule table so every
// prospect screen leads to an action instead of being a passive record.

import type { LeadStatus, StageKey, StageKind } from "./constants";

export type NextStepAction =
  | "restore"
  | "research"
  | "first_outreach"
  | "follow_up"
  | "record_response"
  | "qualify"
  | "create_opportunity"
  | "advance_opportunity"
  | "schedule_call"
  | "proposal_follow_up"
  | "convert_client"
  | "manage_client"
  | "re_engage";

export type NextStep = { action: NextStepAction; title: string; description: string };

export type OpenOpportunitySummary = { id: string; title: string; stageKey: StageKey | null; stageKind: StageKind };

export function nextStepFor(p: {
  stage: LeadStatus;
  archived: boolean;
  hasObservedProblem: boolean;
  hasContactMethod: boolean;
  messagesSent: number;
  awaitingResponse: boolean;
  nextFollowUpDate: string | null;
  today: string;
  hasQualification: boolean;
  opportunities: OpenOpportunitySummary[];
  isClient: boolean;
}): NextStep {
  if (p.archived) {
    return { action: "restore", title: "Archived", description: "Restore this prospect to continue working on it." };
  }
  const won = p.opportunities.find((o) => o.stageKind === "won");
  if (won && !p.isClient) {
    return { action: "convert_client", title: "Convert to client", description: `“${won.title}” is won — create the client and project to track delivery and payments.` };
  }
  const active = p.opportunities.filter((o) => o.stageKind === "open");
  const proposal = active.find((o) => o.stageKey === "proposal");
  if (proposal) {
    return { action: "proposal_follow_up", title: "Follow up on the proposal", description: `Check they've reviewed the proposal for “${proposal.title}”.` };
  }
  const qualified = active.find((o) => o.stageKey === "qualified");
  if (qualified) {
    return { action: "schedule_call", title: "Schedule a discovery call", description: `Book a call to scope “${qualified.title}”.` };
  }
  if (active.length) {
    return { action: "advance_opportunity", title: "Move the deal forward", description: `${active.length} open opportunit${active.length === 1 ? "y" : "ies"} — update the stage and next action.` };
  }
  if (p.isClient || p.stage === "client") {
    return { action: "manage_client", title: "Look after the client", description: "Track projects and payments, and look for the next opportunity." };
  }

  switch (p.stage) {
    case "new":
      if (!p.hasObservedProblem || !p.hasContactMethod) {
        return {
          action: "research",
          title: "Finish research",
          description: !p.hasContactMethod
            ? "Add a contact method (email, phone, LinkedIn or Instagram) before reaching out."
            : "Note a specific problem you observed — it makes the first message personal.",
        };
      }
      return { action: "first_outreach", title: "Send first outreach", description: "Pick a template, personalise it and record that you sent it." };
    case "contacted":
      if (p.nextFollowUpDate && p.nextFollowUpDate <= p.today) {
        return { action: "follow_up", title: "Follow-up due", description: "No reply yet — send the next follow-up in the sequence." };
      }
      return {
        action: "record_response",
        title: "Waiting for a reply",
        description: p.nextFollowUpDate
          ? `Next follow-up is scheduled for ${p.nextFollowUpDate}. Record their response as soon as they reply.`
          : "Record their response when they reply, or schedule a follow-up.",
      };
    case "replied":
      return p.hasQualification
        ? { action: "create_opportunity", title: "Create an opportunity", description: "They're engaged — capture what they might buy." }
        : { action: "qualify", title: "Qualify this lead", description: "Need, budget, timeline, decision maker, urgency, solution fit and delivery feasibility." };
    case "qualified":
      return { action: "create_opportunity", title: "Create an opportunity", description: "Record the service, value and delivery model for this lead." };
    case "nurture":
      return { action: "re_engage", title: "Nurturing", description: "Keep a re-engagement follow-up scheduled so this lead doesn't go cold." };
    case "lost":
      return { action: "re_engage", title: "Re-engage later?", description: "Schedule a re-engagement follow-up if timing may change." };
  }
}
