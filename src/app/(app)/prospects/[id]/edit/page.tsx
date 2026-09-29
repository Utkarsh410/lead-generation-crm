import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { ProspectForm } from "@/components/prospects/prospect-form";
import { requireMember, todayFor } from "@/lib/auth/session";
import { getProspect } from "@/lib/data/prospects";
import { prospectToFormValues } from "@/lib/validation/form-values";
import { z } from "zod";

export const metadata: Metadata = { title: "Edit prospect" };

export default async function EditProspectPage(props: PageProps<"/prospects/[id]/edit">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, settings } = await requireMember();
  const prospect = await getProspect(db, id);
  if (!prospect) notFound();
  return (
    <>
      <PageHeader title={`Edit ${prospect.business_name}`} />
      <ProspectForm mode="edit" id={prospect.id} defaults={prospectToFormValues(prospect)} today={todayFor(settings)} scoring={settings.scoring} />
    </>
  );
}
