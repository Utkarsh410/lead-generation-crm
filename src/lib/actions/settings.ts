"use server";

import { z } from "zod";
import { revalidateApp, runAction } from "./run";
import { profileSchema, projectTypeSchema } from "@/lib/validation/schemas";
import { uuid } from "@/lib/validation/common";
import { AppError, check, must } from "@/lib/data/errors";
import { loadDemoData, removeDemoData } from "@/lib/data/demo";

export async function updateProfileAction(input: unknown) {
  return runAction(profileSchema, input, async ({ full_name }, { db, userId }) => {
    check(await db.from("profiles").update({ full_name }).eq("id", userId));
    await revalidateApp();
    return null;
  });
}

export async function setUserRoleAction(input: unknown) {
  const schema = z.object({ id: uuid, role: z.enum(["admin", "member", "pending"]) });
  return runAction(schema, input, async ({ id, role }, { db, profile, userId }) => {
    if (profile.role !== "admin") throw new AppError("Only admins can manage users.");
    if (id === userId && role !== "admin") throw new AppError("You can't remove your own admin access.");
    check(await db.from("profiles").update({ role }).eq("id", id));
    await revalidateApp();
    return null;
  });
}

export async function updateProjectTypeAction(input: unknown) {
  return runAction(projectTypeSchema, input, async ({ id, ...values }, { db }) => {
    const rows = must(await db.from("project_types").update(values).eq("id", id).select("id"));
    if (!rows.length) throw new AppError("Project type not found.");
    await revalidateApp();
    return null;
  });
}

export async function loadDemoDataAction() {
  return runAction(z.undefined().or(z.object({})), undefined, async (_v, { db, today }) => {
    const result = await loadDemoData(db, today);
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
