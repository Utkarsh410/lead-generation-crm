// Qualification scoring. The score SUGGESTS a classification; the user always
// makes the final call (qualification_assessments.classification).

import type { QualificationClass } from "./constants";

export const QUALIFICATION_CRITERIA = [
  { key: "need_clarity", label: "Need clarity", hint: "1 = vague idea · 5 = clear, specific requirement" },
  { key: "budget_fit", label: "Budget fit", hint: "1 = no/unrealistic budget · 5 = budget fits the scope" },
  { key: "timeline_fit", label: "Timeline fit", hint: "1 = unrealistic or undefined · 5 = realistic and defined" },
  { key: "decision_maker_access", label: "Decision-maker access", hint: "1 = no access · 5 = talking directly to them" },
  { key: "urgency", label: "Urgency", hint: "1 = someday · 5 = needed now" },
] as const;

export type QualificationCriterion = (typeof QUALIFICATION_CRITERIA)[number]["key"];
export type QualificationRatings = Record<QualificationCriterion, number>;

export const CLASSIFICATION_THRESHOLDS = {
  high_priority: 80,
  qualified: 60,
  potential: 40,
} as const;

export class InvalidRatingError extends Error {}

export function calculateQualificationScore(ratings: QualificationRatings): number {
  let sum = 0;
  for (const { key } of QUALIFICATION_CRITERIA) {
    const value = ratings[key];
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new InvalidRatingError(`${key} must be an integer from 1 to 5`);
    }
    sum += value;
  }
  const min = QUALIFICATION_CRITERIA.length;
  const max = QUALIFICATION_CRITERIA.length * 5;
  return Math.round(((sum - min) / (max - min)) * 100);
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
  if (ratings.need_clarity <= 2) warnings.push("Need is still unclear — confirm the problem before handing off.");
  if (ratings.budget_fit <= 2) warnings.push("Budget fit is weak — discuss budget range before handoff.");
  if (ratings.decision_maker_access <= 2) warnings.push("No decision-maker access yet.");
  return { score, suggested, warnings };
}

/** Classifications that count as a qualified lead for analytics/handoff. */
export function isQualifiedClass(c: QualificationClass | null | undefined): boolean {
  return c === "qualified" || c === "high_priority";
}
