"use server";

import { z } from "zod";
import { revalidateApp, runAction } from "./run";
import { clientSchema, paymentSchema, paymentUpdateSchema, projectCreateSchema, projectUpdateSchema } from "@/lib/validation/schemas";
import { uuid } from "@/lib/validation/common";
import { addPayment, createClient, createProject, deletePayment, updateClient, updatePayment, updateProject } from "@/lib/data/clients";
import { check } from "@/lib/data/errors";

export async function createClientAction(input: unknown) {
  return runAction(clientSchema, input, async (values, { db }) => {
    const row = await createClient(db, values);
    await revalidateApp();
    return row;
  });
}

export async function updateClientAction(input: unknown) {
  return runAction(clientSchema.extend({ id: uuid }), input, async ({ id, ...values }, { db }) => {
    await updateClient(db, id, values);
    await revalidateApp();
    return null;
  });
}

export async function deleteClientAction(input: unknown) {
  return runAction(z.object({ id: uuid }), input, async ({ id }, { db }) => {
    check(await db.from("clients").delete().eq("id", id));
    await revalidateApp();
    return null;
  });
}

export async function createProjectAction(input: unknown) {
  return runAction(projectCreateSchema, input, async (values, { db }) => {
    const row = await createProject(db, values);
    await revalidateApp();
    return row;
  });
}

export async function updateProjectAction(input: unknown) {
  return runAction(projectUpdateSchema, input, async (values, { db }) => {
    await updateProject(db, values);
    await revalidateApp();
    return null;
  });
}

export async function addPaymentAction(input: unknown) {
  return runAction(paymentSchema, input, async (values, { db }) => {
    const row = await addPayment(db, values);
    await revalidateApp();
    return row;
  });
}

export async function updatePaymentAction(input: unknown) {
  return runAction(paymentUpdateSchema, input, async ({ id, ...values }, { db }) => {
    await updatePayment(db, id, values);
    await revalidateApp();
    return null;
  });
}

export async function deletePaymentAction(input: unknown) {
  return runAction(z.object({ id: uuid }), input, async ({ id }, { db }) => {
    await deletePayment(db, id);
    await revalidateApp();
    return null;
  });
}
