import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { TemplateLibrary } from "@/components/outreach/template-library";
import { requireMember } from "@/lib/auth/session";
import { listTemplates } from "@/lib/data/outreach";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const { db } = await requireMember();
  const templates = await listTemplates(db);
  return (
    <>
      <PageHeader
        title="Outreach templates"
        description="Editable starting points by channel, prospect type and stage. Always personalise before sending."
      />
      <TemplateLibrary templates={templates} />
    </>
  );
}
