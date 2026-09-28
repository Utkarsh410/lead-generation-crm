"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/env";

export type AuthState = { error?: string; message?: string };

const credentials = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  // only allow internal paths (prevents open redirects)
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!isEmailAllowed(parsed.data.email)) return { error: "This email is not allowed to use LeadOS." };

  const db = await createClient();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Invalid email or password." };
  redirect(safeNext(formData.get("next")));
}

const signUpSchema = credentials.extend({
  full_name: z.string().trim().min(1, "Enter your name").max(120),
});

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!isEmailAllowed(parsed.data.email)) return { error: "This email is not allowed to use LeadOS." };

  const db = await createClient();
  const { data, error } = await db.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name } },
  });
  if (error) return { error: error.message };
  if (!data.session) {
    return { message: "Account created. Check your email to confirm it, then sign in." };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/login");
}
