import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { ProspectForm } from "@/components/prospects/prospect-form";
import { requireMember, todayFor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New prospect" };

export default async function NewProspectPage() {
  const { settings } = await requireMember();
  return (
    <>
      <PageHeader title="New prospect" description="Record who they are, where you found them and what they might need." />
      <ProspectForm mode="create" today={todayFor(settings)} scoring={settings.scoring} />
    </>
  );
}
