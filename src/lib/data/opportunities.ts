import type { z } from "zod";
import type { opportunitySchema } from "@/lib/validation/schemas";
import { AppError, check, maybe, must } from "./errors";
import { logActivity } from "./activities";
import type { Db } from "./types";

export async function listOpportunities(db: Db, prospectId?: string) {
  let q = db
    .from("opportunities")
    .select("*, prospects(id, business_name, stage, archived_at)")
    .order("created_at", { ascending: false });
  if (prospectId) q = q.eq("prospect_id", prospectId);
  return must(await q);
}

export type OpportunityRow = Awaited<ReturnType<typeof listOpportunities>>[number];

export async function updateOpportunity(db: Db, values: z.output<typeof opportunitySchema>) {
  const existing = maybe(await db.from("opportunities").select("id, prospect_id, status").eq("id", values.id).maybeSingle());
  if (!existing) throw new AppError("Opportunity not found.");
  const { id, ...fields } = values;
  check(
    await db
      .from("opportunities")
      .update({
        ...fields,
        eligible_amount_received: fields.eligible_amount_received ?? "0",
        commission_paid: fields.commission_paid ?? "0",
        closed_at: fields.status === "open" ? null : undefined,
      })
      .eq("id", id),
  );
  await logActivity(db, {
    prospect_id: existing.prospect_id,
    activity_type: "opportunity",
    title: "Opportunity updated",
    details: fields.agreed_commission_pct ? `Agreed commission ${fields.agreed_commission_pct}%` : null,
  });
}
