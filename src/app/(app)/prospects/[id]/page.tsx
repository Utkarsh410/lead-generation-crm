import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  ArrowRight,
  ClipboardCheck,
  ExternalLink,
  Globe,
  AtSign,
  BriefcaseBusiness,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Send,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/misc";
import {
  ClassificationBadge,
  DemoBadge,
  HandoffStatusBadge,
  PriorityBadge,
  ResponseBadge,
  StageBadge,
  TemperatureBadge,
} from "@/components/badges";
import { StageChangeDialog } from "@/components/prospects/stage-change-dialog";
import { ArchiveButton, ContactsEditor, NoteForm, PrepareHandoffButton } from "@/components/prospects/detail-actions";
import { OpportunityCard } from "@/components/prospects/opportunity-card";
import { Timeline } from "@/components/prospects/timeline";
import { TaskActions } from "@/components/tasks/task-actions";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { RecordResponseDialog } from "@/components/outreach/record-response-dialog";
import { ServiceMapper } from "@/components/services/service-mapper";
import { requireMember } from "@/lib/auth/session";
import { getProspect } from "@/lib/data/prospects";
import { listActivities } from "@/lib/data/activities";
import { listMessages } from "@/lib/data/outreach";
import { latestQualification } from "@/lib/data/qualification";
import { listOpportunities } from "@/lib/data/opportunities";
import { listHandoffs } from "@/lib/data/handoffs";
import { must } from "@/lib/data/errors";
import {
  COMPANY_SIZES,
  LEAD_SOURCES,
  OUTREACH_CHANNELS,
  OUTREACH_STAGES,
  PROJECT_TYPES,
  PROSPECT_TYPES,
  RESEARCH_INDICATORS,
  TASK_TYPES,
  WEBSITE_QUALITY,
  type ProjectType,
} from "@/lib/domain/constants";
import { calculateOpportunityScore } from "@/lib/domain/opportunity-score";
import { nextStepFor } from "@/lib/domain/next-step";
import { todayInTimezone } from "@/lib/domain/dates";
import { formatBudgetRange, formatINR } from "@/lib/domain/money";
import { formatDateTime, formatDay, formatTimestampDay, relativeAgo, relativeDue } from "@/lib/client/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Prospect" };

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-line">{value}</p>
    </div>
  );
}

