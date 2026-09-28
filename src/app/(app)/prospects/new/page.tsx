import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { ProspectForm } from "@/components/prospects/prospect-form";
import { requireMember } from "@/lib/auth/session";
import { todayInTimezone } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "New prospect" };

export default async function NewProspectPage() {
  await requireMember();
  return (
    <>
      <PageHeader title="New prospect" description="Record who they are, where you found them and why they might need development." />
      <ProspectForm mode="create" today={todayInTimezone()} />
    </>
  );
}
