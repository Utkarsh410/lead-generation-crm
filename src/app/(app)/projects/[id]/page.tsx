import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DemoBadge, PaymentStatusBadge, ProjectStatusBadge } from "@/components/badges";
import { DeletePaymentButton, PaymentDialog, ProjectDialog } from "@/components/clients/client-dialogs";
import { requireMember, todayFor } from "@/lib/auth/session";
import { getProject } from "@/lib/data/clients";
import { listPartnerOptions, listServiceOptions } from "@/lib/data/workspace";
import { DELIVERY_MODELS, PAYMENT_FLOWS, PAYMENT_TYPES, REVENUE_MODELS } from "@/lib/domain/constants";
import { describeTerms, validateCommercialTerms } from "@/lib/domain/commercials";
import { formatMoney } from "@/lib/domain/money";
import { formatDay } from "@/lib/client/format";

export const metadata: Metadata = { title: "Project" };

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-right font-semibold tabular-nums" : "text-right tabular-nums"}>{children}</span>
    </div>
  );
}

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, settings } = await requireMember();
  const project = await getProject(db, id);
  if (!project) notFound();
  const [services, partners] = await Promise.all([listServiceOptions(db), listPartnerOptions(db)]);
  const today = todayFor(settings);
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency);
  const f = project.financials;
  const payments = [...(project.payments ?? [])].sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const termProblems = project.commission_type ? validateCommercialTerms(project) : [];
  const clientPaysMe = project.payment_flow === "client_pays_me";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
            {project.clients?.is_demo ? <DemoBadge /> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.clients ? (
              <Link href={`/clients/${project.clients.id}`} className="hover:underline">
                {project.clients.company}
              </Link>
            ) : null}
            {project.opportunities ? (
              <>
                {" · from "}
                <Link href={`/opportunities/${project.opportunities.id}`} className="hover:underline">
                  {project.opportunities.title}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <ProjectDialog
          project={project}
          services={services}
          partners={partners}
          trigger={
            <Button size="sm" variant="outline">
              <Pencil /> Edit project &amp; terms
            </Button>
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Project value", f.total],
          ["Received from client", f.received],
          ["Balance due", f.balanceDue],
          [f.commissionEarned !== null ? "Commission earned" : clientPaysMe ? "Planned margin" : "Commission", f.commissionEarned ?? f.plannedMargin],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums">{value === null ? "—" : money(value as number)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Payments</CardTitle>
                <CardDescription>
                  {clientPaysMe ? "Client payments to you." : "Client payments to the partner — commission on “Amount Received” is calculated from these."}
                </CardDescription>
              </div>
              <PaymentDialog projectId={project.id} today={today} />
            </div>
          </CardHeader>
          {payments.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{formatDay(p.payment_date, true)}</TableCell>
                    <TableCell>{PAYMENT_TYPES.label(p.payment_type)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.amount)}</TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-xs" title={p.notes ?? undefined}>
                      {p.reference ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <PaymentDialog
                        projectId={project.id}
                        today={today}
                        payment={p}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label="Edit payment">
                            <Pencil />
                          </Button>
                        }
                      />
                      <DeletePaymentButton id={p.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <CardContent>
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            </CardContent>
          )}
          {f.expected ? (
            <CardContent className="border-t pt-3 text-sm text-muted-foreground">Expected (not yet received): {money(f.expected)}</CardContent>
          ) : null}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Commercials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="Money flow">{PAYMENT_FLOWS.label(project.payment_flow)}</Row>
              <Row label="Revenue model">{project.revenue_model ? REVENUE_MODELS.label(project.revenue_model) : "Not set"}</Row>
              <Row label="Commission terms">{project.commission_type ? describeTerms(project, (v) => money(v)) : "Not set"}</Row>
              {clientPaysMe ? (
                <>
                  <Row label="Partner cost">{money(f.partnerCost)}</Row>
                  <Row label="Planned margin" strong>
                    {money(f.plannedMargin)}
                  </Row>
                </>
              ) : null}
              <div className="my-1 border-t" />
              <Row label="Commission earned">{f.commissionEarned !== null ? money(f.commissionEarned) : "—"}</Row>
              <Row label="Commission received">{money(f.commissionReceived)}</Row>
              <Row label="Commission outstanding" strong>
                {f.commissionOutstanding !== null ? money(f.commissionOutstanding) : "—"}
              </Row>
              <Row label="My revenue to date" strong>
                {money(f.myRevenueToDate)}
              </Row>
              {project.commission_notes ? <p className="pt-1 text-xs whitespace-pre-line text-muted-foreground">{project.commission_notes}</p> : null}
              {termProblems.length ? <Alert tone="warning">{termProblems.join(" ")}</Alert> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="Service">{project.services?.name ?? "—"}</Row>
              <Row label="Delivery model">{project.delivery_model ? DELIVERY_MODELS.label(project.delivery_model) : "—"}</Row>
              <Row label="Partner">
                {project.partners ? (
                  <Link href={`/partners/${project.partners.id}`} className="hover:underline">
                    {project.partners.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Start">{project.start_date ? formatDay(project.start_date, true) : "—"}</Row>
              <Row label="Expected end">{project.expected_end_date ? formatDay(project.expected_end_date, true) : "—"}</Row>
              {project.notes ? <p className="pt-1 text-sm whitespace-pre-line text-muted-foreground">{project.notes}</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
