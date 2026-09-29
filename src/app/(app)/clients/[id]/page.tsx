import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Globe, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientStatusBadge, DemoBadge, ProjectStatusBadge } from "@/components/badges";
import { ClientDialog, ProjectDialog } from "@/components/clients/client-dialogs";
import { OpenTasksCard } from "@/components/tasks/open-tasks-card";
import { requireMember, todayFor } from "@/lib/auth/session";
import { getClient, listProjects } from "@/lib/data/clients";
import { listPartnerOptions, listServiceOptions } from "@/lib/data/workspace";
import { must } from "@/lib/data/errors";
import { DELIVERY_MODELS } from "@/lib/domain/constants";
import { formatMoney, sumMoney } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage(props: PageProps<"/clients/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, settings } = await requireMember();
  const client = await getClient(db, id);
  if (!client) notFound();
  const today = todayFor(settings);
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency);

  const [projects, services, partners, tasks] = await Promise.all([
    listProjects(db, { clientId: id }),
    listServiceOptions(db),
    listPartnerOptions(db),
    db
      .from("tasks")
      .select("id, title, task_type, due_date, due_time, priority, is_automated")
      .eq("client_id", id)
      .in("status", ["pending", "snoozed"])
      .order("due_date")
      .then((r) => must(r)),
  ]);
  const live = projects.filter((p) => p.status !== "cancelled");
  const totals = {
    value: sumMoney(live.map((p) => p.financials.total)),
    received: sumMoney(live.map((p) => p.financials.received)),
    balance: sumMoney(live.map((p) => p.financials.balanceDue)),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{client.company}</h1>
            <ClientStatusBadge status={client.status} />
            {client.is_demo ? <DemoBadge /> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[client.industry, client.location].filter(Boolean).join(" · ")}
            {client.prospects ? (
              <>
                {client.industry || client.location ? " · " : ""}
                <Link href={`/prospects/${client.prospects.id}`} className="hover:underline">
                  Prospect record
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <ProjectDialog clientId={client.id} services={services} partners={partners} />
          <ClientDialog client={client} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Project value", totals.value],
          ["Payments received", totals.received],
          ["Balance due", totals.balance],
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
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader>
            <CardTitle>Projects ({projects.length})</CardTitle>
          </CardHeader>
          {projects.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{[p.services?.name, p.partners?.name].filter(Boolean).join(" · ") || "—"}</p>
                    </TableCell>
                    <TableCell>{p.delivery_model ? DELIVERY_MODELS.label(p.delivery_model) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.financials.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.financials.received)}</TableCell>
                    <TableCell>
                      <ProjectStatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <CardContent>
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            </CardContent>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {client.primary_contact ? (
                <p className="flex items-center gap-2">
                  <UserRound className="size-4 text-muted-foreground" /> {client.primary_contact}
                </p>
              ) : null}
              {client.email ? (
                <p className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <a href={`mailto:${client.email}`} className="hover:underline">
                    {client.email}
                  </a>
                </p>
              ) : null}
              {client.phone ? (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" />
                  <a href={`tel:${client.phone}`} className="hover:underline">
                    {client.phone}
                  </a>
                </p>
              ) : null}
              {client.website ? (
                <p className="flex items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" />
                  <a href={client.website} target="_blank" rel="noreferrer" className="hover:underline">
                    {client.website}
                  </a>
                </p>
              ) : null}
              {client.location ? (
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" /> {client.location}
                </p>
              ) : null}
              {client.notes ? <p className="pt-1 whitespace-pre-line text-muted-foreground">{client.notes}</p> : null}
            </CardContent>
          </Card>
          <OpenTasksCard
            tasks={tasks}
            today={today}
            prospectId={client.prospect_id}
            link={{ client_id: client.id }}
            defaultType="client_follow_up"
            defaultTitle={`Check in with ${client.company}`}
          />
        </div>
      </div>
    </div>
  );
}