export default async function ProspectPage(props: PageProps<"/prospects/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await requireMember();
  const prospect = await getProspect(db, id);
  if (!prospect) notFound();
  const today = todayInTimezone();

  const [activities, messages, qualification, opportunities, handoffs, tasks, contacts] = await Promise.all([
    listActivities(db, id),
    listMessages(db, { prospectId: id }),
    latestQualification(db, id),
    listOpportunities(db, id),
    listHandoffs(db, id),
    db
      .from("tasks")
      .select("id, task_type, title, due_date, due_time, priority, status, is_automated, sequence_step, notes")
      .eq("prospect_id", id)
      .in("status", ["pending", "snoozed"])
      .order("due_date")
      .then((r) => must(r)),
    db
      .from("prospect_contacts")
      .select("id, name, job_title, email, phone")
      .eq("prospect_id", id)
      .order("created_at")
      .then((r) => must(r)),
  ]);

  const score = calculateOpportunityScore(prospect.score_factors);
  const archived = Boolean(prospect.archived_at);
  const lastMessage = messages[0];
  const awaiting = lastMessage && ["sent", "delivered", "no_response"].includes(lastMessage.response_status);
  const nextStep = nextStepFor({
    stage: prospect.stage,
    archived,
    hasObservedProblem: Boolean(prospect.observed_problem),
    hasContactMethod: Boolean(prospect.email || prospect.phone || prospect.whatsapp || prospect.linkedin_url || prospect.instagram_url),
    messagesSent: messages.length,
    awaitingResponse: Boolean(awaiting),
    nextFollowUpDate: prospect.next_follow_up_date,
    today,
    hasQualification: Boolean(qualification),
    hasHandoff: handoffs.length > 0,
  });
  const nextSequenceStage = tasks.some((t) => t.sequence_step === "follow_up_2") ? "follow_up_2" : "follow_up_1";
  const composeHref = (stage: string) => `/outreach/new?prospect=${id}&stage=${stage}`;

  const nextStepAction = (() => {
    switch (nextStep.action) {
      case "first_outreach":
        return (
          <Button asChild>
            <Link href={composeHref("first_contact")}>
              <Send /> Compose first message
            </Link>
          </Button>
        );
      case "follow_up":
        return (
          <Button asChild>
            <Link href={composeHref(nextSequenceStage)}>
              <Send /> Compose {OUTREACH_STAGES.label(nextSequenceStage)}
            </Link>
          </Button>
        );
      case "record_response":
        return lastMessage ? <RecordResponseDialog messageId={lastMessage.id} today={today} current={lastMessage.response_status} /> : null;
      case "qualify":
        return (
          <Button asChild>
            <Link href={`/qualification/new?prospect=${id}`}>
              <ClipboardCheck /> Qualify
            </Link>
          </Button>
        );
      case "handoff":
        return <PrepareHandoffButton prospectId={id} variant="default" size="default" />;
      case "schedule_call":
        return (
          <StageChangeDialog
            prospectId={id}
            current={prospect.stage}
            today={today}
            initialStage="discovery_call"
            trigger={<Button>Schedule discovery call</Button>}
          />
        );
      case "move_stage":
        return <StageChangeDialog prospectId={id} current={prospect.stage} today={today} trigger={<Button>Change stage</Button>} />;
      case "proposal_follow_up":
        return (
          <Button asChild>
            <Link href={composeHref("proposal_follow_up")}>
              <Send /> Compose proposal follow-up
            </Link>
          </Button>
        );
      case "research":
        return (
          <Button asChild>
            <Link href={`/prospects/${id}/edit`}>
              <Pencil /> Add research
            </Link>
          </Button>
        );
      case "re_engage":
        return <NewTaskDialog today={today} prospectId={id} defaultType="follow_up" defaultTitle={`Re-engage ${prospect.business_name}`} trigger={<Button>Schedule re-engagement</Button>} />;
      case "track_commission":
        return (
          <Button asChild variant="outline">
            <a href="#opportunity">View opportunity</a>
          </Button>
        );
      case "restore":
        return <ArchiveButton prospectId={id} archived />;
    }
  })();

  const created = (await props.searchParams).created === "1";

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{prospect.business_name}</h1>
            <StageBadge stage={prospect.stage} />
            <TemperatureBadge temperature={score.temperature} score={score.score} />
            <Badge>{PROSPECT_TYPES.label(prospect.prospect_type)}</Badge>
            {prospect.is_demo ? <DemoBadge /> : null}
            {archived ? <Badge tone="red">Archived</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[prospect.industry, prospect.location, prospect.country].filter(Boolean).join(" · ") || "No industry/location yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!archived ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={composeHref(messages.length ? nextSequenceStage : "first_contact")}>
                  <Send /> Outreach
                </Link>
              </Button>
              <StageChangeDialog prospectId={id} current={prospect.stage} today={today} trigger={<Button variant="outline" size="sm"><ArrowRight /> Stage</Button>} />
              <Button asChild variant="outline" size="sm">
                <Link href={`/qualification/new?prospect=${id}`}>
                  <ClipboardCheck /> Qualify
                </Link>
              </Button>
              <PrepareHandoffButton prospectId={id} />
            </>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link href={`/prospects/${id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
          <ArchiveButton prospectId={id} archived={archived} />
        </div>
      </div>

      {created ? <Alert tone="success" title="Prospect created.">Next: send the first outreach or finish research.</Alert> : null}

      {/* next step */}
      <Card className="border-primary/30 bg-accent/40">
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Next step</p>
            <p className="font-semibold">{nextStep.title}</p>
            <p className="text-sm text-muted-foreground">{nextStep.description}</p>
          </div>
          <div className="shrink-0">{nextStepAction}</div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* overview */}
          <Card>
            <CardHeader>
              <CardTitle>Prospect information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <InfoRow icon={<Pencil />}>
                  <span className="font-medium">{prospect.contact_name ?? "No contact name"}</span>
                  {prospect.job_title ? <span className="text-muted-foreground"> · {prospect.job_title}</span> : null}
                </InfoRow>
                {prospect.email ? (
                  <InfoRow icon={<Mail />}>
                    <a className="hover:underline" href={`mailto:${prospect.email}`}>{prospect.email}</a>
                  </InfoRow>
                ) : null}
                {prospect.phone ? (
                  <InfoRow icon={<Phone />}>
                    <a className="hover:underline" href={`tel:${prospect.phone}`}>{prospect.phone}</a>
                  </InfoRow>
                ) : null}
                {prospect.whatsapp ? (
                  <InfoRow icon={<MessageCircle />}>
                    <a className="hover:underline" target="_blank" rel="noreferrer" href={`https://wa.me/${prospect.whatsapp.replace(/\D/g, "")}`}>
                      WhatsApp {prospect.whatsapp}
                    </a>
                  </InfoRow>
                ) : null}
                {prospect.location ? <InfoRow icon={<MapPin />}>{[prospect.location, prospect.country].filter(Boolean).join(", ")}</InfoRow> : null}
                {!prospect.email && !prospect.phone && !prospect.whatsapp && !prospect.linkedin_url && !prospect.instagram_url ? (
                  <Alert tone="warning">No contact information yet.</Alert>
                ) : null}
              </div>
              <div className="space-y-2">
                {prospect.website ? (
                  <InfoRow icon={<Globe />}>
                    <a className="inline-flex items-center gap-1 hover:underline" href={prospect.website} target="_blank" rel="noreferrer">
                      {prospect.website_domain ?? prospect.website} <ExternalLink className="size-3" />
                    </a>
                  </InfoRow>
                ) : null}
                {prospect.linkedin_url ? (
                  <InfoRow icon={<BriefcaseBusiness />}>
                    <a className="hover:underline" href={prospect.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>
                  </InfoRow>
                ) : null}
                {prospect.instagram_url ? (
                  <InfoRow icon={<AtSign />}>
                    <a className="hover:underline" href={prospect.instagram_url} target="_blank" rel="noreferrer">Instagram</a>
                  </InfoRow>
                ) : null}
                <p className="text-sm">
                  <span className="text-muted-foreground">Source:</span> {LEAD_SOURCES.label(prospect.lead_source)}
                  {prospect.source_url ? (
                    <a href={prospect.source_url} target="_blank" rel="noreferrer" className="ml-1 text-primary hover:underline">link</a>
                  ) : null}
                </p>
                {prospect.source_notes ? <p className="text-xs text-muted-foreground">{prospect.source_notes}</p> : null}
                {prospect.company_size ? (
                  <p className="text-sm"><span className="text-muted-foreground">Size:</span> {COMPANY_SIZES.label(prospect.company_size as never)}</p>
                ) : null}
                <p className="text-sm">
                  <span className="text-muted-foreground">Potential project:</span>{" "}
                  {prospect.potential_project ? PROJECT_TYPES.label(prospect.potential_project as ProjectType) : "—"}
                  {prospect.estimated_value !== null ? ` · ${formatINR(prospect.estimated_value)}` : ""}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* research */}
          <Card>
            <CardHeader>
              <CardTitle>Research</CardTitle>
              <CardDescription>Why they may need development</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextBlock label="Observed problem" value={prospect.observed_problem} />
                <TextBlock label="Potential need" value={prospect.potential_need} />
                <TextBlock label="Suggested solution" value={prospect.suggested_solution} />
                <TextBlock label="Business description" value={prospect.business_description} />
                <TextBlock label="Current website" value={prospect.current_website_notes} />
                <TextBlock label="Social presence" value={prospect.social_presence} />
              </div>
              <TextBlock label="Research notes" value={prospect.research_notes} />
              {!prospect.observed_problem && !prospect.potential_need ? (
                <p className="text-sm text-muted-foreground">
                  No research recorded yet. <Link className="text-primary hover:underline" href={`/prospects/${id}/edit`}>Add research</Link>
                </p>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {prospect.website_quality ? <Badge tone="slate">Website: {WEBSITE_QUALITY.label(prospect.website_quality)}</Badge> : null}
                {RESEARCH_INDICATORS.list.map((ind) => {
                  const v = prospect[ind.value];
                  if (v === null) return null;
                  return (
                    <Badge key={ind.value} tone={v ? "green" : "neutral"}>
                      {v ? "✓" : "✗"} {ind.label}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* outreach */}
          <Card id="outreach">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Outreach history</CardTitle>
                {!archived ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={composeHref(messages.length ? nextSequenceStage : "first_contact")}>
                      <Send /> New message
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {messages.length ? (
                <ul className="divide-y">
                  {messages.map((m) => (
                    <li key={m.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {OUTREACH_STAGES.label(m.outreach_stage)} · {OUTREACH_CHANNELS.label(m.channel)}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDateTime(m.sent_at)}</span>
                        </p>
                        <p className="line-clamp-2 text-xs whitespace-pre-line text-muted-foreground">{m.customized_message}</p>
                        {m.response_notes ? <p className="mt-1 text-xs"><span className="font-medium">Response:</span> {m.response_notes}</p> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <ResponseBadge status={m.response_status} />
                        {!archived ? <RecordResponseDialog messageId={m.id} today={today} current={m.response_status} trigger={<Button size="sm" variant="ghost">Update</Button>} /> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No outreach recorded yet.</p>
              )}
            </CardContent>
          </Card>

          {/* qualification */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Qualification</CardTitle>
                {!archived ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/qualification/new?prospect=${id}`}>{qualification ? "Re-assess" : "Qualify"}</Link>
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {qualification ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <ClassificationBadge value={qualification.classification} />
                    <span className="text-sm tabular-nums">Score {qualification.score}/100</span>
                    <span className="text-xs text-muted-foreground">{formatTimestampDay(qualification.created_at)}</span>
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Budget:</span> {formatBudgetRange(qualification.budget_min, qualification.budget_max)}
                  </p>
                  <TextBlock label="Problem" value={qualification.problem_description} />
                  <TextBlock label="Required features" value={qualification.required_features} />
                  <p className="text-sm">
                    <span className="text-muted-foreground">Decision maker:</span>{" "}
                    {qualification.decision_maker_identified ? qualification.decision_maker_name || "Identified" : "Not identified"}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Timeline:</span>{" "}
                    {[qualification.desired_launch_date ? formatDay(qualification.desired_launch_date, true) : null, qualification.timeline_notes].filter(Boolean).join(" — ") || "—"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not qualified yet.</p>
              )}
            </CardContent>
          </Card>

          {/* timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!archived ? <NoteForm prospectId={id} /> : null}
              <Timeline activities={activities} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current stage</span>
                <StageBadge stage={prospect.stage} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">In stage since</span>
                <span>{formatTimestampDay(prospect.stage_changed_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last contact</span>
                <span>{prospect.last_contacted_at ? relativeAgo(prospect.last_contacted_at) : "Never"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last interaction</span>
                <span>{relativeAgo(prospect.last_activity_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Next follow-up</span>
                <span className={cn(prospect.next_follow_up_date && prospect.next_follow_up_date < today && "font-medium text-destructive")}>
                  {prospect.next_follow_up_date ? relativeDue(prospect.next_follow_up_date, today) : "None scheduled"}
                </span>
              </div>
              {prospect.stage === "lost" && prospect.lost_reason ? <Alert tone="danger" title="Lost reason">{prospect.lost_reason}</Alert> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Follow-ups</CardTitle>
                {!archived ? <NewTaskDialog today={today} prospectId={id} /> : null}
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length ? (
                <ul className="space-y-2">
                  {tasks.map((t) => (
                    <li key={t.id} className="rounded-md border p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{t.title}</p>
                          <p className={cn("text-xs text-muted-foreground", t.due_date < today && "font-medium text-destructive")}>
                            {TASK_TYPES.label(t.task_type)} · {relativeDue(t.due_date, today)}
                            {t.due_time ? ` at ${t.due_time.slice(0, 5)}` : ""}
                            {t.is_automated ? " · auto" : ""}
                          </p>
                        </div>
                        <PriorityBadge priority={t.priority} />
                      </div>
                      <div className="mt-2">
                        <TaskActions taskId={t.id} today={today} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No open follow-ups.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Opportunity score</CardTitle>
                <span className="text-lg font-semibold tabular-nums">{score.score}</span>
              </div>
              <CardDescription>Internal prioritisation only — not a prediction.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {score.breakdown.map((b) => (
                <div key={b.key}>
                  <div className="flex justify-between text-xs">
                    <span>{b.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {b.points}/{b.weight}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(b.points / b.weight) * 100}%` }} />
                  </div>
                </div>
              ))}
              <Link href={`/prospects/${id}/edit`} className="mt-1 inline-block text-xs text-primary hover:underline">
                Adjust ratings
              </Link>
            </CardContent>
          </Card>

          {opportunities.length ? (
            <Card id="opportunity">
              <CardHeader>
                <CardTitle>Opportunity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {opportunities.map((o) => (
                  <OpportunityCard key={o.id} opp={o} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Handoffs</CardTitle>
                {!archived && handoffs.length ? <PrepareHandoffButton prospectId={id} label="New" /> : null}
              </div>
            </CardHeader>
            <CardContent>
              {handoffs.length ? (
                <ul className="space-y-1.5">
                  {handoffs.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/handoffs/${h.id}`} className="hover:underline">
                        Handoff · {formatTimestampDay(h.created_at)}
                      </Link>
                      <HandoffStatusBadge status={h.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No handoff yet.</p>
                  {!archived ? <PrepareHandoffButton prospectId={id} /> : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service opportunity mapping</CardTitle>
              <CardDescription>Map their problem to BharatCoder services (manual rules)</CardDescription>
            </CardHeader>
            <CardContent>
              <ServiceMapper
                prospectId={id}
                initialProblem={[prospect.observed_problem, prospect.potential_need].filter(Boolean).join(" ")}
                saved={prospect.recommended_services}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Other contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactsEditor prospectId={id} contacts={contacts} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
