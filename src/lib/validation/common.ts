import { z } from "zod";
import { InvalidMoneyError, parseMoney } from "@/lib/domain/money";
import { isIsoDate } from "@/lib/domain/dates";

/** Optional free text: trimmed, "" → null, max length enforced. */
export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `Must be ${max} characters or fewer`);

export const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .optional()
  .nullable()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address");

/** Accepts "example.com" and adds https://. Only http(s) URLs are allowed. */
export const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const url = new URL(withProtocol);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      if (!url.hostname.includes(".")) throw new Error();
      return withProtocol;
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid website/profile URL" });
      return z.NEVER;
    }
  });

export const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\+?[\d\s\-()]+$/.test(v), "Use digits, spaces, +, - or ()")
  .refine((v) => {
    if (v === null) return true;
    const digits = v.replace(/\D/g, "").length;
    return digits >= 7 && digits <= 15;
  }, "Phone numbers need 7–15 digits");

/** Money input ("1.5L", "150000", "1,50,000") → "150000.00" | null. */
export const optionalMoney = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v, ctx) => {
    try {
      return parseMoney(v ?? null);
    } catch (e) {
      ctx.addIssue({
        code: "custom",
        message: e instanceof InvalidMoneyError ? e.message : "Invalid amount",
      });
      return z.NEVER;
    }
  });

export const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isIsoDate(v), "Enter a valid date");

export const requiredDate = z
  .string({ error: "Date is required" })
  .trim()
  .refine((v) => isIsoDate(v), "Enter a valid date");

export const optionalTime = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v), "Enter a valid time");

export const uuid = z.uuid("Invalid id");

/** "unknown" | "yes" | "no" → null | true | false (never assumed). */
export const triState = z
  .enum(["unknown", "yes", "no"])
  .optional()
  .nullable()
  .transform((v) => (v === "yes" ? true : v === "no" ? false : null));

export function triStateValue(v: boolean | null | undefined): "unknown" | "yes" | "no" {
  return v === true ? "yes" : v === false ? "no" : "unknown";
}

/** Nullable enum: "" / undefined → null. */
export const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v ? (v as T[number]) : null));

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function validationError(error: z.ZodError): { ok: false; error: string; fieldErrors: Record<string, string[]> } {
  const flat = z.flattenError(error);
  const fieldErrors = flat.fieldErrors as Record<string, string[]>;
  const first = flat.formErrors[0] ?? Object.values(fieldErrors).flat()[0] ?? "Invalid input";
  return { ok: false, error: first, fieldErrors };
}
