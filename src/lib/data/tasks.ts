import { TASK_TYPES, type TaskPriority, type TaskStatus, type TaskType } from "@/lib/domain/constants";
import type { OpenTask, TaskDraft } from "@/lib/domain/follow-ups";
import { addDays } from "@/lib/domain/dates";
import { AppError, check, maybe, must } from "./errors";
import { logActivity } from "./activities";
import type { Db } from "./types";

export const TASK_LIST_SELECT =
  "id, prospect_id, task_type, title, due_date, due_time, priority, status, notes, is_automated, sequence_step, completed_at, created_at, prospects(id, business_name, contact_name, stage, archived_at, last_contacted_at, last_activity_at)";

export async function getOpenTasksForProspect(db: Db, prospectId: string): Promise<OpenTask[]> {
  return must(
    await db
      .from("tasks")
      .select("id, task_type, status, is_automated, sequence_step")
      .eq("prospect_id", prospectId)
      .in("status", ["pending", "snoozed"]),
  );
}

/** Applies a follow-up/stage plan: creates, completes and cancels tasks and logs it. */
export async function applyTaskChanges(
  db: Db,
  prospectId: string,
  changes: { create?: TaskDraft[]; complete?: string[]; cancel?: string[]; outreachMessageId?: string | null },
): Promise<{ created: number; completed: number; cancelled: number }> {
  const now = new Date().toISOString();
  const create = changes.create ?? [];
  const complete = [...new Set(changes.complete ?? [])];
  const cancel = [...new Set(changes.cancel ?? [])].filter((id) => !complete.includes(id));

  if (complete.length) {
    check(
      await db
        .from("tasks")
        .update({ status: "completed", completed_at: now })
        .in("id", complete)
        .eq("prospect_id", prospectId)
        .in("status", ["pending", "snoozed"]),
    );
  }
  if (cancel.length) {
    check(
      await db
        .from("tasks")
        .update({ status: "cancelled" })
        .in("id", cancel)
        .eq("prospect_id", prospectId)
        .in("status", ["pending", "snoozed"]),
    );
    await logActivity(db, {
      prospect_id: prospectId,
      activity_type: "task_cancelled",
      title: cancel.length === 1 ? "Automated follow-up cancelled" : `${cancel.length} automated follow-ups cancelled`,
      metadata: { task_ids: cancel },
    });
  }
  if (create.length) {
    check(
      await db.from("tasks").insert(
        create.map((t) => ({
          prospect_id: prospectId,
          task_type: t.task_type,
          title: t.title,
          due_date: t.due_date,
          due_time: t.due_time ?? null,
          priority: t.priority,
          notes: t.notes ?? null,
          is_automated: t.is_automated,
          sequence_step: t.sequence_step ?? null,
          outreach_message_id: changes.outreachMessageId ?? null,
        })),
        { defaultToNull: false },
      ),
    );
    for (const t of create) {
      await logActivity(db, {
        prospect_id: prospectId,
        activity_type: "task_created",
        title: `Reminder: ${t.title}`,
        details: `Due ${t.due_date}${t.due_time ? ` at ${t.due_time.slice(0, 5)}` : ""}`,
        metadata: { task_type: t.task_type, automated: t.is_automated },
      });
    }
  }
  return { created: create.length, completed: complete.length, cancelled: cancel.length };
}

export async function createTask(
  db: Db,
  input: {
    prospect_id: string | null;
    task_type: TaskType;
    title: string;
    due_date: string;
    due_time: string | null;
    priority: TaskPriority;
    notes: string | null;
  },
  today: string,
) {
  if (input.due_date < today) throw new AppError("The due date is in the past. Pick today or a future date.");
  if (input.prospect_id) {
    const prospect = maybe(
      await db.from("prospects").select("id, archived_at").eq("id", input.prospect_id).maybeSingle(),
    );
    if (!prospect) throw new AppError("Prospect not found.");
    if (prospect.archived_at) throw new AppError("This prospect is archived. Restore it before adding follow-ups.");
  }
  const task = must(await db.from("tasks").insert(input).select("id").single());
  if (input.prospect_id) {
    await logActivity(db, {
      prospect_id: input.prospect_id,
      activity_type: "task_created",
      title: `${TASK_TYPES.label(input.task_type)}: ${input.title}`,
      details: `Due ${input.due_date}`,
    });
  }
  return task;
}

async function getTask(db: Db, id: string) {
  const task = maybe(await db.from("tasks").select("id, prospect_id, title, status, due_date").eq("id", id).maybeSingle());
  if (!task) throw new AppError("Task not found.");
  return task;
}

export async function setTaskStatus(db: Db, id: string, status: TaskStatus) {
  const task = await getTask(db, id);
  check(
    await db
      .from("tasks")
      .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
      .eq("id", id),
  );
  if (task.prospect_id && task.status !== status && (status === "completed" || status === "cancelled")) {
    await logActivity(db, {
      prospect_id: task.prospect_id,
      activity_type: status === "completed" ? "task_completed" : "task_cancelled",
      title: `${status === "completed" ? "Completed" : "Cancelled"}: ${task.title}`,
    });
  }
}

export async function rescheduleTask(db: Db, id: string, dueDate: string, today: string, snooze: boolean) {
  if (dueDate < today) throw new AppError("You can't reschedule into the past.");
  const task = await getTask(db, id);
  if (task.status === "completed" || task.status === "cancelled") {
    throw new AppError("Only open tasks can be rescheduled.");
  }
  check(await db.from("tasks").update({ due_date: dueDate, status: snooze ? "snoozed" : "pending" }).eq("id", id));
  if (task.prospect_id) {
    await logActivity(db, {
      prospect_id: task.prospect_id,
      activity_type: "task_rescheduled",
      title: `${snooze ? "Snoozed" : "Rescheduled"}: ${task.title}`,
      details: `${task.due_date} → ${dueDate}`,
    });
  }
}

export function quickRescheduleOptions(today: string) {
  return [
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: "In 3 days", date: addDays(today, 3) },
    { label: "Next week", date: addDays(today, 7) },
  ];
}

/** Open tasks (pending/snoozed) of non-archived prospects, optionally due on or before a date. */
export async function listOpenTasks(db: Db, opts: { dueOnOrBefore?: string; limit?: number } = {}) {
  let query = db
    .from("tasks")
    .select(TASK_LIST_SELECT)
    .in("status", ["pending", "snoozed"])
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 500);
  if (opts.dueOnOrBefore) query = query.lte("due_date", opts.dueOnOrBefore);
  const rows = must(await query);
  return rows.filter((t) => !t.prospects || !t.prospects.archived_at);
}

export type TaskListItem = Awaited<ReturnType<typeof listOpenTasks>>[number];
