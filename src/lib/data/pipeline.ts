import { LEAD_STATUSES, type LeadStatus } from "@/lib/domain/constants";
import { planLeadStatusChange, StageChangeError } from "@/lib/domain/pipeline";
import { AppError, check, must } from "./errors";
import { logActivity } from "./activities";
import { applyTaskChanges, getOpenTasksForProspect } from "./tasks";
import { getProspectOrThrow } from "./prospects";
import { createOpportunity } from "./opportunities";
import type { Db } from "./types";

/**
 * Changes a prospect's lead status. The change itself is logged to the timeline
 * by a database trigger. Qualifying a lead with no opportunity creates one.
 */
export async function setLeadStatus(
  db: Db,
  input: { prospect_id: string; to: LeadStatus; lost_reason?: string | null },
  today: string,
) {
  const prospect = await getProspectOrThrow(db, input.prospect_id);
  if (prospect.archived_at) throw new AppError("This prospect is archived. Restore it first.");

  const [openTasks, opportunities] = await Promise.all([
    getOpenTasksForProspect(db, prospect.id),
    db.from("opportunities").select("id").eq("prospect_id", prospect.id).then((r) => must(r)),
  ]);

  let plan;
  try {
    plan = planLeadStatusChange({ from: prospect.stage, to: input.to, hasOpportunity: opportunities.length > 0, openTasks });
  } catch (e) {
    if (e instanceof StageChangeError) throw new AppError(e.message);
    throw e;
  }

  check(
    await db
      .from("prospects")
      .update({ stage: input.to, lost_reason: input.to === "lost" ? (input.lost_reason ?? prospect.lost_reason) : prospect.lost_reason })
      .eq("id", prospect.id),
  );
  if (input.to === "lost" && input.lost_reason) {
    await logActivity(db, { prospect_id: prospect.id, activity_type: "note", title: "Lost reason", details: input.lost_reason });
  }
  await applyTaskChanges(db, prospect.id, { cancel: plan.cancelTaskIds });

  if (plan.createOpportunity) {
    await createOpportunity(
      db,
      {
        prospect_id: prospect.id,
        title: prospect.potential_project_notes || `${prospect.business_name} — opportunity`,
        estimated_value: prospect.estimated_value === null ? null : String(prospect.estimated_value),
        project_type: prospect.potential_project as never,
        stageKey: "qualified",
      },
      today,
      { reason: `Created when the lead was marked ${LEAD_STATUSES.label(input.to)}.` },
    );
  }
  return { from: prospect.stage, to: input.to, createdOpportunity: plan.createOpportunity };
}
