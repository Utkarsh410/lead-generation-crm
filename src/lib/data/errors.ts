import type { PostgrestError } from "@supabase/supabase-js";

/** Error whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function dbError(error: PostgrestError, fallback = "Something went wrong while saving."): AppError {
  // server-side log with details (never shown to the user)
  console.error("[db]", error.code, error.message, error.details ?? "");
  // RLS / permissions
  if (error.code === "42501") return new AppError("You don't have permission to do that.", error.code);
  // check / not-null / FK violations → validation problem
  if (error.code === "23514" || error.code === "23502") return new AppError("Some values are invalid.", error.code);
  if (error.code === "23503") return new AppError("A related record no longer exists.", error.code);
  if (error.code === "PGRST116") return new AppError("Record not found.", error.code);
  return new AppError(fallback, error.code);
}

type Result = { data: unknown; error: PostgrestError | null };

/** Throws on a Supabase error (for writes that return no data). */
export function check(result: { error: PostgrestError | null }, fallback?: string): void {
  if (result.error) throw dbError(result.error, fallback);
}

/** Throws on error or missing data; returns the (non-null) data. */
export function must<R extends Result>(result: R, fallback?: string): NonNullable<R["data"]> {
  if (result.error) throw dbError(result.error, fallback);
  if (result.data === null) throw new AppError("Record not found.");
  return result.data as NonNullable<R["data"]>;
}

/** Throws on error; returns data or null (use with maybeSingle()). */
export function maybe<R extends Result>(result: R, fallback?: string): R["data"] | null {
  if (result.error) throw dbError(result.error, fallback);
  return result.data;
}

/** Quotes a value for PostgREST `or()` / filter strings. */
export function pgrstQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Sanitises free-text search for an ilike pattern. */
export function searchPattern(q: string): string {
  return pgrstQuote(`*${q.replace(/[*%_]/g, " ").trim()}*`);
}
