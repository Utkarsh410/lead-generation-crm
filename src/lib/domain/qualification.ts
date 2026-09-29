// Qualification scoring. The score SUGGESTS a classification; the user always
// makes the final call (qualification_assessments.classification). Users can
// add their own questions (Settings → Qualification); those are recorded as
// answers and don't change the score.

import type { QualificationClass } from "./constants";

export const QUALIFICATION_CRITERIA = [
  { key: "need_clarity", label: "Need clarity", hint: "1 = vague idea · 5 = clear, specific requirement" },
  { key: "budget_fit", label: "Budget", hint: "1 = no/unrealistic budget · 5 = budget fits the scope" },
  { key: "timeline_fit", label: "Timeline", hint: "1 = unrealistic or undefined · 5 = realistic and defined" },
  { key: "decision_maker_access", label: "Decision-maker access", hint: "1 = no access · 5 = talking directly to them" },
  { key: "urgency", label: "Urgency", hint: "1 = someday · 5 = needed now" },
  { key: "solution_fit", label: "Solution fit", hint: "1 = not what I/partners offer · 5 = exactly what we do" },
  { key: "delivery_feasibility", label: "Delivery feasibility", hint: "1 = can't be delivered well · 5 = me/partner can deliver it confidently" },
] as const;

export type QualificationCriterion = (typeof QUALIFICATION_CRITERIA)[number]["key"];
/** Assessments made before solution fit / delivery feasibility existed lack those two. */
export type QualificationRatings = Record<QualificationCriterion, number | null | undefined>;

export const CLASSIFICATION_THRESHOLDS = {
  high_priority: 80,
  qualified: 60,
  potential: 40,
} as const;

export class InvalidRatingError extends Error {}

/** Maps the rated criteria (1–5 each) onto 0–100. Unrated (null) criteria are skipped. */
export function calculateQualificationScore(ratings: QualificationRatings): number {
  let sum = 0;
  let count = 0;
  for (const { key } of QUALIFICATION_CRITERIA) {
    const value = ratings[key];
    if (value === null || value === undefined) continue;
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new InvalidRatingError(`${key} must be an integer from 1 to 5`);
    }
    sum += value;
    count += 1;
  }
  if (count === 0) throw new InvalidRatingError("Rate at least one criterion");
  return Math.round(((sum - count) / (count * 4)) * 100);
}

export function suggestClassification(score: number): QualificationClass {
  if (score >= CLASSIFICATION_THRESHOLDS.high_priority) return "high_priority";
  if (score >= CLASSIFICATION_THRESHOLDS.qualified) return "qualified";
  if (score >= CLASSIFICATION_THRESHOLDS.potential) return "potential";
  return "unqualified";
}

export function assessQualification(ratings: QualificationRatings) {
  const score = calculateQualificationScore(ratings);
  const suggested = suggestClassification(score);
  const warnings: string[] = [];
  const low = (k: QualificationCriterion) => typeof ratings[k] === "number" && (ratings[k] as number) <= 2;
  if (low("need_clarity")) warnings.push("Need is still unclear — confirm the problem before proposing.");
  if (low("budget_fit")) warnings.push("Budget fit is weak — discuss the budget range first.");
  if (low("decision_maker_access")) warnings.push("No decision-maker access yet.");
  if (low("solution_fit")) warnings.push("Weak solution fit — consider referring this to a better-suited partner.");
  if (low("delivery_feasibility")) warnings.push("Delivery looks risky — line up a delivery partner before committing.");
  return { score, suggested, warnings };
}

/** Classifications that count as a qualified lead for analytics/handoff. */
export function isQualifiedClass(c: QualificationClass | null | undefined): boolean {
  return c === "qualified" || c === "high_priority";
}

export type CustomAnswer = { question: string; answer: string };

/** Sanitises stored custom answers (jsonb). */
export function normalizeCustomAnswers(input: unknown): CustomAnswer[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((a): a is CustomAnswer => Boolean(a) && typeof a === "object" && typeof (a as CustomAnswer).question === "string")
    .map((a) => ({ question: a.question, answer: typeof a.answer === "string" ? a.answer : "" }));
}
