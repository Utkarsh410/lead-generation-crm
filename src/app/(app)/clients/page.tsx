import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientStatusBadge, DemoBadge } from "@/components/badges";
import { ExportButton } from "@/components/export-button";
import { ClientDialog } from "@/components/clients/client-dialogs";
import { UrlFilters } from "@/components/url-filters";
import { requireMember } from "@/lib/auth/session";
import { listClients } from "@/lib/data/clients";
import { CLIENT_STATUSES } from "@/lib/domain/constants";
import { formatMoney, sumMoney } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Clients" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function ClientsPage(props: PageProps<"/clients">) {
  const { db, settings } = await requireMember();
  const sp = await props.searchParams;
  const status = one(sp.status);
  const clients = await listClients(db, {
    status: status && (CLIENT_STATUSES.values as readonly string[]).includes(status) ? status : undefined,
    q: one(sp.q),
  });
  const filtered = Boolean(status || one(sp.q));

  return (
    <>
      <PageHeader
        title="Clients"
        description="Businesses that bought from you — each can have several projects."
        actions={
          <>
            <ExportButton kind="clients" label="Export" />
            <ClientDialog />
          </>
        }
      />
      <div className="mb-3">
        <UrlFilters searchPlaceholder="Search clients…" selects={[{ key: "status", label: "Status", options: CLIENT_STATUSES.list }]} />
      </div>
      <Card className="overflow-hidden">
        {clients.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Projects</TableHead>
                <TableHead className="text-right">Project value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                      {c.company}
                    </Link>
                    {c.is_demo ? <DemoBadge /> : null}
                    {c.primary_contact ? <p className="text-xs text-muted-foreground">{c.primary_contact}</p> : null}
                  </TableCell>
                  <TableCell>{c.industry ?? "—"}</TableCell>
                  <TableCell>{c.location ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.projects.length}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(sumMoney(c.projects.filter((p) => p.status !== "cancelled").map((p) => p.total_project_value)), settings.currency)}
                  </TableCell>
                  <TableCell>
                    <ClientStatusBadge status={c.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<Building2 />}
            title={filtered ? "No clients match" : "No clients yet"}
            description={filtered ? "Try clearing a filter." : "When an opportunity is won, use “Convert to client” on the prospect or opportunity."}
          />
        )}
      </Card>
    </>
  );
}
