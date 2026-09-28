import { generateHandoff } from "@/lib/domain/handoff";
import type { HandoffStatus } from "@/lib/domain/constants";
import { AppError, check, maybe, must } from "./errors";
import { logActivity } from "./activities";
import { getProspectOrThrow } from "./prospects";
import { latestQualification } from "./qualification";
import type { Db, Json } from "./types";

export async function createHandoff(
  db: Db,
  input: { prospect_id: string; notes: string | null },
  ctx: { generatedBy: string; today: string },
) {
  const prospect = await getProspectOrThrow(db, input.prospect_id);
  if (prospect.archived_at) throw new AppError("This prospect is archived. Restore it first.");
  const qualification = await latestQualification(db, prospect.id);
  const result = generateHandoff({
    prospect,
    qualification,
    generatedBy: ctx.generatedBy,
    generatedOn: ctx.today,
    notes: input.notes,
  });
  const row = must(
    await db
      .from("handoffs")
      .insert({
        prospect_id: prospect.id,
        qualification_id: qualification?.id ?? null,
        summary_markdown: result.markdown,
        snapshot: { ...result.snapshot, _gaps: result.gaps } as unknown as Json,
        notes: input.notes,
      })
      .select("id")
      .single(),
  );
  await logActivity(db, {
    prospect_id: prospect.id,
    activity_type: "handoff",
    title: "Handoff prepared",
    details: result.gaps.length ? `Still to confirm: ${result.gaps.join(", ")}` : null,
    metadata: { handoff_id: row.id },
  });
  check(
    await db
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("prospect_id", prospect.id)
      .eq("task_type", "handoff")
      .in("status", ["pending", "snoozed"]),
  );
  return { id: row.id, gaps: result.gaps };
}

export async function updateHandoff(
  db: Db,
  input: { id: string; summary_markdown: string; status: HandoffStatus; notes: string | null },
) {
  const existing = maybe(await db.from("handoffs").select("id, prospect_id, status, sent_at").eq("id", input.id).maybeSingle());
  if (!existing) throw new AppError("Handoff not found.");
  check(
    await db
      .from("handoffs")
      .update({
        summary_markdown: input.summary_markdown,
        status: input.status,
        notes: input.notes,
        sent_at: input.status !== "draft" ? (existing.sent_at ?? new Date().toISOString()) : null,
      })
      .eq("id", input.id),
  );
  if (existing.status !== input.status) {
    await logActivity(db, {
      prospect_id: existing.prospect_id,
      activity_type: "handoff",
      title: `Handoff marked ${input.status === "sent" ? "sent to BharatCoder" : input.status}`,
      metadata: { handoff_id: input.id },
    });
  }
}

export async function listHandoffs(db: Db, prospectId?: string) {
  let q = db
    .from("handoffs")
    .select("id, prospect_id, status, summary_markdown, snapshot, sent_at, notes, created_at, updated_at, prospects(id, business_name, stage, archived_at)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (prospectId) q = q.eq("prospect_id", prospectId);
  return must(await q);
}

export async function getHandoff(db: Db, id: string) {
  return maybe(
    await db
      .from("handoffs")
      .select("id, prospect_id, status, summary_markdown, snapshot, sent_at, notes, created_at, updated_at, prospects(id, business_name, stage)")
      .eq("id", id)
      .maybeSingle(),
  );
}
