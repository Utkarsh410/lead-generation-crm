"use server";

import { revalidateApp, runAction } from "./run";
import { rescheduleSchema, taskSchema, taskStatusSchema } from "@/lib/validation/schemas";
import { createTask, rescheduleTask, setTaskStatus } from "@/lib/data/tasks";


export async function createTaskAction(input: unknown) {
  return runAction(taskSchema, input, async (values, { db, today }) => {
    const task = await createTask(db, { ...values, prospect_id: values.prospect_id ?? null }, today);
    await revalidateApp();
    return task;
  });
}

export async function setTaskStatusAction(input: unknown) {
  return runAction(taskStatusSchema, input, async ({ id, status }, { db }) => {
    await setTaskStatus(db, id, status);
    await revalidateApp();
    return null;
  });
}

export async function rescheduleTaskAction(input: unknown) {
  return runAction(rescheduleSchema, input, async ({ id, due_date, snooze }, { db, today }) => {
    await rescheduleTask(db, id, due_date, today, snooze);
    await revalidateApp();
    return null;
  });
}
