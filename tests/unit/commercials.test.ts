import { describe, expect, it } from "vitest";
import {
  commissionEarnedMinor,
  describeTerms,
  fromMinor,
  projectFinancials,
  toMinor,
  validateCommercialTerms,
  weightedValue,
  type ProjectMoney,
} from "@/lib/domain/commercials";

const project = (over: Partial<ProjectMoney> = {}): ProjectMoney => ({
  total_project_value: "200000",
  payment_flow: "client_pays_partner",
  partner_cost: null,
  commission_received: null,
  commission_type: null,
  commission_percentage: null,
  fixed_commission: null,
  commission_basis: null,
  commission_custom_base: null,
  ...over,
});
const received = (...amounts: string[]) => amounts.map((amount) => ({ amount, status: "received" as const }));

describe("integer money helpers", () => {
  it("converts without float drift", () => {
    expect(toMinor("0.1") + toMinor("0.2")).toBe(30n);
    expect(toMinor("19.99")).toBe(1999n);
    expect(toMinor(null)).toBe(0n);
    expect(fromMinor(123456n)).toBe(1234.56);
  });
});

describe("commission terms", () => {
  it("never assumes a default: no terms → null (not set), not zero", () => {
    expect(commissionEarnedMinor(project(), { total: 20000000n, received: 10000000n, partnerCost: 0n })).toBeNull();
    expect(projectFinancials(project(), received("100000")).commissionEarned).toBeNull();
  });

  it("requires an explicit basis for percentage commission", () => {
    expect(validateCommercialTerms({ commission_type: "percentage", commission_percentage: "10", fixed_commission: null, commission_basis: null })).toContain(
      "Choose what the commission is calculated on (the basis).",
    );
    // invalid terms never produce a number
    expect(projectFinancials(project({ commission_type: "percentage", commission_percentage: "10" }), received("100000")).commissionEarned).toBeNull();
  });

  it("validates percentage range, fixed amount and custom base", () => {
    expect(validateCommercialTerms({ commission_type: "percentage", commission_percentage: "120", fixed_commission: null, commission_basis: "total_project_value" })).toHaveLength(1);
    expect(validateCommercialTerms({ commission_type: "fixed", commission_percentage: null, fixed_commission: null, commission_basis: null })).toHaveLength(1);
    expect(
      validateCommercialTerms({ commission_type: "percentage", commission_percentage: "5", fixed_commission: null, commission_basis: "custom", commission_custom_base: null }),
    ).toHaveLength(1);
    expect(validateCommercialTerms({ commission_type: "none", commission_percentage: null, fixed_commission: null, commission_basis: null })).toEqual([]);
  });

  it("brief example: ₹200,000 project, 10% on amount received, client paid ₹100,000 → ₹10,000", () => {
    const f = projectFinancials(project({ commission_type: "percentage", commission_percentage: "10", commission_basis: "amount_received" }), received("100000"));
    expect(f.commissionEarned).toBe(10000);
    expect(f.balanceDue).toBe(100000);
  });

  it("changing the basis changes the result", () => {
    const terms = { commission_type: "percentage" as const, commission_percentage: "10" };
    const pays = received("60000", "40000");
    expect(projectFinancials(project({ ...terms, commission_basis: "total_project_value" }), pays).commissionEarned).toBe(20000);
    expect(projectFinancials(project({ ...terms, commission_basis: "amount_received" }), pays).commissionEarned).toBe(10000);
    expect(projectFinancials(project({ ...terms, commission_basis: "net_revenue", partner_cost: "30000" }), pays).commissionEarned).toBe(7000);
    expect(projectFinancials(project({ ...terms, commission_basis: "custom", commission_custom_base: "50000" }), pays).commissionEarned).toBe(5000);
  });

  it("net revenue never goes below zero", () => {
    const f = projectFinancials(project({ commission_type: "percentage", commission_percentage: "10", commission_basis: "net_revenue", partner_cost: "150000" }), received("100000"));
    expect(f.commissionEarned).toBe(0);
  });

  it("only received payments count (expected/failed/refunded are ignored)", () => {
    const f = projectFinancials(project({ commission_type: "percentage", commission_percentage: "10", commission_basis: "amount_received" }), [
      { amount: "50000", status: "received" },
      { amount: "50000", status: "expected" },
      { amount: "20000", status: "failed" },
      { amount: "10000", status: "refunded" },
    ]);
    expect(f.received).toBe(50000);
    expect(f.expected).toBe(50000);
    expect(f.commissionEarned).toBe(5000);
  });

  it("rounds half-up to the paisa with fractional percentages", () => {
    const f = projectFinancials(project({ commission_type: "percentage", commission_percentage: "12.5", commission_basis: "amount_received" }), received("33333.33"));
    expect(f.commissionEarned).toBe(4166.67);
  });

  it("fixed commission: full amount, or accrued pro-rata on amount received", () => {
    expect(projectFinancials(project({ commission_type: "fixed", fixed_commission: "15000", commission_basis: "total_project_value" }), []).commissionEarned).toBe(15000);
    expect(projectFinancials(project({ commission_type: "fixed", fixed_commission: "15000", commission_basis: "amount_received" }), received("100000")).commissionEarned).toBe(7500);
    // capped at 100% when the client overpays
    expect(projectFinancials(project({ commission_type: "fixed", fixed_commission: "15000", commission_basis: "amount_received" }), received("250000")).commissionEarned).toBe(15000);
  });

  it("tracks commission received and outstanding", () => {
    const f = projectFinancials(
      project({ commission_type: "percentage", commission_percentage: "10", commission_basis: "amount_received", commission_received: "4000" }),
      received("100000"),
    );
    expect(f.commissionReceived).toBe(4000);
    expect(f.commissionOutstanding).toBe(6000);
    const over = projectFinancials(project({ commission_type: "percentage", commission_percentage: "10", commission_basis: "amount_received", commission_received: "20000" }), received("100000"));
    expect(over.commissionOutstanding).toBe(0);
  });
});

