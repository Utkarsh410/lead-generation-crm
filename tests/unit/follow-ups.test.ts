import { describe, expect, it } from "vitest";
import {
  FollowUpRuleError,
  forwardStage,
  planAfterOutreachSent,
  planAfterResponse,
  type OpenTask,
} from "@/lib/domain/follow-ups";
import { StageChangeError, planLeadStatusChange, planOpportunityStageChange } from "@/lib/domain/pipeline";

const task = (over: Partial<OpenTask> & { id: string }): OpenTask => ({
  task_type: "follow_up",
  status: "pending",
  is_automated: false,
  sequence_step: null,
  ...over,
});

describe("planAfterOutreachSent", () => {
  it("first contact → Follow-up #1 in 3 days, completes First Outreach, moves to Contacted", () => {
    const plan = planAfterOutreachSent({
      outreachStage: "first_contact",
      sentDate: "2026-09-28",
      businessName: "Acme",
      prospectStage: "new",
      openTasks: [task({ id: "t1", task_type: "first_outreach" }), task({ id: "t2", task_type: "other" })],
    });
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0]).toMatchObject({
      due_date: "2026-10-01",
      sequence_step: "follow_up_1",
      is_automated: true,
      task_type: "follow_up",
    });
    expect(plan.complete).toEqual(["t1"]);
    expect(plan.stage).toBe("contacted");
  });

  it("re-sending first contact replaces the existing automated sequence", () => {
    const plan = planAfterOutreachSent({
      outreachStage: "first_contact",
      sentDate: "2026-09-28",
      businessName: "Acme",
      prospectStage: "contacted",
      openTasks: [task({ id: "old", is_automated: true, sequence_step: "follow_up_1" })],
    });
    expect(plan.cancel).toEqual(["old"]);
    expect(plan.stage).toBeNull(); // already contacted
  });

  it("follow-up #1 → completes #1 reminder and schedules #2 five days later", () => {
    const plan = planAfterOutreachSent({
      outreachStage: "follow_up_1",
      sentDate: "2026-10-01",
      businessName: "Acme",
      prospectStage: "contacted",
      openTasks: [task({ id: "f1", is_automated: true, sequence_step: "follow_up_1" })],
    });
    expect(plan.complete).toEqual(["f1"]);
    expect(plan.create[0]).toMatchObject({ due_date: "2026-10-06", sequence_step: "follow_up_2" });
  });

  it("follow-up #2 ends the sequence", () => {
    const plan = planAfterOutreachSent({
      outreachStage: "follow_up_2",
      sentDate: "2026-10-06",
      businessName: "Acme",
      prospectStage: "contacted",
      openTasks: [task({ id: "f2", is_automated: true, sequence_step: "follow_up_2" })],
    });
    expect(plan.complete).toEqual(["f2"]);
    expect(plan.create).toEqual([]);
  });

  it("never moves a prospect backwards or out of Client/Lost", () => {
    for (const stage of ["replied", "qualified", "client", "lost"] as const) {
      const plan = planAfterOutreachSent({
        outreachStage: "first_contact",
        sentDate: "2026-09-28",
        businessName: "Acme",
        prospectStage: stage,
        openTasks: [],
      });
      expect(plan.stage).toBeNull();
    }
  });

  it("uses the configured follow-up delays", () => {
    const plan = planAfterOutreachSent({
      outreachStage: "first_contact",
      sentDate: "2026-09-28",
      businessName: "Acme",
      prospectStage: "new",
      openTasks: [],
      delays: { followUp1: 7, followUp2: 10 },
    });
    expect(plan.create[0].due_date).toBe("2026-10-05");
  });

  it("handles month/year boundaries", () => {
    const plan = planAfterOutreachSent({
      outreachStage: "first_contact",
      sentDate: "2026-12-30",
      businessName: "Acme",
      prospectStage: "new",
      openTasks: [],
    });
    expect(plan.create[0].due_date).toBe("2027-01-02");
  });
});

describe("planAfterResponse", () => {
  const openTasks = [
    task({ id: "auto1", is_automated: true, sequence_step: "follow_up_1" }),
    task({ id: "manual", is_automated: false }),
    task({ id: "done", is_automated: true, status: "completed" }),
  ];
  const base = { today: "2026-09-28", businessName: "Acme", prospectStage: "contacted" as const, openTasks };

  it("reply cancels pending automated follow-ups and moves to Replied", () => {
    const plan = planAfterResponse({ ...base, status: "replied" });
    expect(plan.cancel).toEqual(["auto1"]);
    expect(plan.stage).toBe("replied");
    expect(plan.create[0]).toMatchObject({ task_type: "qualification", due_date: "2026-09-28" });
  });

  it("interested is urgent", () => {
    expect(planAfterResponse({ ...base, status: "interested" }).create[0].priority).toBe("urgent");
  });

  it("not interested stops the sequence without new tasks", () => {
    const plan = planAfterResponse({ ...base, status: "not_interested" });
    expect(plan.cancel).toEqual(["auto1"]);
    expect(plan.create).toEqual([]);
    expect(plan.stage).toBeNull();
  });

  it("not now requires a future custom follow-up date", () => {
    expect(() => planAfterResponse({ ...base, status: "not_now" })).toThrow(FollowUpRuleError);
    expect(() => planAfterResponse({ ...base, status: "not_now", followUpDate: "2026-09-27" })).toThrow(/past/);
    const plan = planAfterResponse({ ...base, status: "not_now", followUpDate: "2026-12-01" });
    expect(plan.cancel).toEqual(["auto1"]);
    expect(plan.create[0]).toMatchObject({ due_date: "2026-12-01", is_automated: false });
  });

  it("no response / delivered change nothing", () => {
    for (const status of ["no_response", "delivered", "sent"] as const) {
      const plan = planAfterResponse({ ...base, status });
      expect(plan).toEqual({ create: [], complete: [], cancel: [], stage: null });
    }
  });

  it("wrong contact stops sequence and creates research task", () => {
    const plan = planAfterResponse({ ...base, status: "wrong_contact" });
    expect(plan.cancel).toEqual(["auto1"]);
    expect(plan.create[0].task_type).toBe("internal_follow_up");
  });
});

