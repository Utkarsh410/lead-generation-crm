"use server";

import { z } from "zod";
import { revalidateApp, runAction } from "./run";
import { businessProfileSchema, defaultsSchema, profileSchema, scoringSchema } from "@/lib/validation/schemas";
import { uuid } from "@/lib/validation/common";
import { AppError, check, must } from "@/lib/data/errors";
import { loadDemoData, removeDemoData } from "@/lib/data/demo";
import { rescoreAll } from "@/lib/data/prospects";
import { normalizeScoringConfig } from "@/lib/domain/opportunity-score";

export async function updateProfileAction(input: unknown) {
  return runAction(profileSchema, input, async (values, { db, userId }) => {
    check(await db.from("profiles").update(values).eq("id", userId));
    await revalidateApp();
    return null;
  });
}

export async function updateBusinessProfileAction(input: unknown) {
  return runAction(businessProfileSchema, input, async (values, { db, userId }) => {
    check(await db.from("profiles").update(values).eq("id", userId));
    await revalidateApp();
    return null;
  });
}

export async function updateDefaultsAction(input: unknown) {
  return runAction(defaultsSchema, input, async (values, { db, userId }) => {
    check(await db.from("profiles").update(values).eq("id", userId));
    await revalidateApp();
    return null;
  });
}

export async function updateScoringAction(input: unknown) {
  return runAction(scoringSchema, input, async (values, { db, userId }) => {
    const config = normalizeScoringConfig(values);
    check(await db.from("profiles").update({ score_weights: config }).eq("id", userId));
    const changed = await rescoreAll(db, config);
    await revalidateApp();
    return { changed };
  });
}

export async function resetScoringAction() {
  return runAction(z.undefined().or(z.object({})), undefined, async (_v, { db, userId }) => {
    check(await db.from("profiles").update({ score_weights: null }).eq("id", userId));
    const changed = await rescoreAll(db, normalizeScoringConfig(null));
    await revalidateApp();
    return { changed };
  });
}

export async function setUserRoleAction(input: unknown) {
  const schema = z.object({ id: uuid, role: z.enum(["admin", "member", "pending"]) });
  return runAction(schema, input, async ({ id, role }, { db, profile, userId }) => {
    if (profile.role !== "admin") throw new AppError("Only admins can manage users.");
    if (id === userId && role !== "admin") throw new AppError("You can't remove your own admin access.");
    must(await db.from("profiles").update({ role }).eq("id", id).select("id"));
    await revalidateApp();
    return null;
  });
}

export async function loadDemoDataAction() {
  return runAction(z.undefined().or(z.object({})), undefined, async (_v, { db, today, settings }) => {
    const result = await loadDemoData(db, today, { myName: settings.myName, scoring: settings.scoring, currency: settings.currency });
    await revalidateApp();
    return result;
  });
}

export async function removeDemoDataAction() {
  return runAction(z.undefined().or(z.object({})), undefined, async (_v, { db }) => {
    const count = await removeDemoData(db);
    await revalidateApp();
    return { count };
  });
}
