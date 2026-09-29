import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowRight, ClipboardCheck, FolderKanban, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { ClassificationBadge, DemoBadge, HandoffStatusBadge, ProjectStatusBadge, StageBadge } from "@/components/badges";
import { OpportunityStageDialog } from "@/components/prospects/stage-change-dialog";
import { OpportunityDialog } from "@/components/opportunities/opportunity-dialog";
import { DeleteOpportunityButton } from "@/components/opportunities/delete-opportunity-button";
import { PrepareHandoffButton } from "@/components/prospects/detail-actions";
import { ConvertToClientButton } from "@/components/clients/client-dialogs";
import { OpenTasksCard } from "@/components/tasks/open-tasks-card";
import { requireMember, todayFor } from "@/lib/auth/session";
import { getOpportunity } from "@/lib/data/opportunities";
import { getDefaultPipeline, listPartnerOptions, listServiceOptions } from "@/lib/data/workspace";
import { must } from "@/lib/data/errors";
import { DELIVERY_MODELS, REVENUE_MODELS } from "@/lib/domain/constants";
import { describeTerms, validateCommercialTerms } from "@/lib/domain/commercials";
import { formatMoney } from "@/lib/domain/money";
import { formatDay, formatTimestampDay } from "@/lib/client/format";

export const metadata: Metadata = { title: "Opportunity" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default async function OpportunityPage(props: PageProps<"/opportunities/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, settings } = await requireMember();
  const opp = await getOpportunity(db, id);
  if (!opp) notFound();
  const today = todayFor(settings);
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency);

  const [pipeline, services, partners, tasks, projects, handoffs, qualifications, client] = await Promise.all([
    getDefaultPipeline(db),
    listServiceOptions(db),
    listPartnerOptions(db),
    db
      .from("tasks")
      .select("id, title, task_type, due_date, due_time, priority, is_automated")
      .eq("opportunity_id", id)
      .in("status", ["pending", "snoozed"])
      .order("due_date")
      .then((r) => must(r)),
    db.from("projects").select("id, name, status, total_project_value").eq("opportunity_id", id).then((r) => must(r)),
    db.from("handoffs").select("id, status, created_at, partners(name)").eq("opportunity_id", id).order("created_at", { ascending: false }).then((r) => must(r)),
    db
      .from("qualification_assessments")
      .select("id, score, classification, created_at")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false })
      .then((r) => must(r)),
    db.from("clients").select("id, company").eq("prospect_id", opp.prospect_id).maybeSingle().then((r) => r.data),
  ]);
  const stage = opp.pipeline_stages;
  const archived = Boolean(opp.prospects?.archived_at);
  const won = stage?.kind === "won";
  const termProblems = opp.commission_type ? validateCommercialTerms(opp) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{opp.title}</h1>
            {stage ? <StageBadge label={stage.label} color={stage.color} /> : null}
            {opp.prospects?.is_demo ? <DemoBadge /> : null}
            {archived ? <Badge tone="red">Prospect archived</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/prospects/${opp.prospect_id}`} className="hover:underline">
              {opp.prospects?.business_name}
            </Link>
            {opp.prospects?.contact_name ? ` · ${opp.prospects.contact_name}` : ""}
          </p>
        </div>
        {!archived ? (
          <div className="flex flex-wrap gap-2">
            <OpportunityStageDialog
              opportunityId={opp.id}
              currentStageId={opp.stage_id}
              stages={pipeline.stages}
              today={today}
              trigger={
                <Button size="sm">
                  <ArrowRight /> Change stage
                </Button>
              }
            />
            <OpportunityDialog opportunity={opp} services={services} partners={partners} />
            <Button asChild size="sm" variant="outline">
              <Link href={`/qualification/new?prospect=${opp.prospect_id}&opportunity=${opp.id}`}>
                <ClipboardCheck /> Qualify
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/outreach/new?prospect=${opp.prospect_id}&stage=${stage?.key === "proposal" ? "proposal_follow_up" : "post_call_follow_up"}`}>
                <Send /> Message
              </Link>
            </Button>
            <PrepareHandoffButton
              prospectId={opp.prospect_id}
              opportunities={[{ id: opp.id, title: opp.title, partner_id: opp.partner_id }]}
              partners={partners}
              defaultOpportunityId={opp.id}
            />
            {won && !projects.length ? (
              <ConvertToClientButton prospectId={opp.prospect_id} wonOpportunities={[{ id: opp.id, title: opp.title }]} label={client ? "Create project" : "Convert to client"} />
            ) : null}
            <DeleteOpportunityButton id={opp.id} prospectId={opp.prospect_id} />
          </div>
        ) : null}
      </div>

      {won && !projects.length ? (
        <Alert tone="success" title="Won!">
          Convert it into a client project to track delivery, payments and commission.
        </Alert>
      ) : null}
      {stage?.kind === "lost" && opp.lost_reason ? (
        <Alert tone="danger" title="Lost reason">
          {opp.lost_reason}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Deal</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              <Row label="Estimated value">{money(opp.estimated_value)}</Row>
              <Row label="Probability">{opp.probability !== null ? `${opp.probability}%` : "—"}</Row>
              <Row label="Service">{opp.services?.name ?? "—"}</Row>
              <Row label="Delivery model">{opp.delivery_model ? DELIVERY_MODELS.label(opp.delivery_model) : "—"}</Row>
              <Row label="Partner">
                {opp.partners ? (
                  <Link href={`/partners/${opp.partners.id}`} className="hover:underline">
                    {opp.partners.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Expected close">{opp.expected_close_date ? formatDay(opp.expected_close_date, true) : "—"}</Row>
              <Row label="Next action">
                {opp.next_action ?? "—"}
                {opp.next_action_date ? ` (${formatDay(opp.next_action_date)})` : ""}
              </Row>
              <Row label="In stage since">{formatTimestampDay(opp.stage_changed_at)}</Row>
              {opp.description ? (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Description / requirements</p>
                  <p className="text-sm whitespace-pre-line">{opp.description}</p>
                </div>
              ) : null}
              {opp.notes ? (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="text-sm whitespace-pre-line">{opp.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commercial terms</CardTitle>
              <CardDescription>How you expect to earn from this deal. Nothing is assumed — edit to set terms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="Revenue model">{opp.revenue_model ? REVENUE_MODELS.label(opp.revenue_model) : "Not set"}</Row>
              <Row label="Commission">{opp.commission_type ? describeTerms(opp, (v) => money(v)) : "Not agreed yet"}</Row>
              {opp.commission_notes ? <p className="text-xs whitespace-pre-line text-muted-foreground">{opp.commission_notes}</p> : null}
              {termProblems.length ? <Alert tone="warning">{termProblems.join(" ")}</Alert> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length ? (
                <ul className="space-y-1.5">
                  {projects.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/projects/${p.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                        <FolderKanban className="size-4 text-muted-foreground" /> {p.name}
                      </Link>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{money(p.total_project_value)}</span>
                        <ProjectStatusBadge status={p.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No project yet — one is created when you convert a won opportunity.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <OpenTasksCard tasks={tasks} today={today} prospectId={opp.prospect_id} link={{ opportunity_id: opp.id }} readOnly={archived} defaultTitle={opp.next_action ?? ""} />

          <Card>
            <CardHeader>
              <CardTitle>Qualification</CardTitle>
            </CardHeader>
            <CardContent>
              {qualifications.length ? (
                <ul className="space-y-1.5">
                  {qualifications.map((q) => (
                    <li key={q.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{formatTimestampDay(q.created_at)}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{q.score}/100</span>
                        <ClassificationBadge value={q.classification} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Not qualified against this opportunity yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Handoffs</CardTitle>
            </CardHeader>
            <CardContent>
              {handoffs.length ? (
                <ul className="space-y-1.5">
                  {handoffs.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/handoffs/${h.id}`} className="hover:underline">
                        {h.partners?.name ?? "Handoff"} · {formatTimestampDay(h.created_at)}
                      </Link>
                      <HandoffStatusBadge status={h.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No handoff yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
