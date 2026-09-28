import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Db } from "@/lib/supabase/types";
import { isEmailAllowed } from "@/lib/env";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "member" | "pending";
};

export type MemberContext = {
  db: Db;
  userId: string;
  email: string | null;
  profile: Profile;
};

/** Current user + profile, or null. Cached per request. */
export const getSessionContext = cache(async (): Promise<(MemberContext & { approved: boolean }) | null> => {
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", data.user.id)
    .maybeSingle();
  const resolved: Profile = profile ?? {
    id: data.user.id,
    email: data.user.email ?? null,
    full_name: null,
    role: "pending",
  };
  const approved = resolved.role !== "pending" && isEmailAllowed(data.user.email);
  return { db, userId: data.user.id, email: data.user.email ?? null, profile: resolved, approved };
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
