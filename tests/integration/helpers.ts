// Integration tests run against a real Supabase API (local `supabase start`, or any
// test project) with the LeadOS migrations applied. They are skipped unless
// SUPABASE_TEST_URL and SUPABASE_TEST_ANON_KEY are set. Never point them at
// production: they create users and data.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "@/lib/supabase/database.types";
import type { Db } from "@/lib/supabase/types";

export const TEST_URL = process.env.SUPABASE_TEST_URL;
export const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
export const integrationEnabled = Boolean(TEST_URL && TEST_ANON_KEY);

/** Signs up a fresh user and returns a client bound to their session. */
export async function newUserClient(opts: { name?: string } = {}): Promise<{ db: Db; userId: string; email: string }> {
  const db = createClient<Database>(TEST_URL!, TEST_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `test-${randomUUID()}@example.com`;
  const { data, error } = await db.auth.signUp({
    email,
    password: "test-password-123",
    options: { data: { full_name: opts.name ?? "Test User" } },
  });
  if (error || !data.user || !data.session) {
    throw new Error(`Sign-up failed (is email auto-confirm enabled?): ${error?.message ?? "no session"}`);
  }
  return { db, userId: data.user.id, email };
}

/**
 * The first account in a project becomes admin; later ones are "pending".
 * Tests that need an approved user call this with an admin client.
 */
export async function approve(admin: Db, userId: string) {
  const { error } = await admin.from("profiles").update({ role: "member" }).eq("id", userId);
  if (error) throw new Error(`approve failed: ${error.message}`);
}

let adminPromise: Promise<{ db: Db; userId: string }> | null = null;

/**
 * An approved member. Uses SUPABASE_TEST_ADMIN_EMAIL/PASSWORD if the project
 * already has an admin; otherwise the first sign-up in a fresh project is admin.
 */
export async function adminClient(): Promise<{ db: Db; userId: string }> {
  adminPromise ??= (async () => {
    const email = process.env.SUPABASE_TEST_ADMIN_EMAIL;
    const password = process.env.SUPABASE_TEST_ADMIN_PASSWORD;
    if (email && password) {
      const db = createClient<Database>(TEST_URL!, TEST_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error(`admin sign-in failed: ${error?.message}`);
      return { db, userId: data.user.id };
    }
    const u = await newUserClient({ name: "Admin" });
    const { data } = await u.db.from("profiles").select("role").eq("id", u.userId).single();
    if (data?.role !== "admin") {
      throw new Error("Set SUPABASE_TEST_ADMIN_EMAIL/PASSWORD: the project already has an admin.");
    }
    return u;
  })();
  return adminPromise;
}

/** A fresh approved member (isolated data thanks to RLS). */
export async function memberClient(name = "Utkarsh") {
  const admin = await adminClient();
  const user = await newUserClient({ name });
  await approve(admin.db, user.userId);
  return user;
}

export const TODAY = "2026-09-28";
