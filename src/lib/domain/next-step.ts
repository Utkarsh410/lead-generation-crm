// "What should I do next with this prospect?" — a simple rule table so every
// prospect screen leads to an action instead of being a passive record.

import type { PipelineStage } from "./constants";

export type NextStepAction =
  | "restore"
  | "research"
  | "first_outreach"
  | "follow_up"
  | "record_response"
  | "qualify"
  | "schedule_call"
  | "handoff"
  | "move_stage"
  | "proposal_follow_up"
  | "track_commission"
  | "re_engage";

export type NextStep = { action: NextStepAction; title: string; description: string };

export function nextStepFor(p: {
  stage: PipelineStage;
  archived: boolean;
  hasObservedProblem: boolean;
  hasContactMethod: boolean;
  messagesSent: number;
  awaitingResponse: boolean;
  nextFollowUpDate: string | null;
  today: string;
  hasQualification: boolean;
  hasHandoff: boolean;
}): NextStep {
  if (p.archived) {
    return { action: "restore", title: "Archived", description: "Restore this prospect to continue working on it." };
  }
  switch (p.stage) {
    case "prospect":
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
        ? { action: "schedule_call", title: "Schedule a discovery call", description: "They replied and you've assessed them — book a call." }
        : { action: "qualify", title: "Qualify this lead", description: "Run the qualification questions: need, budget, timeline, decision maker, urgency." };
    case "qualified":
      if (!p.hasQualification) {
        return { action: "qualify", title: "Complete the qualification form", description: "Capture the details BharatCoder will need." };
      }
      return p.hasHandoff
        ? { action: "schedule_call", title: "Schedule the discovery call", description: "Handoff prepared — coordinate a call with BharatCoder." }
        : { action: "handoff", title: "Prepare BharatCoder handoff", description: "Generate the handoff summary and share it with BharatCoder." };
    case "discovery_call":
      return p.hasHandoff
        ? { action: "move_stage", title: "Log the call outcome", description: "After the call, move to Technical Discussion (or Lost)." }
        : { action: "handoff", title: "Prepare BharatCoder handoff", description: "Share the lead details before the discovery call." };
    case "technical_discussion":
      return { action: "move_stage", title: "Support scoping", description: "BharatCoder is scoping — move to Proposal Sent once the proposal goes out." };
    case "proposal_sent":
      return { action: "proposal_follow_up", title: "Follow up on the proposal", description: "Check they've reviewed it and answer questions." };
    case "negotiation":
      return { action: "move_stage", title: "Close the deal", description: "Help resolve open points, then mark Won or Lost." };
    case "won":
      return { action: "track_commission", title: "Track payments & commission", description: "Record the agreed commission % and amounts BharatCoder receives." };
    case "lost":
      return { action: "re_engage", title: "Re-engage later?", description: "Schedule a re-engagement follow-up if timing may change." };
  }
}
