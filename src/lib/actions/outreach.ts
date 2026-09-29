"use server";

import { z } from "zod";
import { revalidateApp, runAction } from "./run";
import { outreachMessageSchema, responseSchema, templateSchema } from "@/lib/validation/schemas";
import { uuid } from "@/lib/validation/common";
import { recordOutreach, recordResponse } from "@/lib/data/outreach";
import { AppError, check, must } from "@/lib/data/errors";

export async function recordOutreachAction(input: unknown) {
  return runAction(outreachMessageSchema, input, async (values, { db, today, settings }) => {
    const result = await recordOutreach(db, { ...values, template_id: values.template_id ?? null }, today, { delays: settings.delays, timezone: settings.timezone });
    await revalidateApp();
    return result;
  });
}

export async function recordResponseAction(input: unknown) {
  return runAction(responseSchema, input, async (values, { db, today, settings }) => {
    const result = await recordResponse(db, values, today, { timezone: settings.timezone });
    await revalidateApp();
    return result;
  });
}

export async function createTemplateAction(input: unknown) {
  return runAction(templateSchema, input, async (values, { db }) => {
    const row = must(await db.from("outreach_templates").insert(values).select("id").single());
    await revalidateApp();
    return row;
  });
}

export async function updateTemplateAction(input: unknown) {
  return runAction(templateSchema.extend({ id: uuid }), input, async ({ id, ...values }, { db }) => {
    const rows = must(await db.from("outreach_templates").update(values).eq("id", id).select("id"));
    if (!rows.length) throw new AppError("Template not found.");
    await revalidateApp();
    return null;
  });
}

export async function deleteTemplateAction(input: unknown) {
  return runAction(z.object({ id: uuid }), input, async ({ id }, { db }) => {
    check(await db.from("outreach_templates").delete().eq("id", id));
    await revalidateApp();
    return null;
  });
}
