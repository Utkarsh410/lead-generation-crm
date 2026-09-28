import type { ActivityType } from "@/lib/domain/constants";
import type { Db, Json } from "./types";
import { check, must } from "./errors";

export async function logActivity(
  db: Db,
  a: { prospect_id: string; activity_type: ActivityType; title: string; details?: string | null; metadata?: Json; occurred_at?: string },
) {
  check(
    await db.from("activities").insert({
      prospect_id: a.prospect_id,
      activity_type: a.activity_type,
      title: a.title,
      details: a.details ?? null,
      metadata: a.metadata ?? {},
      occurred_at: a.occurred_at,
    }),
  );
}

export async function listActivities(db: Db, prospectId: string, limit = 100) {
  return must(
    await db
      .from("activities")
      .select("id, activity_type, title, details, metadata, occurred_at")
      .eq("prospect_id", prospectId)
      .order("occurred_at", { ascending: false })
      .limit(limit),
  );
}
