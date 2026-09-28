import { describe, expect, it } from "vitest";
import {
  FollowUpRuleError,
  forwardStage,
  planAfterOutreachSent,
  planAfterResponse,
  type OpenTask,
} from "@/lib/domain/follow-ups";
import { StageChangeError, planStageChange } from "@/lib/domain/pipeline";

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
      prospectStage: "prospect",
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

  it("never moves a prospect backwards or out of Won/Lost", () => {
    for (const stage of ["replied", "qualified", "won", "lost"] as const) {
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

  it("handles month/year boundaries", () => {
    const plan = planAfterOutreachSent({
      outreachStage: "first_contact",
      sentDate: "2026-12-30",
      businessName: "Acme",
      prospectStage: "prospect",
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
    expect(forwardStage("prospect", "contacted")).toBe("contacted");
    expect(forwardStage("qualified", "replied")).toBeNull();
    expect(forwardStage("lost", "replied")).toBeNull();
  });
});

describe("planStageChange", () => {
  const base = {
    businessName: "Acme",
    today: "2026-09-28",
    hasOpportunity: false,
    openTasks: [task({ id: "auto1", is_automated: true, sequence_step: "follow_up_1" }), task({ id: "m1" })],
  };

  it("rejects no-op changes", () => {
    expect(() => planStageChange({ ...base, from: "replied", to: "replied" })).toThrow(StageChangeError);
  });

  it("qualifying creates an opportunity and a handoff task, and ends the sequence", () => {
    const plan = planStageChange({ ...base, from: "replied", to: "qualified" });
    expect(plan.createOpportunity).toBe(true);
    expect(plan.createTasks[0].task_type).toBe("handoff");
    expect(plan.cancelTaskIds).toEqual(["auto1"]);
  });

  it("does not create a second opportunity", () => {
    const plan = planStageChange({ ...base, hasOpportunity: true, from: "replied", to: "discovery_call" });
    expect(plan.createOpportunity).toBe(false);
  });

  it("discovery call schedules a call task and rejects past dates", () => {
    const plan = planStageChange({
      ...base,
      from: "qualified",
      to: "discovery_call",
      hasOpportunity: true,
      discoveryCall: { date: "2026-10-02", time: "11:00" },
    });
    expect(plan.createTasks[0]).toMatchObject({ task_type: "discovery_call", due_date: "2026-10-02", due_time: "11:00" });
    expect(() =>
      planStageChange({ ...base, from: "qualified", to: "discovery_call", discoveryCall: { date: "2026-09-01" } }),
    ).toThrow(/past/);
  });

  it("proposal sent schedules a proposal follow-up", () => {
    const plan = planStageChange({ ...base, from: "technical_discussion", to: "proposal_sent", hasOpportunity: true });
    expect(plan.createTasks[0]).toMatchObject({ task_type: "proposal_follow_up", due_date: "2026-10-01" });
  });

  it("won/lost close the opportunity and cancel automated tasks only", () => {
    const won = planStageChange({ ...base, from: "negotiation", to: "won", hasOpportunity: true });
    expect(won.opportunityStatus).toBe("won");
    expect(won.cancelTaskIds).toEqual(["auto1"]);
    const lost = planStageChange({ ...base, from: "contacted", to: "lost" });
    expect(lost.opportunityStatus).toBe("lost");
    expect(lost.createOpportunity).toBe(false);
  });

  it("re-opening a lost deal re-opens the opportunity", () => {
    const plan = planStageChange({ ...base, from: "lost", to: "negotiation", hasOpportunity: true });
    expect(plan.opportunityStatus).toBe("open");
  });
});
