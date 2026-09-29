"use server";

import { z } from "zod";
import { revalidateApp, runAction } from "./run";
import { lookupSchema, partnerSchema, pipelineStageSchema, qualificationQuestionSchema, serviceSchema } from "@/lib/validation/schemas";
import { uuid } from "@/lib/validation/common";
import {
  addStarterServices,
  deleteLookup,
  deletePartner,
  deletePipelineStage,
  deleteQualificationQuestion,
  deleteService,
  reorderPipelineStages,
  saveLookup,
  savePartner,
  savePipelineStage,
  saveQualificationQuestion,
  saveService,
} from "@/lib/data/catalog";

const byId = z.object({ id: uuid });

export async function savePartnerAction(input: unknown) {
  return runAction(partnerSchema.extend({ id: uuid.optional() }), input, async ({ id, ...values }, { db }) => {
    const row = await savePartner(db, values, id);
    await revalidateApp();
    return row;
  });
}

export async function deletePartnerAction(input: unknown) {
  return runAction(byId, input, async ({ id }, { db }) => {
    await deletePartner(db, id);
    await revalidateApp();
    return null;
  });
}

export async function saveServiceAction(input: unknown) {
  return runAction(serviceSchema.extend({ id: uuid.optional() }), input, async ({ id, ...values }, { db }) => {
    const row = await saveService(db, values, id);
    await revalidateApp();
    return row;
  });
}

export async function deleteServiceAction(input: unknown) {
  return runAction(byId, input, async ({ id }, { db }) => {
    await deleteService(db, id);
    await revalidateApp();
    return null;
  });
}

export async function addStarterServicesAction() {
  return runAction(z.undefined().or(z.object({})), undefined, async (_v, { db }) => {
    const count = await addStarterServices(db);
    await revalidateApp();
    return { count };
  });
}

export async function saveLookupAction(input: unknown) {
  return runAction(lookupSchema, input, async (values, { db }) => {
    const row = await saveLookup(db, values);
    await revalidateApp();
    return row;
  });
}

export async function deleteLookupAction(input: unknown) {
  return runAction(byId, input, async ({ id }, { db }) => {
    await deleteLookup(db, id);
    await revalidateApp();
    return null;
  });
}

export async function savePipelineStageAction(input: unknown) {
  return runAction(pipelineStageSchema, input, async (values, { db }) => {
    const row = await savePipelineStage(db, values);
    await revalidateApp();
    return row;
  });
}

export async function reorderPipelineStagesAction(input: unknown) {
  return runAction(z.object({ ids: z.array(uuid).min(1).max(50) }), input, async ({ ids }, { db }) => {
    await reorderPipelineStages(db, ids);
    await revalidateApp();
    return null;
  });
}

export async function deletePipelineStageAction(input: unknown) {
  return runAction(byId, input, async ({ id }, { db }) => {
    await deletePipelineStage(db, id);
    await revalidateApp();
    return null;
  });
}

export async function saveQualificationQuestionAction(input: unknown) {
  return runAction(qualificationQuestionSchema.extend({ id: uuid.optional() }), input, async ({ id, ...values }, { db }) => {
    const row = await saveQualificationQuestion(db, values, id);
    await revalidateApp();
    return row;
  });
}

export async function deleteQualificationQuestionAction(input: unknown) {
  return runAction(byId, input, async ({ id }, { db }) => {
    await deleteQualificationQuestion(db, id);
    await revalidateApp();
    return null;
  });
}
