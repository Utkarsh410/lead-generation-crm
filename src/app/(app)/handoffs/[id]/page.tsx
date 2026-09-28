import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui/misc";
import { HandoffStatusBadge, StageBadge } from "@/components/badges";
import { HandoffEditor } from "@/components/handoffs/handoff-editor";
import { requireMember } from "@/lib/auth/session";
import { getHandoff } from "@/lib/data/handoffs";
import { formatDateTime } from "@/lib/client/format";

export const metadata: Metadata = { title: "Handoff" };

export default async function HandoffPage(props: PageProps<"/handoffs/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await requireMember();
  const handoff = await getHandoff(db, id);
  if (!handoff) notFound();
  const snapshot = (handoff.snapshot ?? {}) as { _gaps?: string[] };
  const name = handoff.prospects?.business_name ?? "Prospect";

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            Handoff — {name} <HandoffStatusBadge status={handoff.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            Prepared {formatDateTime(handoff.created_at)}
            {handoff.sent_at ? ` · sent ${formatDateTime(handoff.sent_at)}` : ""} ·
            <Link href={`/prospects/${handoff.prospect_id}`} className="text-primary hover:underline">
              Open prospect
            </Link>
            {handoff.prospects ? <StageBadge stage={handoff.prospects.stage} /> : null}
          </span>
        }
      />
      <HandoffEditor
        id={handoff.id}
        businessName={name}
        initialMarkdown={handoff.summary_markdown}
        initialStatus={handoff.status}
        initialNotes={handoff.notes ?? ""}
        gaps={Array.isArray(snapshot._gaps) ? snapshot._gaps : []}
      />
    </>
  );
}
