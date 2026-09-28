import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QualificationForm } from "@/components/qualification/qualification-form";
import { requireMember } from "@/lib/auth/session";
import { getProspect, listProspectOptions } from "@/lib/data/prospects";
import { latestQualification } from "@/lib/data/qualification";
import { notFound } from "next/navigation";
import { StageBadge } from "@/components/badges";

export const metadata: Metadata = { title: "Qualify lead" };

export default async function NewQualificationPage(props: PageProps<"/qualification/new">) {
  const { db } = await requireMember();
  const sp = await props.searchParams;
  const parsed = z.uuid().safeParse(sp.prospect);

  if (!parsed.success) {
    const options = await listProspectOptions(db);
    return (
      <>
        <PageHeader title="Qualify a lead" description="Choose the prospect you spoke with." />
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Prospects</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {options.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link className="font-medium hover:underline" href={`/qualification/new?prospect=${p.id}`}>
                    {p.business_name}
                  </Link>
                  <StageBadge stage={p.stage} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </>
    );
  }

  const prospect = await getProspect(db, parsed.data);
  if (!prospect) notFound();
  const previous = await latestQualification(db, prospect.id);

  return (
    <>
      <PageHeader
        title={`Qualify ${prospect.business_name}`}
        description={previous ? "Pre-filled from the previous assessment — update what changed." : "Capture what you learned in the conversation."}
      />
      <QualificationForm
        prospect={prospect}
        defaults={
          previous ?? {
            problem_description: prospect.observed_problem,
            project_type: prospect.potential_project,
            decision_maker_name: prospect.contact_name && prospect.job_title ? `${prospect.contact_name} (${prospect.job_title})` : null,
          }
        }
      />
    </>
  );
}