describe("forwardStage", () => {
  it("only moves forward", () => {
    expect(forwardStage("new", "contacted")).toBe("contacted");
    expect(forwardStage("qualified", "replied")).toBeNull();
    expect(forwardStage("lost", "replied")).toBeNull();
    expect(forwardStage("client", "qualified")).toBeNull();
    expect(forwardStage("nurture", "replied")).toBe("replied");
  });
});

describe("planLeadStatusChange", () => {
  const openTasks = [task({ id: "auto1", is_automated: true, sequence_step: "follow_up_1" }), task({ id: "m1" })];

  it("rejects no-op changes", () => {
    expect(() => planLeadStatusChange({ from: "replied", to: "replied", hasOpportunity: false, openTasks })).toThrow(StageChangeError);
  });

  it("qualifying ends the outreach sequence and creates a first opportunity", () => {
    const plan = planLeadStatusChange({ from: "replied", to: "qualified", hasOpportunity: false, openTasks });
    expect(plan.cancelTaskIds).toEqual(["auto1"]);
    expect(plan.createOpportunity).toBe(true);
  });

  it("does not create a second opportunity", () => {
    expect(planLeadStatusChange({ from: "replied", to: "qualified", hasOpportunity: true, openTasks }).createOpportunity).toBe(false);
  });

  it("nurture / lost stop the sequence but keep manual tasks", () => {
    for (const to of ["nurture", "lost"] as const) {
      expect(planLeadStatusChange({ from: "contacted", to, hasOpportunity: false, openTasks }).cancelTaskIds).toEqual(["auto1"]);
    }
  });
});

describe("planOpportunityStageChange", () => {
  const base = {
    opportunityName: "Acme — Website",
    fromStageId: "s-qualified",
    prospectStatus: "replied" as const,
    today: "2026-09-28",
    openTasks: [task({ id: "auto1", is_automated: true }), task({ id: "m1" })],
  };

  it("rejects moving to the same stage", () => {
    expect(() => planOpportunityStageChange({ ...base, toStageId: "s-qualified", to: { key: "qualified", kind: "open", label: "Qualified" } })).toThrow(StageChangeError);
  });

  it("discovery schedules a call and rejects past dates", () => {
    const plan = planOpportunityStageChange({
      ...base,
      toStageId: "s-disc",
      to: { key: "discovery", kind: "open", label: "Discovery" },
      discoveryCall: { date: "2026-10-02", time: "11:00" },
    });
    expect(plan.createTasks[0]).toMatchObject({ task_type: "discovery_call", due_date: "2026-10-02", due_time: "11:00" });
    expect(() =>
      planOpportunityStageChange({ ...base, toStageId: "s-disc", to: { key: "discovery", kind: "open", label: "Discovery" }, discoveryCall: { date: "2026-09-01" } }),
    ).toThrow(/past/);
  });

  it("proposal schedules a proposal follow-up", () => {
    const plan = planOpportunityStageChange({ ...base, toStageId: "s-prop", to: { key: "proposal", kind: "open", label: "Proposal" } });
    expect(plan.createTasks[0]).toMatchObject({ task_type: "proposal_follow_up", due_date: "2026-10-01" });
  });

  it("qualified-or-later stages move the lead status forward to Qualified", () => {
    expect(planOpportunityStageChange({ ...base, toStageId: "s-neg", to: { key: "negotiation", kind: "open", label: "Negotiation" } }).leadStatus).toBe("qualified");
    expect(
      planOpportunityStageChange({ ...base, prospectStatus: "client", toStageId: "s-neg", to: { key: "negotiation", kind: "open", label: "Negotiation" } }).leadStatus,
    ).toBeNull();
    expect(planOpportunityStageChange({ ...base, toStageId: "s-cont", to: { key: "contacted", kind: "open", label: "Contacted" } }).leadStatus).toBeNull();
  });

  it("won suggests converting to a client; won/lost cancel automated tasks only", () => {
    const won = planOpportunityStageChange({ ...base, toStageId: "s-won", to: { key: "won", kind: "won", label: "Won" } });
    expect(won.suggestClient).toBe(true);
    expect(won.cancelTaskIds).toEqual(["auto1"]);
    const lost = planOpportunityStageChange({ ...base, toStageId: "s-lost", to: { key: "lost", kind: "lost", label: "Lost" } });
    expect(lost.suggestClient).toBe(false);
    expect(lost.cancelTaskIds).toEqual(["auto1"]);
  });

  it("custom stages (no key) work by kind", () => {
    const plan = planOpportunityStageChange({ ...base, toStageId: "s-custom", to: { key: null, kind: "won", label: "Signed" } });
    expect(plan.suggestClient).toBe(true);
  });
});
