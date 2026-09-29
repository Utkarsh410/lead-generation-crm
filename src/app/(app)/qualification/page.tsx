import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/export-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClassificationBadge, LeadStatusBadge } from "@/components/badges";
import { requireMember } from "@/lib/auth/session";
import { listQualifications } from "@/lib/data/qualification";
import { must } from "@/lib/data/errors";
import { PROJECT_TYPES, type ProjectType } from "@/lib/domain/constants";
import { formatBudgetRange } from "@/lib/domain/money";
import { formatTimestampDay, relativeAgo } from "@/lib/client/format";

export const metadata: Metadata = { title: "Qualification" };

export default async function QualificationPage() {
  const { db, settings } = await requireMember();
  const [assessments, replied] = await Promise.all([
    listQualifications(db),
    db
      .from("prospects")
      .select("id, business_name, contact_name, stage, stage_changed_at, last_activity_at")
      .is("archived_at", null)
      .in("stage", ["replied", "qualified"])
      .order("stage_changed_at", { ascending: true })
      .then((r) => must(r)),
  ]);
  const active = assessments.filter((a) => !a.prospects?.archived_at);
  const assessedIds = new Set(active.map((a) => a.prospect_id));
  const queue = replied.filter((p) => !assessedIds.has(p.id));
  // latest assessment per prospect
  const latest = [...new Map([...active].reverse().map((a) => [a.prospect_id, a])).values()];
  const readyForHandoff = latest.filter((a) => (a.classification === "qualified" || a.classification === "high_priority") && a.prospects?.stage === "qualified");

  return (
    <>
      <PageHeader
        title="Qualification"
        description="Who needs qualifying, and which qualified leads are ready for an opportunity or a partner handoff."
        actions={
          <>
            <ExportButton kind="qualified" label="Export qualified leads" />
            <Button asChild>
              <Link href="/qualification/new">
                <ClipboardCheck /> Qualify a lead
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs qualification ({queue.length})</CardTitle>
            <CardDescription>Replied or further along, but not assessed yet.</CardDescription>
          </CardHeader>
          <CardContent>
            {queue.length ? (
              <ul className="divide-y">
                {queue.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link href={`/prospects/${p.id}`} className="text-sm font-medium hover:underline">
                        {p.business_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {p.contact_name ?? "—"} · last activity {relativeAgo(p.last_activity_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <LeadStatusBadge status={p.stage} />
                      <Button asChild size="sm">
                        <Link href={`/qualification/new?prospect=${p.id}`}>Qualify</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nobody waiting — nice.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Qualified leads ({readyForHandoff.length})</CardTitle>
            <CardDescription>Qualified leads still at the Qualified status — create an opportunity or hand off to a partner.</CardDescription>
          </CardHeader>
          <CardContent>
            {readyForHandoff.length ? (
              <ul className="divide-y">
                {readyForHandoff.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link href={`/prospects/${a.prospect_id}`} className="text-sm font-medium hover:underline">
                        {a.prospects?.business_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Score {a.score} · {formatBudgetRange(a.budget_min, a.budget_max, settings.currency)}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/prospects/${a.prospect_id}#opportunities`}>Open</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No qualified leads waiting.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader>
          <CardTitle>Assessments</CardTitle>
        </CardHeader>
        {active.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Prospect</TableHead>
                <TableHead>Classification</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Work type</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead className="text-right">Urgency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatTimestampDay(a.created_at)}</TableCell>
                  <TableCell>
                    <Link href={`/prospects/${a.prospect_id}`} className="font-medium hover:underline">
                      {a.prospects?.business_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <ClassificationBadge value={a.classification} />
                    {a.classification !== a.suggested_classification ? (
                      <span className="ml-1 text-[11px] text-muted-foreground">(judgement)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{a.score}</TableCell>
                  <TableCell>{a.project_type ? PROJECT_TYPES.label(a.project_type as ProjectType) : "—"}</TableCell>
                  <TableCell>{formatBudgetRange(a.budget_min, a.budget_max, settings.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.urgency}/5</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState icon={<ClipboardCheck />} title="No qualification assessments yet" description="Qualify a prospect after they reply." />
        )}
      </Card>
    </>
  );
}
