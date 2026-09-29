"use server";

import { z } from "zod";
import { revalidateApp, runAction } from "./run";
import { importCommitSchema } from "@/lib/validation/schemas";
import { importProspects, matchExistingProspects } from "@/lib/data/import";
import { getLookupOptions } from "@/lib/data/workspace";
import { computeDuplicateKeys } from "@/lib/domain/duplicates";

const previewSchema = z.object({
  rows: z
    .array(
      z.object({
        business_name: z.string().max(300).optional(),
        website: z.string().max(500).optional(),
        email: z.string().max(300).optional(),
        phone: z.string().max(60).optional(),
        location: z.string().max(200).optional(),
      }),
    )
    .max(1000, "Import at most 1,000 rows at a time"),
});

/** Checks prepared rows against existing prospects (by domain, email, phone, name+location). */
export async function checkImportDuplicatesAction(input: unknown) {
  return runAction(previewSchema, input, async ({ rows }, { db }) => {
    return matchExistingProspects(db, rows.map((r) => computeDuplicateKeys(r)));
  });
}

export async function importProspectsAction(input: unknown) {
  return runAction(importCommitSchema, input, async ({ rows }, { db, settings }) => {
    const { sources } = await getLookupOptions(db);
    const result = await importProspects(db, rows, { allowedSources: new Set(sources.map((s) => s.value)), scoring: settings.scoring });
    await revalidateApp();
    return result;
  });
}
