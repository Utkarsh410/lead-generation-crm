import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** A Supabase client typed with the LeadOS schema (server session or test client). */
export type Db = SupabaseClient<Database>;

export type { Database, Tables, TablesInsert, TablesUpdate } from "./database.types";
