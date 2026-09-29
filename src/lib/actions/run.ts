import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireMember, todayFor, type MemberContext } from "@/lib/auth/session";
import { AppError } from "@/lib/data/errors";
import { validationError, type ActionResult } from "@/lib/validation/common";

export type ActionContext = MemberContext & { today: string };

/**
 * Standard server-action pipeline: authenticate (approved member) → validate
 * with Zod → run → map known errors to user-facing messages.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (values: z.output<S>, ctx: ActionContext) => Promise<T>,
): Promise<ActionResult<T>> {
  const member = await requireMember(); // redirects if signed out / not approved
  const parsed = schema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const data = await fn(parsed.data, { ...member, today: todayFor(member.settings) });
    return { ok: true, data };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    console.error("[action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** All pages are per-user and dynamic; after any mutation refresh the whole app tree. */
export async function revalidateApp() {
  revalidatePath("/", "layout");
}
