"use server";

import { z } from "zod";
import { revalidateApp, runAction } from "./run";
import {
  convertToClientSchema,
  handoffCreateSchema,
  handoffUpdateSchema,
  leadStatusSchema,
  opportunityCreateSchema,
  opportunityStageSchema,
  opportunityUpdateSchema,
  qualificationSchema,
} from "@/lib/validation/schemas";
import { uuid } from "@/lib/validation/common";
import { setLeadStatus } from "@/lib/data/pipeline";
import { createOpportunity, deleteOpportunity, moveOpportunity, updateOpportunity } from "@/lib/data/opportunities";
import { saveQualification } from "@/lib/data/qualification";
import { createHandoff, updateHandoff } from "@/lib/data/handoffs";
import { convertProspectToClient } from "@/lib/data/clients";
import { getLookupOptions, labelFor } from "@/lib/data/workspace";

export async function setLeadStatusAction(input: unknown) {
  return runAction(leadStatusSchema, input, async (values, { db, today }) => {
    const result = await setLeadStatus(db, values, today);
    await revalidateApp();
    return result;
  });
}

export async function createOpportunityAction(input: unknown) {
  return runAction(opportunityCreateSchema, input, async (values, { db, today }) => {
    const row = await createOpportunity(db, values, today);
    await revalidateApp();
    return row;
  });
}

export async function updateOpportunityAction(input: unknown) {
  return runAction(opportunityUpdateSchema, input, async (values, { db }) => {
    await updateOpportunity(db, values);
    await revalidateApp();
    return null;
  });
}

export async function moveOpportunityAction(input: unknown) {
  return runAction(opportunityStageSchema, input, async (values, { db, today }) => {
    const result = await moveOpportunity(db, values, today);
    await revalidateApp();
    return result;
  });
}

export async function deleteOpportunityAction(input: unknown) {
  return runAction(z.object({ id: uuid }), input, async ({ id }, { db }) => {
    await deleteOpportunity(db, id);
    await revalidateApp();
    return null;
  });
}

export async function convertToClientAction(input: unknown) {
  return runAction(convertToClientSchema, input, async (values, { db }) => {
    const result = await convertProspectToClient(db, values);
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
  return runAction(handoffCreateSchema, input, async (values, { db, today, settings }) => {
    const { sources } = await getLookupOptions(db);
    const result = await createHandoff(db, values, {
      generatedBy: settings.myName,
      today,
      currency: settings.currency,
      sourceLabel: (s) => labelFor(sources, s),
    });
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
