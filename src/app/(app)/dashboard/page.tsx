import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarCheck, FileText, Phone, Plus, Send, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { StageBadge, TemperatureBadge } from "@/components/badges";
import { TaskList } from "@/components/tasks/task-list";
import { HorizontalBars } from "@/components/charts";
import { displayName, requireMember } from "@/lib/auth/session";
import { getDashboard } from "@/lib/data/dashboard";
import { hasDemoData } from "@/lib/data/demo";
import { todayInTimezone } from "@/lib/domain/dates";
import { formatRate } from "@/lib/domain/metrics";
import { formatINRCompact } from "@/lib/domain/money";
import { formatDay, relativeDue } from "@/lib/client/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { db, profile } = await requireMember();
  const today = todayInTimezone();
  const [d, demo] = await Promise.all([getDashboard(db, today), hasDemoData(db)]);
  const m = d.metrics;

  if (m.total === 0) {
    return (
      <>
        <PageHeader title={`Welcome, ${displayName(profile)}`} description="BharatCoder LeadOS — Client Acquisition & Sales Pipeline" />
        <Card>
          <EmptyState
            title="Start by adding your first prospect"
            description="Find a business or agency that may need development, record why, and LeadOS will guide you through outreach, follow-ups, qualification and handoff."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/prospects/new">
                    <Plus /> Add prospect
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/settings">Explore with demo data</Link>
                </Button>
              </div>
            }
          />
        </Card>
      </>
    );
  }

  const todayCount = d.overdue.length + d.dueToday.length;

  return (
    <>
      <PageHeader
        title="What should I work on today?"
        description={`${formatDay(today, true)} · ${todayCount ? `${todayCount} follow-up${todayCount === 1 ? "" : "s"} need attention` : "no follow-ups due"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/outreach/new">
                <Send /> Compose outreach
              </Link>
            </Button>
            <Button asChild>
              <Link href="/prospects/new">
                <Plus /> New prospect
              </Link>
            </Button>
          </>
        }
      />
      {demo ? (
        <Alert tone="info" className="mb-4">
          Demo data is loaded. <Link href="/settings" className="font-medium underline">Remove it in Settings</Link> before tracking real leads.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total prospects" value={m.total} hint={`${m.addedThisWeek} added this week`} />
        <StatCard label="New prospects" value={m.newProspects} hint="Not contacted yet" />
        <StatCard label="Contacted" value={m.contacted} hint={`Contact rate ${formatRate(d.rates.contactRate)}`} />
        <StatCard label="Replies" value={m.replies} hint={`Response rate ${formatRate(d.rates.responseRate)}`} />
        <StatCard label="Qualified leads" value={m.qualified} hint={`Qualification rate ${formatRate(d.rates.qualificationRate)}`} />
        <StatCard label="Active opportunities" value={m.activeOpportunities} hint="Qualified → Negotiation" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="size-4" /> Today&apos;s follow-ups
                </CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/follow-ups">
                    All follow-ups <ArrowRight />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {d.overdue.length ? (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-destructive uppercase">
                    <AlertCircle className="size-3.5" /> Overdue ({d.overdue.length})
                  </p>
                  <TaskList tasks={d.overdue.slice(0, 6)} today={today} />
                </div>
              ) : null}
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <Sun className="size-3.5" /> Due today ({d.dueToday.length})
                </p>
                {d.dueToday.length ? (
                  <TaskList tasks={d.dueToday.slice(0, 8)} today={today} showDue={false} />
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">Nothing due today{d.overdue.length ? "" : " — a good day to add new prospects"}.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="size-4" /> New prospects requiring outreach ({d.needsOutreach.length})
                  </CardTitle>
                  <CardDescription>Highest opportunity score first.</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/prospects?stage=prospect">
                    View all <ArrowRight />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {d.needsOutreach.length ? (
                <ul className="divide-y">
                  {d.needsOutreach.slice(0, 6).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <Link href={`/prospects/${p.id}`} className="text-sm font-medium hover:underline">
                          {p.business_name}
                        </Link>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{p.observed_problem ?? "No observed problem yet — finish research first"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <TemperatureBadge temperature={p.lead_temperature} score={p.opportunity_score} />
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/outreach/new?prospect=${p.id}&stage=first_contact`}>Compose</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Every prospect has been contacted. Time to find new ones.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="size-4" /> Discovery calls (next 7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.discoveryCalls.length ? (
                <ul className="space-y-2">
                  {d.discoveryCalls.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/prospects/${t.prospects?.id}`} className="font-medium hover:underline">
                        {t.prospects?.business_name ?? t.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {relativeDue(t.due_date, today)}
                        {t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No calls scheduled.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" /> Proposals awaiting follow-up
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.proposals.length ? (
                <ul className="space-y-2">
                  {d.proposals.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <Link href={`/prospects/${p.id}`} className="font-medium hover:underline">
                          {p.business_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {p.followUp ? `Follow up ${relativeDue(p.followUp.due_date, today).toLowerCase()}` : "No follow-up scheduled"}
                        </p>
                      </div>
                      <StageBadge stage={p.stage} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No open proposals.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pipeline</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/pipeline">
                    Board <ArrowRight />
                  </Link>
                </Button>
              </div>
              <CardDescription>Prospects per stage · sum of your estimated values</CardDescription>
            </CardHeader>
            <CardContent>
              <HorizontalBars
                rows={d.pipeline.map((s) => ({ key: s.stage, label: s.label, value: s.count, secondaryValue: s.value }))}
                secondary={(v) => formatINRCompact(v)}
                highlight={(k) => k !== "lost"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acquisition</CardTitle>
              <CardDescription>Cumulative funnel rates (active prospects)</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Contact rate", d.rates.contactRate, "contacted / prospects"],
                  ["Response rate", d.rates.responseRate, "replies / contacted"],
                  ["Qualification rate", d.rates.qualificationRate, "qualified / replies"],
                  ["Opportunity rate", d.rates.opportunityRate, "discovery+ / qualified"],
                ].map(([label, value, hint]) => (
                  <div key={label as string}>
                    <dt className="text-xs text-muted-foreground">{label as string}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{formatRate(value as number | null)}</dd>
                    <dd className="text-[11px] text-muted-foreground">{hint as string}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
