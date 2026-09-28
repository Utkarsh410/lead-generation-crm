import { QUALIFICATION_CLASSES, type QualificationClass } from "@/lib/domain/constants";
import { assessQualification, isQualifiedClass } from "@/lib/domain/qualification";
import { stageIndex } from "@/lib/domain/follow-ups";
import type { z } from "zod";
import type { qualificationSchema } from "@/lib/validation/schemas";
import { AppError, check, maybe, must } from "./errors";
import { logActivity } from "./activities";
import { changeStage } from "./pipeline";
import { getProspectOrThrow } from "./prospects";
import type { Db } from "./types";

export type QualificationValues = z.output<typeof qualificationSchema>;

export async function saveQualification(db: Db, values: QualificationValues, today: string) {
  const prospect = await getProspectOrThrow(db, values.prospect_id);
  if (prospect.archived_at) throw new AppError("This prospect is archived. Restore it first.");

  const { score, suggested } = assessQualification(values);
  const classification: QualificationClass = values.classification ?? suggested;
  const { advance_stage, ...fields } = values;

  const row = must(
    await db
      .from("qualification_assessments")
      .insert({ ...fields, score, suggested_classification: suggested, classification })
      .select("id")
      .single(),
  );

  await logActivity(db, {
    prospect_id: prospect.id,
    activity_type: "qualification",
    title: `Qualification: ${QUALIFICATION_CLASSES.label(classification)} (${score}/100)`,
    details:
      classification !== suggested
        ? `Score suggested ${QUALIFICATION_CLASSES.label(suggested)}; classified as ${QUALIFICATION_CLASSES.label(classification)} by judgement.`
        : null,
    metadata: { qualification_id: row.id, score, classification },
  });

  // complete any open "Qualification" reminders for this prospect
  check(
    await db
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("prospect_id", prospect.id)
      .eq("task_type", "qualification")
      .in("status", ["pending", "snoozed"]),
  );

  let movedTo: string | null = null;
  if (
    advance_stage &&
    isQualifiedClass(classification) &&
    prospect.stage !== "lost" &&
    stageIndex(prospect.stage) < stageIndex("qualified")
  ) {
    await changeStage(db, { prospect_id: prospect.id, to: "qualified" }, today);
    movedTo = "qualified";
  }
  return { id: row.id, score, classification, suggested, movedTo };
}

export async function latestQualification(db: Db, prospectId: string) {
  return maybe(
    await db
      .from("qualification_assessments")
      .select("*")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

export type QualificationRow = NonNullable<Awaited<ReturnType<typeof latestQualification>>>;

export async function listQualifications(db: Db) {
  return must(
    await db
      .from("qualification_assessments")
      .select("id, prospect_id, score, classification, suggested_classification, project_type, budget_min, budget_max, urgency, created_at, prospects(id, business_name, stage, archived_at)")
      .order("created_at", { ascending: false })
      .limit(200),
  );
}
