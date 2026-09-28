import { describe, expect, it } from "vitest";
import {
  SCORE_FACTORS,
  calculateOpportunityScore,
  normalizeScoreFactors,
  suggestScoreFactors,
  temperatureFor,
} from "@/lib/domain/opportunity-score";
import {
  InvalidRatingError,
  assessQualification,
  calculateQualificationScore,
  isQualifiedClass,
  suggestClassification,
} from "@/lib/domain/qualification";

describe("opportunity score", () => {
  it("weights add up to 100", () => {
    expect(SCORE_FACTORS.reduce((s, f) => s + f.weight, 0)).toBe(100);
  });

  it("is 0 / cold for empty or garbage input", () => {
    for (const input of [undefined, null, {}, "x", 42, []]) {
      const r = calculateOpportunityScore(input);
      expect(r.score).toBe(0);
      expect(r.temperature).toBe("cold");
    }
  });

  it("is 100 / hot when every factor is strong", () => {
    const all = Object.fromEntries(SCORE_FACTORS.map((f) => [f.key, 3]));
    const r = calculateOpportunityScore(all);
    expect(r.score).toBe(100);
    expect(r.temperature).toBe("hot");
    expect(r.breakdown).toHaveLength(SCORE_FACTORS.length);
  });

  it("computes partial scores from weights", () => {
    // clear_problem 20 * 3/3 + tech_gap 15 * 2/3 = 20 + 10 = 30
    const r = calculateOpportunityScore({ clear_problem: 3, tech_gap: 2 });
    expect(r.score).toBe(30);
    expect(r.breakdown.find((b) => b.key === "tech_gap")?.points).toBe(10);
  });

  it("clamps out-of-range ratings and ignores unknown keys", () => {
    expect(normalizeScoreFactors({ urgency: 9, clear_problem: -4, bogus: 3 })).toEqual({
      urgency: 3,
      clear_problem: 0,
    });
    expect(normalizeScoreFactors({ urgency: "3" })).toEqual({ urgency: 0 });
  });

  it("maps score to temperature at thresholds", () => {
    expect(temperatureFor(39)).toBe("cold");
    expect(temperatureFor(40)).toBe("warm");
    expect(temperatureFor(69)).toBe("warm");
    expect(temperatureFor(70)).toBe("hot");
  });

  it("suggests contact/decision-maker factors from prospect data", () => {
    const s = suggestScoreFactors({
      contact_name: "Priya Shah",
      job_title: "Founder & CEO",
      email: "priya@example.com",
      phone: "+91 98765 43210",
    });
    expect(s.contact_info?.rating).toBe(3);
    expect(s.decision_maker?.rating).toBe(3);
    expect(suggestScoreFactors({}).contact_info?.rating).toBe(0);
    expect(suggestScoreFactors({ instagram_url: "https://instagram.com/x" }).contact_info?.rating).toBe(1);
  });
});

describe("qualification scoring", () => {
  const base = { need_clarity: 3, budget_fit: 3, timeline_fit: 3, decision_maker_access: 3, urgency: 3 };

  it("maps the 5–25 range onto 0–100", () => {
    expect(calculateQualificationScore({ need_clarity: 1, budget_fit: 1, timeline_fit: 1, decision_maker_access: 1, urgency: 1 })).toBe(0);
    expect(calculateQualificationScore(base)).toBe(50);
    expect(calculateQualificationScore({ need_clarity: 5, budget_fit: 5, timeline_fit: 5, decision_maker_access: 5, urgency: 5 })).toBe(100);
  });

  it("rejects ratings outside 1–5 or non-integers", () => {
    expect(() => calculateQualificationScore({ ...base, urgency: 0 })).toThrow(InvalidRatingError);
    expect(() => calculateQualificationScore({ ...base, urgency: 6 })).toThrow(InvalidRatingError);
    expect(() => calculateQualificationScore({ ...base, urgency: 2.5 })).toThrow(InvalidRatingError);
    expect(() => calculateQualificationScore({ ...base, urgency: Number.NaN })).toThrow(InvalidRatingError);
  });

  it("suggests classifications at thresholds", () => {
    expect(suggestClassification(39)).toBe("unqualified");
    expect(suggestClassification(40)).toBe("potential");
    expect(suggestClassification(60)).toBe("qualified");
    expect(suggestClassification(80)).toBe("high_priority");
  });

  it("warns about weak need, budget and decision-maker access", () => {
    const r = assessQualification({ ...base, need_clarity: 2, budget_fit: 1, decision_maker_access: 2 });
    expect(r.warnings).toHaveLength(3);
    expect(assessQualification(base).warnings).toHaveLength(0);
  });

  it("identifies qualified classes", () => {
    expect(isQualifiedClass("qualified")).toBe(true);
    expect(isQualifiedClass("high_priority")).toBe(true);
    expect(isQualifiedClass("potential")).toBe(false);
    expect(isQualifiedClass(null)).toBe(false);
  });
});
