import type { Metadata } from "next";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PartnerStatusBadge } from "@/components/badges";
import { ExportButton } from "@/components/export-button";
import { PartnerDialog } from "@/components/catalog/catalog-dialogs";
import { UrlFilters } from "@/components/url-filters";
import { requireMember } from "@/lib/auth/session";
import { listPartners } from "@/lib/data/catalog";
import { PARTNER_STATUSES, PARTNER_TYPES } from "@/lib/domain/constants";

export const metadata: Metadata = { title: "Partners" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function PartnersPage(props: PageProps<"/partners">) {
  const { db } = await requireMember();
  const sp = await props.searchParams;
  const status = one(sp.status);
  const type = one(sp.type);
  const partners = await listPartners(db, {
    status: status && (PARTNER_STATUSES.values as readonly string[]).includes(status) ? status : undefined,
    type: type && (PARTNER_TYPES.values as readonly string[]).includes(type) ? type : undefined,
    q: one(sp.q),
  });
  const filtered = Boolean(status || type || one(sp.q));

  return (
    <>
      <PageHeader
        title="Partners"
        description="Agencies, freelancers and firms you deliver with or refer work to."
        actions={
          <>
            <ExportButton kind="partners" label="Export" />
            <PartnerDialog />
          </>
        }
      />
      <div className="mb-3">
        <UrlFilters
          searchPlaceholder="Search partners…"
          selects={[
            { key: "type", label: "Type", options: PARTNER_TYPES.list },
            { key: "status", label: "Status", options: PARTNER_STATUSES.list },
          ]}
        />
      </div>
      <Card className="overflow-hidden">
        {partners.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Open opps</TableHead>
                <TableHead className="text-right">Projects</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/partners/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    {p.contact_name ? <p className="text-xs text-muted-foreground">{p.contact_name}</p> : null}
                  </TableCell>
                  <TableCell>{PARTNER_TYPES.label(p.partner_type)}</TableCell>
                  <TableCell className="max-w-64 truncate text-xs">{p.services.join(", ") || "—"}</TableCell>
                  <TableCell>{p.location ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.opportunities.filter((o) => o.status === "open").length}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.projects.length}</TableCell>
                  <TableCell>
                    <PartnerStatusBadge status={p.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<Handshake />}
            title={filtered ? "No partners match" : "No partners yet"}
            description={filtered ? "Try clearing a filter." : "Add the agencies and freelancers you work with, then link them to opportunities and projects."}
          />
        )}
      </Card>
    </>
  );
}
