import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProjectStatusBadge } from "@/components/badges";
import { ExportButton } from "@/components/export-button";
import { ProjectDialog } from "@/components/clients/client-dialogs";
import { UrlFilters } from "@/components/url-filters";
import { requireMember } from "@/lib/auth/session";
import { listClients, listProjects } from "@/lib/data/clients";
import { listPartnerOptions, listServiceOptions } from "@/lib/data/workspace";
import { DELIVERY_MODELS, PROJECT_STATUSES, REVENUE_MODELS } from "@/lib/domain/constants";
import { formatMoney, sumMoney } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Projects" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const uuidOk = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);
const inList = (v: string | undefined, list: readonly string[]) => (v && list.includes(v) ? v : undefined);

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const { db, settings } = await requireMember();
  const sp = await props.searchParams;
  const [projects, clients, services, partners] = await Promise.all([
    listProjects(db, {
      status: inList(one(sp.status), PROJECT_STATUSES.values),
      partnerId: uuidOk(one(sp.partner)),
      serviceId: uuidOk(one(sp.service)),
      deliveryModel: inList(one(sp.delivery), DELIVERY_MODELS.values),
      revenueModel: inList(one(sp.revenue), REVENUE_MODELS.values),
      q: one(sp.q),
    }),
    listClients(db),
    listServiceOptions(db),
    listPartnerOptions(db),
  ]);
  const money = (v: number | null) => formatMoney(v, settings.currency);
  const live = projects.filter((p) => p.status !== "cancelled");

  return (
    <>
      <PageHeader
        title="Projects"
        description={`${live.length} project${live.length === 1 ? "" : "s"} · ${money(sumMoney(live.map((p) => p.financials.total)))} total value · ${money(sumMoney(live.map((p) => p.financials.received)))} received`}
        actions={
          <>
            <ExportButton kind="projects" label="Export" />
            <ExportButton kind="payments" label="Export payments" />
            {clients.length ? <ProjectDialog clients={clients.map((c) => ({ id: c.id, name: c.company }))} services={services} partners={partners} /> : null}
          </>
        }
      />
      <div className="mb-3">
        <UrlFilters
          searchPlaceholder="Search projects…"
          selects={[
            { key: "status", label: "Status", options: PROJECT_STATUSES.list },
            { key: "service", label: "Service", options: services.map((s) => ({ value: s.id, label: s.name })) },
            { key: "partner", label: "Partner", options: partners.map((p) => ({ value: p.id, label: p.name })) },
            { key: "delivery", label: "Delivery", options: DELIVERY_MODELS.list },
            { key: "revenue", label: "Revenue model", options: REVENUE_MODELS.list },
          ]}
        />
      </div>
      <Card className="overflow-hidden">
        {projects.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Commission earned</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
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
                    <p className="text-xs text-muted-foreground">
                      {p.clients?.company}
                      {p.partners ? ` · ${p.partners.name}` : ""}
                    </p>
                  </TableCell>
                  <TableCell>{p.delivery_model ? DELIVERY_MODELS.label(p.delivery_model) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.financials.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.financials.received)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.financials.commissionEarned !== null ? money(p.financials.commissionEarned) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.financials.commissionOutstanding !== null ? money(p.financials.commissionOutstanding) : "—"}
                  </TableCell>
                  <TableCell>
                    <ProjectStatusBadge status={p.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<FolderKanban />}
            title="No projects"
            description="Projects are created when you convert a won opportunity, or from a client page."
          />
        )}
      </Card>
    </>
  );
}
