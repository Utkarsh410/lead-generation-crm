import { PIPELINE_STAGES, type PipelineStage } from "@/lib/domain/constants";
import { planStageChange, StageChangeError } from "@/lib/domain/pipeline";
import { AppError, check, must } from "./errors";
import { logActivity } from "./activities";
import { applyTaskChanges, getOpenTasksForProspect } from "./tasks";
import { getProspectOrThrow } from "./prospects";
import type { Db } from "./types";

/**
 * Moves a prospect to another stage and applies the side effects. The stage-change
 * activity itself is written by the database trigger.
 */
export async function changeStage(
  db: Db,
  input: {
    prospect_id: string;
    to: PipelineStage;
    discovery_call_date?: string | null;
    discovery_call_time?: string | null;
    lost_reason?: string | null;
  },
  today: string,
) {
  const prospect = await getProspectOrThrow(db, input.prospect_id);
  if (prospect.archived_at) throw new AppError("This prospect is archived. Restore it first.");

  const [openTasks, opportunities] = await Promise.all([
    getOpenTasksForProspect(db, prospect.id),
    db.from("opportunities").select("id, status").eq("prospect_id", prospect.id).then((r) => must(r)),
  ]);

  let plan;
  try {
    plan = planStageChange({
      from: prospect.stage,
      to: input.to,
      businessName: prospect.business_name,
      today,
      hasOpportunity: opportunities.length > 0,
      openTasks,
      discoveryCall: input.discovery_call_date
        ? { date: input.discovery_call_date, time: input.discovery_call_time ?? null }
        : null,
      lostReason: input.lost_reason,
    });
  } catch (e) {
    if (e instanceof StageChangeError) throw new AppError(e.message);
    throw e;
  }

  check(
    await db
      .from("prospects")
      .update({
        stage: input.to,
        lost_reason: input.to === "lost" ? (input.lost_reason ?? prospect.lost_reason) : prospect.lost_reason,
      })
      .eq("id", prospect.id),
  );

  if (input.to === "lost" && input.lost_reason) {
    await logActivity(db, { prospect_id: prospect.id, activity_type: "note", title: "Lost reason", details: input.lost_reason });
  }

  await applyTaskChanges(db, prospect.id, { create: plan.createTasks, cancel: plan.cancelTaskIds });

  if (plan.createOpportunity) {
    check(
      await db.from("opportunities").insert({
        prospect_id: prospect.id,
        title: `${prospect.business_name} — ${prospect.potential_project_notes || "Project"}`.slice(0, 200),
        project_type: prospect.potential_project,
        estimated_value: prospect.estimated_value,
      }),
    );
    await logActivity(db, {
      prospect_id: prospect.id,
      activity_type: "opportunity",
      title: "Opportunity created",
      details: `Created when the prospect reached ${PIPELINE_STAGES.label(input.to)}.`,
    });
  }
  if (plan.opportunityStatus) {
    const closing = plan.opportunityStatus !== "open";
    check(
      await db
        .from("opportunities")
        .update({ status: plan.opportunityStatus, closed_at: closing ? new Date().toISOString() : null })
        .eq("prospect_id", prospect.id)
        .eq("status", closing ? "open" : prospect.stage === "won" ? "won" : "lost"),
    );
  }
  return { from: prospect.stage, to: input.to };
}
