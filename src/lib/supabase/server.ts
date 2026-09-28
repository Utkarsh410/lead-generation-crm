import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/env";
import type { Database } from "./database.types";
import type { Db } from "./types";

/** Supabase client bound to the signed-in user's session (RLS applies). */
export async function createClient(): Promise<Db> {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component — the proxy refreshes the session instead.
        }
      },
    },
  });
}
