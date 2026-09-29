import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { CsvImport } from "@/components/prospects/csv-import";
import { requireMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Import prospects" };

export default async function ImportProspectsPage() {
  await requireMember();
  return (
    <>
      <PageHeader title="Import prospects" description="Upload a CSV, check it, then confirm. Nothing is imported until you click Import." />
      <CsvImport />
    </>
  );
}
