"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/validation/common";

/**
 * Runs a server action, shows a toast on failure (and optionally on success),
 * and exposes pending state + field errors for forms.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    opts: { success?: string | ((data: T) => string | null); onSuccess?: (data: T) => void; onError?: (error: string) => void } = {},
  ) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          setFieldErrors({});
          const msg = typeof opts.success === "function" ? opts.success(result.data) : opts.success;
          if (msg) toast.success(msg);
          opts.onSuccess?.(result.data);
        } else {
          setFieldErrors(result.fieldErrors ?? {});
          toast.error(result.error);
          opts.onError?.(result.error);
        }
      } catch (e) {
        // redirects thrown by the server action propagate normally
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
        toast.error("Network error — please try again.");
      }
    });
  }

  return { pending, run, fieldErrors, setFieldErrors };
}
