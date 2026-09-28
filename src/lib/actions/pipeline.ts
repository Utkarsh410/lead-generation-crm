"use server";

import { revalidateApp, runAction } from "./run";
import { handoffCreateSchema, handoffUpdateSchema, opportunitySchema, qualificationSchema, stageChangeSchema } from "@/lib/validation/schemas";
import { changeStage } from "@/lib/data/pipeline";
import { saveQualification } from "@/lib/data/qualification";
import { createHandoff, updateHandoff } from "@/lib/data/handoffs";
import { updateOpportunity } from "@/lib/data/opportunities";
import { displayName } from "@/lib/auth/session";

export async function changeStageAction(input: unknown) {
  return runAction(stageChangeSchema, input, async (values, { db, today }) => {
    const result = await changeStage(db, values, today);
    await revalidateApp();
    return result;
  });
}

export async function saveQualificationAction(input: unknown) {
  return runAction(qualificationSchema, input, async (values, { db, today }) => {
    const result = await saveQualification(db, values, today);
    await revalidateApp();
    return result;
  });
}

export async function createHandoffAction(input: unknown) {
  return runAction(handoffCreateSchema, input, async (values, { db, today, profile }) => {
    const result = await createHandoff(db, values, { generatedBy: displayName(profile), today });
    await revalidateApp();
    return result;
  });
}

export async function updateHandoffAction(input: unknown) {
  return runAction(handoffUpdateSchema, input, async (values, { db }) => {
    await updateHandoff(db, values);
    await revalidateApp();
    return null;
  });
}

export async function updateOpportunityAction(input: unknown) {
  return runAction(opportunitySchema, input, async (values, { db }) => {
    await updateOpportunity(db, values);
    await revalidateApp();
    return null;
  });
}
