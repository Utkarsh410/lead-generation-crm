import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BriefcaseBusiness, Globe, Mail, MapPin, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HandoffStatusBadge, PartnerStatusBadge, ProjectStatusBadge, StageBadge } from "@/components/badges";
import { DeletePartnerButton, PartnerDialog } from "@/components/catalog/catalog-dialogs";
import { OpenTasksCard } from "@/components/tasks/open-tasks-card";
import { requireMember, todayFor } from "@/lib/auth/session";
import { getPartner } from "@/lib/data/catalog";
import { listOpportunities } from "@/lib/data/opportunities";
import { listProjects } from "@/lib/data/clients";
import { must } from "@/lib/data/errors";
import { DELIVERY_MODELS, PARTNER_TYPES } from "@/lib/domain/constants";
import { formatMoney, sumMoney } from "@/lib/domain/money";
import { formatTimestampDay } from "@/lib/client/format";

export const metadata: Metadata = { title: "Partner" };

export default async function PartnerPage(props: PageProps<"/partners/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, settings } = await requireMember();
  const partner = await getPartner(db, id);
  if (!partner) notFound();
  const today = todayFor(settings);
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency);

  const [opportunities, projects, handoffs, tasks] = await Promise.all([
    listOpportunities(db, { partnerId: id }),
    listProjects(db, { partnerId: id }),
    db
      .from("handoffs")
      .select("id, status, created_at, prospects(business_name), opportunities(title)")
      .eq("partner_id", id)
      .order("created_at", { ascending: false })
      .then((r) => must(r)),
    db
      .from("tasks")
      .select("id, title, task_type, due_date, due_time, priority, is_automated")
      .eq("partner_id", id)
      .in("status", ["pending", "snoozed"])
      .order("due_date")
      .then((r) => must(r)),
  ]);
  const totals = {
    projectValue: sumMoney(projects.map((p) => p.financials.total)),
    commissionEarned: sumMoney(projects.map((p) => p.financials.commissionEarned)),
    commissionOutstanding: sumMoney(projects.map((p) => p.financials.commissionOutstanding)),
    partnerCost: sumMoney(projects.map((p) => p.financials.partnerCost)),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{partner.name}</h1>
            <PartnerStatusBadge status={partner.status} />
            <Badge tone="slate">{PARTNER_TYPES.label(partner.partner_type)}</Badge>
          </div>
          {partner.contact_name ? <p className="mt-1 text-sm text-muted-foreground">{partner.contact_name}</p> : null}
        </div>
        <div className="flex gap-2">
          <PartnerDialog partner={partner} />
          <DeletePartnerButton id={partner.id} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Project value", totals.projectValue],
          ["Commission earned", totals.commissionEarned],
          ["Commission outstanding", totals.commissionOutstanding],
          ["Partner costs", totals.partnerCost],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums">{money(value as number)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Opportunities ({opportunities.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {opportunities.length ? (
                <ul className="divide-y">
                  {opportunities.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <div className="min-w-0">
                        <Link href={`/opportunities/${o.id}`} className="font-medium hover:underline">
                          {o.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {o.prospects?.business_name}
                          {o.delivery_model ? ` · ${DELIVERY_MODELS.label(o.delivery_model)}` : ""}
                        </p>
                      </div>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{money(o.estimated_value)}</span>
                        {o.pipeline_stages ? <StageBadge label={o.pipeline_stages.label} color={o.pipeline_stages.color} /> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No opportunities linked to this partner.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projects ({projects.length})</CardTitle>
              <CardDescription>Commission is calculated from each project&apos;s terms and payments.</CardDescription>
            </CardHeader>
            <CardContent>
              {projects.length ? (
                <ul className="divide-y">
                  {projects.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <div className="min-w-0">
                        <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {p.clients?.company} · value {money(p.financials.total)} · received {money(p.financials.received)}
                        </p>
                      </div>
                      <span className="flex items-center gap-2 text-right">
                        <span className="text-xs">
                          {p.financials.commissionEarned !== null ? `Commission ${money(p.financials.commissionEarned)}` : "No commission terms"}
                        </span>
                        <ProjectStatusBadge status={p.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No projects with this partner yet.</p>
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
                        {h.prospects?.business_name}
                        {h.opportunities ? ` — ${h.opportunities.title}` : ""} · {formatTimestampDay(h.created_at)}
                      </Link>
                      <HandoffStatusBadge status={h.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No handoffs to this partner yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {partner.email ? (
                <p className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <a className="hover:underline" href={`mailto:${partner.email}`}>
                    {partner.email}
                  </a>
                </p>
              ) : null}
              {partner.phone ? (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" />
                  <a className="hover:underline" href={`tel:${partner.phone}`}>
                    {partner.phone}
                  </a>
                </p>
              ) : null}
              {partner.website ? (
                <p className="flex items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" />
                  <a className="hover:underline" href={partner.website} target="_blank" rel="noreferrer">
                    {partner.website}
                  </a>
                </p>
              ) : null}
              {partner.linkedin_url ? (
                <p className="flex items-center gap-2">
                  <BriefcaseBusiness className="size-4 text-muted-foreground" />
                  <a className="hover:underline" href={partner.linkedin_url} target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
                </p>
              ) : null}
              {partner.location ? (
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" /> {partner.location}
                </p>
              ) : null}
              {partner.services.length ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {partner.services.map((x) => (
                    <Badge key={x} tone="indigo">
                      {x}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {partner.notes ? <p className="pt-1 whitespace-pre-line text-muted-foreground">{partner.notes}</p> : null}
            </CardContent>
          </Card>
          <OpenTasksCard tasks={tasks} today={today} link={{ partner_id: partner.id }} defaultType="partner_follow_up" defaultTitle={`Follow up with ${partner.name}`} />
        </div>
      </div>
    </div>
  );
}
