import { describe, expect, it } from "vitest";
import { integrationEnabled, memberClient, newUserClient, TODAY } from "./helpers";
import { hasDemoData, loadDemoData, removeDemoData, DEMO_PROSPECTS } from "@/lib/data/demo";
import { createProspect } from "@/lib/data/prospects";
import { prospectSchema } from "@/lib/validation/schemas";

describe.skipIf(!integrationEnabled)("demo data", () => {
  it("loads the generic demo mix and removes it cleanly", async () => {
    const { db } = await memberClient();
    const result = await loadDemoData(db, TODAY, { myName: "Tester" });
    expect(result).toEqual({ prospects: DEMO_PROSPECTS.length, partners: 3, services: 4 });
    expect(await hasDemoData(db)).toBe(true);

    const { data: prospects } = await db.from("prospects").select("id, is_demo");
    expect(prospects).toHaveLength(DEMO_PROSPECTS.length);
    expect(prospects!.every((p) => p.is_demo)).toBe(true);
    const { count: taskCount } = await db.from("tasks").select("id", { count: "exact", head: true });
    expect(taskCount).toBeGreaterThan(5);
    const { count: msgCount } = await db.from("outreach_messages").select("id", { count: "exact", head: true });
    expect(msgCount).toBeGreaterThan(5);
    const { data: opps } = await db.from("opportunities").select("id, status, delivery_model");
    expect(opps).toHaveLength(DEMO_PROSPECTS.reduce((n, p) => n + p.opportunities, 0));
    expect(new Set(opps!.map((o) => o.status))).toEqual(new Set(["open", "won", "lost"]));
    const { data: projects } = await db.from("projects").select("id, payments(id)");
    expect(projects!.length).toBeGreaterThanOrEqual(3);
    expect(projects!.some((p) => p.payments.length > 0)).toBe(true);
    // demo text is signed with the user's name, never a vendor brand
    const { data: msgs } = await db.from("outreach_messages").select("customized_message");
    expect(msgs!.every((m) => !/bharatcoder|hariom/i.test(m.customized_message))).toBe(true);
    expect(msgs!.some((m) => m.customized_message.includes("Tester"))).toBe(true);

    await expect(loadDemoData(db, TODAY, { myName: "Tester" })).rejects.toThrow(/already loaded/);

    // real (non-demo) data survives removal
    await createProspect(db, prospectSchema.parse({ business_name: "Real Lead", lead_source: "referral", prospect_type: "startup" }), {
      confirmDuplicate: false,
    });
    const { data: realPartner } = await db.from("partners").insert({ name: "Real Partner", partner_type: "freelancer", status: "active" }).select("id").single();
    expect(await removeDemoData(db)).toBe(DEMO_PROSPECTS.length);
    expect(await hasDemoData(db)).toBe(false);
    const { data: left } = await db.from("prospects").select("business_name");
    expect(left).toEqual([{ business_name: "Real Lead" }]);
    const { data: partnersLeft } = await db.from("partners").select("id");
    expect(partnersLeft).toEqual([{ id: realPartner!.id }]);
    for (const table of ["tasks", "opportunities", "clients", "projects", "payments", "services"] as const) {
      const { count } = await db.from(table).select("id", { count: "exact", head: true });
      expect(count, table).toBe(0);
    }
  });

  it("covers the requested example businesses and business models", () => {
    const industries = DEMO_PROSPECTS.map((p) => p.industry);
    for (const i of ["Marketing agency", "SEO agency", "Healthcare", "Education / coaching", "E-commerce", "SaaS", "Real estate", "Professional services", "Retail"]) {
      expect(industries, i).toContain(i);
    }
    expect(DEMO_PROSPECTS.filter((p) => p.industry === "Healthcare")).toHaveLength(2); // physio + dental
    const models = new Set(DEMO_PROSPECTS.flatMap((p) => p.deliveryModels));
    for (const m of ["self_delivered", "partner_delivered", "referral"]) expect(models.has(m as never), m).toBe(true);
    expect(DEMO_PROSPECTS.some((p) => p.opportunities > 1)).toBe(true);
    const statuses = new Set(DEMO_PROSPECTS.map((p) => p.stage));
    for (const st of ["new", "contacted", "replied", "qualified", "client", "lost"]) expect(statuses.has(st as never), st).toBe(true);
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
