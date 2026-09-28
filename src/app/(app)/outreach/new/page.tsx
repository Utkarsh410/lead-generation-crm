import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/ui/misc";
import { OutreachComposer } from "@/components/outreach/composer";
import { requireMember } from "@/lib/auth/session";
import { listTemplates } from "@/lib/data/outreach";
import { listProspectOptions } from "@/lib/data/prospects";
import { maybe } from "@/lib/data/errors";
import { OUTREACH_STAGES } from "@/lib/domain/constants";
import { todayInTimezone } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Compose outreach" };

export default async function ComposeOutreachPage(props: PageProps<"/outreach/new">) {
  const { db } = await requireMember();
  const sp = await props.searchParams;
  const prospectId = z.uuid().safeParse(sp.prospect).success ? (sp.prospect as string) : null;
  const stage = z.enum(OUTREACH_STAGES.values).catch("first_contact").parse(sp.stage);

  const [templates, options, prospect, last] = await Promise.all([
    listTemplates(db, { activeOnly: true }),
    prospectId ? Promise.resolve([]) : listProspectOptions(db),
    prospectId
      ? db
          .from("prospects")
          .select(
            "id, business_name, contact_name, job_title, industry, prospect_type, stage, email, whatsapp, phone, linkedin_url, instagram_url, observed_problem, suggested_solution, potential_project, archived_at",
          )
          .eq("id", prospectId)
          .maybeSingle()
          .then((r) => maybe(r))
      : Promise.resolve(null),
    prospectId
      ? db
          .from("outreach_messages")
          .select("channel")
          .eq("prospect_id", prospectId)
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then((r) => maybe(r))
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Compose outreach"
        description="Pick a template, personalise it, send it yourself, then record it here."
      />
      <OutreachComposer
        key={`${prospectId}-${stage}`}
        prospect={prospect}
        prospectOptions={options}
        templates={templates}
        today={todayInTimezone()}
        initialStage={stage}
        lastChannel={last?.channel ?? null}
      />
    </>
  );
}
