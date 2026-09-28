import { describe, expect, it } from "vitest";
import { integrationEnabled, memberClient, newUserClient, TODAY } from "./helpers";
import { hasDemoData, loadDemoData, removeDemoData, DEMO_PROSPECTS } from "@/lib/data/demo";
import { createProspect } from "@/lib/data/prospects";
import { prospectSchema } from "@/lib/validation/schemas";

describe.skipIf(!integrationEnabled)("demo data", () => {
  it("loads the Week 1 demo mix and removes it cleanly", async () => {
    const { db } = await memberClient();
    await loadDemoData(db, TODAY);
    expect(await hasDemoData(db)).toBe(true);

    const { data: prospects } = await db.from("prospects").select("id, stage, prospect_type, is_demo");
    expect(prospects).toHaveLength(15);
    expect(prospects!.every((p) => p.is_demo)).toBe(true);
    const { count: taskCount } = await db.from("tasks").select("id", { count: "exact", head: true });
    expect(taskCount).toBeGreaterThan(5);
    const { count: msgCount } = await db.from("outreach_messages").select("id", { count: "exact", head: true });
    expect(msgCount).toBeGreaterThan(10);

    await expect(loadDemoData(db, TODAY)).rejects.toThrow(/already loaded/);

    // real (non-demo) data survives removal
    await createProspect(db, prospectSchema.parse({ business_name: "Real Lead", lead_source: "referral", prospect_type: "startup" }), {
      confirmDuplicate: false,
    });
    expect(await removeDemoData(db)).toBe(15);
    const { data: left } = await db.from("prospects").select("business_name");
    expect(left).toEqual([{ business_name: "Real Lead" }]);
    const { count: orphanTasks } = await db.from("tasks").select("id", { count: "exact", head: true });
    expect(orphanTasks).toBe(0);
  });

  it("matches the requested demo composition", () => {
    const count = (fn: (p: (typeof DEMO_PROSPECTS)[number]) => boolean) => DEMO_PROSPECTS.filter(fn).length;
    expect(DEMO_PROSPECTS).toHaveLength(15);
    expect(count((p) => p.type === "marketing_agency")).toBe(4);
    expect(count((p) => p.type === "seo_agency")).toBe(2);
    expect(count((p) => p.type === "social_media_agency")).toBe(2);
    expect(count((p) => p.type === "startup")).toBe(1);
    expect(count((p) => p.industry === "Healthcare")).toBe(2);
    expect(count((p) => p.industry === "Education / coaching")).toBe(2);
    const stages = Object.fromEntries(
      ["prospect", "contacted", "replied", "qualified", "discovery_call", "proposal_sent", "won", "lost"].map((s) => [s, count((p) => p.stage === s)]),
    );
    expect(stages).toEqual({ prospect: 3, contacted: 3, replied: 2, qualified: 2, discovery_call: 2, proposal_sent: 1, won: 1, lost: 1 });
  });
});

describe.skipIf(!integrationEnabled)("security (RLS)", () => {
  it("isolates prospects between users", async () => {
    const a = await memberClient("A");
    const b = await memberClient("B");
    const created = await createProspect(a.db, prospectSchema.parse({ business_name: "A's secret lead", lead_source: "other", prospect_type: "other" }), {
      confirmDuplicate: false,
    });
    if (created.status !== "saved") throw new Error("not saved");

    const { data: seenByB } = await b.db.from("prospects").select("id").eq("id", created.id);
    expect(seenByB).toEqual([]);
    const { data: updated } = await b.db.from("prospects").update({ business_name: "hacked" }).eq("id", created.id).select("id");
    expect(updated).toEqual([]);
    // B cannot attach rows to A's prospect
    const { error } = await b.db.from("tasks").insert({ prospect_id: created.id, task_type: "other", title: "x", due_date: TODAY });
    expect(error?.code).toBe("42501");
  });

  it("blocks unapproved (pending) users entirely", async () => {
    await memberClient(); // ensures an admin exists
    const pending = await newUserClient();
    const { data: profile } = await pending.db.from("profiles").select("role").eq("id", pending.userId).single();
    expect(profile?.role).toBe("pending");
    const { data: templates } = await pending.db.from("outreach_templates").select("id");
    expect(templates).toEqual([]);
    const { error } = await pending.db.from("prospects").insert({ business_name: "x" });
    expect(error?.code).toBe("42501");
    const { error: escalate } = await pending.db.from("profiles").update({ role: "admin" }).eq("id", pending.userId);
    expect(escalate?.message).toMatch(/Only an admin/);
  });
});