describe("project financials by money flow", () => {
  it("client pays me: margin after partner cost, payments are my revenue", () => {
    const f = projectFinancials(project({ payment_flow: "client_pays_me", partner_cost: "120000" }), received("80000"));
    expect(f.plannedMargin).toBe(80000);
    expect(f.partnerCost).toBe(120000);
    expect(f.myRevenueToDate).toBe(80000);
    expect(f.commissionEarned).toBeNull();
  });

  it("client pays partner: only commission is my revenue", () => {
    const f = projectFinancials(project({ commission_type: "percentage", commission_percentage: "10", commission_basis: "amount_received" }), received("100000"));
    expect(f.plannedMargin).toBeNull();
    expect(f.myRevenueToDate).toBe(10000);
  });

  it("no commission agreed", () => {
    expect(projectFinancials(project({ commission_type: "none" }), received("1000")).commissionEarned).toBe(0);
  });
});

describe("pipeline helpers", () => {
  it("weights values by probability exactly", () => {
    expect(
      weightedValue([
        { estimated_value: "100000", probability: 60 },
        { estimated_value: "33333.33", probability: 30 },
        { estimated_value: null, probability: 90 },
        { estimated_value: "5000", probability: null },
      ]),
    ).toBe(70000);
  });

  it("describes terms for people", () => {
    const fmt = (v: number) => `₹${v}`;
    expect(describeTerms({ commission_type: "percentage", commission_percentage: "10", fixed_commission: null, commission_basis: "amount_received" }, fmt)).toBe(
      "10% of amount received",
    );
    expect(describeTerms({ commission_type: "fixed", commission_percentage: null, fixed_commission: "5000", commission_basis: "total_project_value" }, fmt)).toBe("₹5000 fixed");
    expect(describeTerms({ commission_type: null, commission_percentage: null, fixed_commission: null, commission_basis: null }, fmt)).toBe("Not set");
  });
});
