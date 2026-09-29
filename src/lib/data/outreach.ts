import { OUTREACH_CHANNELS, OUTREACH_STAGES, RESPONSE_STATUSES, type OutreachChannel, type OutreachStage, type ResponseStatus } from "@/lib/domain/constants";
import { FollowUpRuleError, planAfterOutreachSent, planAfterResponse, type FollowUpDelays } from "@/lib/domain/follow-ups";
import { findPlaceholders } from "@/lib/domain/templates";
import { dateInTimezone } from "@/lib/domain/dates";
import { AppError, check, maybe, must } from "./errors";
import { logActivity } from "./activities";
import { applyTaskChanges, getOpenTasksForProspect } from "./tasks";
import { getProspectOrThrow } from "./prospects";
import type { Db } from "./types";

/** Stores sent_date (a calendar day) as a timestamp: now if today, else midday UTC that day. */
/**
 * Timestamp for a message sent on `sentDate` (the user's calendar date): "now"
 * when that is today in their timezone, otherwise noon UTC — which falls on the
 * same calendar date in every common timezone.
 */
function sentTimestamp(sentDate: string, timezone: string | undefined): string {
  const now = new Date();
  if (dateInTimezone(now, timezone) === sentDate) return now.toISOString();
  return new Date(`${sentDate}T12:00:00Z`).toISOString();
}

export async function recordOutreach(
  db: Db,
  input: {
    prospect_id: string;
    template_id: string | null;
    channel: OutreachChannel;
    outreach_stage: OutreachStage;
    subject: string | null;
    customized_message: string;
    sent_date: string;
    notes: string | null;
    allow_placeholders: boolean;
  },
  today: string,
  opts: { delays?: FollowUpDelays; timezone?: string } = {},
) {
  if (input.sent_date > today) throw new AppError("Only record messages you have already sent (the date is in the future).");
  const placeholders = findPlaceholders(input.customized_message);
  if (placeholders.length && !input.allow_placeholders) {
    throw new AppError(`The message still contains ${placeholders.map((p) => `{{${p}}}`).join(", ")}. Fill them in before recording it as sent.`);
  }

  const prospect = await getProspectOrThrow(db, input.prospect_id);
  if (prospect.archived_at) throw new AppError("This prospect is archived. Restore it before recording outreach.");

  const message = must(
    await db
      .from("outreach_messages")
      .insert({
        prospect_id: input.prospect_id,
        template_id: input.template_id,
        channel: input.channel,
        outreach_stage: input.outreach_stage,
        subject: input.subject,
        customized_message: input.customized_message,
        sent_at: sentTimestamp(input.sent_date, opts.timezone),
        notes: input.notes,
      })
      .select("id, sent_at")
      .single(),
  );

  await logActivity(db, {
    prospect_id: prospect.id,
    activity_type: "outreach_sent",
    title: `${OUTREACH_CHANNELS.label(input.channel)} — ${OUTREACH_STAGES.label(input.outreach_stage)} sent`,
    details: input.customized_message.length > 280 ? `${input.customized_message.slice(0, 277)}…` : input.customized_message,
    metadata: { message_id: message.id, channel: input.channel, outreach_stage: input.outreach_stage },
    occurred_at: message.sent_at,
  });

  const plan = planAfterOutreachSent({
    outreachStage: input.outreach_stage,
    sentDate: input.sent_date,
    businessName: prospect.business_name,
    prospectStage: prospect.stage,
    openTasks: await getOpenTasksForProspect(db, prospect.id),
    delays: opts.delays,
  });
  if (plan.stage) check(await db.from("prospects").update({ stage: plan.stage }).eq("id", prospect.id));
  const applied = await applyTaskChanges(db, prospect.id, { ...plan, outreachMessageId: message.id });
  return { messageId: message.id, followUp: plan.create[0] ?? null, stage: plan.stage, ...applied };
}

export async function recordResponse(
  db: Db,
  input: {
    message_id: string;
    response_status: ResponseStatus;
    response_date: string;
    response_notes: string | null;
    follow_up_date: string | null;
  },
  today: string,
  opts: { timezone?: string } = {},
) {
  if (input.response_date > today) throw new AppError("The response date can't be in the future.");
  const message = maybe(
    await db.from("outreach_messages").select("id, prospect_id, sent_at").eq("id", input.message_id).maybeSingle(),
  );
  if (!message) throw new AppError("Outreach message not found.");
  if (input.response_date < dateInTimezone(message.sent_at, opts.timezone)) {
    throw new AppError("The response date is before the message was sent.");
  }
  const prospect = await getProspectOrThrow(db, message.prospect_id);

  let plan;
  try {
    plan = planAfterResponse({
      status: input.response_status,
      today,
      businessName: prospect.business_name,
      prospectStage: prospect.stage,
      openTasks: await getOpenTasksForProspect(db, prospect.id),
      followUpDate: input.follow_up_date,
    });
  } catch (e) {
    if (e instanceof FollowUpRuleError) throw new AppError(e.message);
    throw e;
  }

  const isResponse = !["sent", "delivered", "no_response"].includes(input.response_status);
  check(
    await db
      .from("outreach_messages")
      .update({
        response_status: input.response_status,
        response_date: isResponse ? new Date(`${input.response_date}T12:00:00Z`).toISOString() : null,
        response_notes: input.response_notes,
      })
      .eq("id", message.id),
  );
  await logActivity(db, {
    prospect_id: prospect.id,
    activity_type: "response_recorded",
    title: `Response: ${RESPONSE_STATUSES.label(input.response_status)}`,
    details: input.response_notes,
    metadata: { message_id: message.id, response_status: input.response_status },
  });
  if (plan.stage) check(await db.from("prospects").update({ stage: plan.stage }).eq("id", prospect.id));
  const applied = await applyTaskChanges(db, prospect.id, plan);
  return { prospectId: prospect.id, stage: plan.stage, ...applied };
}

export const MESSAGE_LIST_SELECT =
  "id, prospect_id, template_id, channel, outreach_stage, subject, customized_message, sent_at, response_status, response_date, response_notes, notes, prospects(id, business_name, contact_name, archived_at)";

export async function listMessages(
  db: Db,
  opts: { prospectId?: string; responseStatus?: ResponseStatus; channel?: OutreachChannel; limit?: number } = {},
) {
  let q = db.from("outreach_messages").select(MESSAGE_LIST_SELECT).order("sent_at", { ascending: false }).limit(opts.limit ?? 200);
  if (opts.prospectId) q = q.eq("prospect_id", opts.prospectId);
  if (opts.responseStatus) q = q.eq("response_status", opts.responseStatus);
  if (opts.channel) q = q.eq("channel", opts.channel);
  return must(await q);
}

export type MessageListItem = Awaited<ReturnType<typeof listMessages>>[number];

export async function listTemplates(db: Db, opts: { activeOnly?: boolean } = {}) {
  let q = db.from("outreach_templates").select("*").order("outreach_stage").order("name");
  if (opts.activeOnly) q = q.eq("is_active", true);
  return must(await q);
}

export type TemplateRow = Awaited<ReturnType<typeof listTemplates>>[number];
