import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Db } from "@/lib/supabase/types";
import { isEmailAllowed } from "@/lib/env";
import { appTimezone, todayInTimezone } from "@/lib/domain/dates";
import { normalizeScoringConfig, type ScoringConfig } from "@/lib/domain/opportunity-score";
import type { FollowUpDelays } from "@/lib/domain/follow-ups";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "member" | "pending";
  phone: string | null;
  website: string | null;
  linkedin_url: string | null;
  business_name: string | null;
  business_description: string | null;
  business_website: string | null;
  currency: string;
  timezone: string | null;
  follow_up_1_days: number;
  follow_up_2_days: number;
  score_weights: unknown;
};

/** Per-user preferences resolved with defaults. */
export type UserSettings = {
  currency: string;
  timezone: string;
  delays: FollowUpDelays;
  scoring: ScoringConfig;
  myName: string;
  myBusiness: string;
};

export type MemberContext = {
  db: Db;
  userId: string;
  email: string | null;
  profile: Profile;
  settings: UserSettings;
};

const PROFILE_COLUMNS =
  "id, email, full_name, role, phone, website, linkedin_url, business_name, business_description, business_website, currency, timezone, follow_up_1_days, follow_up_2_days, score_weights";

export function resolveSettings(profile: Profile): UserSettings {
  return {
    currency: profile.currency || "INR",
    timezone: profile.timezone || appTimezone(),
    delays: { followUp1: profile.follow_up_1_days ?? 3, followUp2: profile.follow_up_2_days ?? 5 },
    scoring: normalizeScoringConfig(profile.score_weights),
    myName: displayName(profile),
    myBusiness: profile.business_name ?? "",
  };
}

/** "Today" (YYYY-MM-DD) in the user's timezone. */
export function todayFor(settings: Pick<UserSettings, "timezone">): string {
  return todayInTimezone(settings.timezone);
}

/** Current user + profile, or null. Cached per request. */
export const getSessionContext = cache(async (): Promise<(MemberContext & { approved: boolean }) | null> => {
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await db
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", data.user.id)
    .maybeSingle();
  const resolved: Profile = (profile as Profile | null) ?? {
    id: data.user.id,
    email: data.user.email ?? null,
    full_name: null,
    role: "pending",
    phone: null,
    website: null,
    linkedin_url: null,
    business_name: null,
    business_description: null,
    business_website: null,
    currency: "INR",
    timezone: null,
    follow_up_1_days: 3,
    follow_up_2_days: 5,
    score_weights: null,
  };
  const approved = resolved.role !== "pending" && isEmailAllowed(data.user.email);
  return {
    db,
    userId: data.user.id,
    email: data.user.email ?? null,
    profile: resolved,
    settings: resolveSettings(resolved),
    approved,
  };
});

/** Use in every protected page and server action. */
export async function requireMember(): Promise<MemberContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.approved) redirect("/pending");
  return ctx;
}

export function displayName(profile: Pick<Profile, "full_name" | "email">): string {
  return profile.full_name?.trim() || profile.email?.split("@")[0] || "LeadOS user";
}
