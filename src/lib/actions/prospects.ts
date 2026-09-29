"use server";

import { z } from "zod";
import { revalidateApp, runAction } from "./run";
import {
  contactSchema,
  noteSchema,
  prospectCreateSchema,
  prospectSchema,
  recommendedServicesSchema,
} from "@/lib/validation/schemas";
import { optionalDate, uuid } from "@/lib/validation/common";
import { createProspect, saveRecommendedServices, setArchived, updateProspect } from "@/lib/data/prospects";
import { logActivity } from "@/lib/data/activities";
import { AppError, check } from "@/lib/data/errors";
import { getLookupOptions } from "@/lib/data/workspace";
import type { Db } from "@/lib/supabase/types";

/** Sources are built-in or user-defined; reject anything else. */
async function assertKnownSource(db: Db, source: string) {
  const { sources } = await getLookupOptions(db);
  if (!sources.some((s) => s.value === source)) throw new AppError("Unknown lead source — add it in Settings → Lookups first.");
}

const createInput = prospectCreateSchema.extend({ first_outreach_due: optionalDate });

export async function createProspectAction(input: unknown) {
  return runAction(createInput, input, async ({ confirm_duplicate, first_outreach_due, ...values }, { db, today, settings }) => {
    if (first_outreach_due && first_outreach_due < today) {
      throw new AppError("The first outreach date is in the past.");
    }
    await assertKnownSource(db, values.lead_source);
    const result = await createProspect(db, values, {
      confirmDuplicate: confirm_duplicate,
      firstOutreachDue: first_outreach_due,
      scoring: settings.scoring,
    });
    if (result.status === "saved") await revalidateApp();
    return result;
  });
}

const updateInput = prospectSchema.extend({ id: uuid, confirm_duplicate: z.boolean().optional().default(false) });

export async function updateProspectAction(input: unknown) {
  return runAction(updateInput, input, async ({ id, confirm_duplicate, ...values }, { db, settings }) => {
    await assertKnownSource(db, values.lead_source);
    const result = await updateProspect(db, id, values, { confirmDuplicate: confirm_duplicate, scoring: settings.scoring });
    if (result.status === "saved") await revalidateApp();
    return result;
  });
}

const archiveInput = z.object({ ids: z.array(uuid).min(1, "Select at least one prospect").max(500), archived: z.boolean() });

export async function setArchivedAction(input: unknown) {
  return runAction(archiveInput, input, async ({ ids, archived }, { db }) => {
    const count = await setArchived(db, ids, archived);
    await revalidateApp();
    return { count };
  });
}

export async function addNoteAction(input: unknown) {
  return runAction(noteSchema, input, async ({ prospect_id, details }, { db }) => {
    await logActivity(db, { prospect_id, activity_type: "note", title: "Note", details });
    await revalidateApp();
    return null;
  });
}

export async function addContactAction(input: unknown) {
  return runAction(contactSchema, input, async (values, { db }) => {
    check(await db.from("prospect_contacts").insert(values));
    await revalidateApp();
    return null;
  });
}

export async function deleteContactAction(input: unknown) {
  return runAction(z.object({ id: uuid, prospect_id: uuid }), input, async ({ id, prospect_id }, { db }) => {
    check(await db.from("prospect_contacts").delete().eq("id", id).eq("prospect_id", prospect_id));
    await revalidateApp();
    return null;
  });
}

export async function saveRecommendedServicesAction(input: unknown) {
  return runAction(recommendedServicesSchema, input, async ({ prospect_id, services }, { db }) => {
    await saveRecommendedServices(db, prospect_id, services);
    await revalidateApp();
    return null;
  });
}
