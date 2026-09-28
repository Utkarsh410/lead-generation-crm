import type { Metadata } from "next";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HandoffStatusBadge, StageBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/lib/auth/session";
import { listHandoffs } from "@/lib/data/handoffs";
import { formatTimestampDay } from "@/lib/client/format";

export const metadata: Metadata = { title: "Handoffs" };

export default async function HandoffsPage() {
  const { db } = await requireMember();
  const handoffs = (await listHandoffs(db)).filter((h) => !h.prospects?.archived_at);

  return (
    <>
      <PageHeader
        title="Handoffs"
        description="Qualified leads packaged for BharatCoder. Prepare a handoff from any prospect page."
        actions={
          <Button asChild variant="outline">
            <Link href="/qualification">Ready for handoff</Link>
          </Button>
        }
      />
      <Card className="overflow-hidden">
        {handoffs.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prepared</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Still to confirm</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {handoffs.map((h) => {
                const gaps = ((h.snapshot ?? {}) as { _gaps?: string[] })._gaps ?? [];
                return (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatTimestampDay(h.created_at)}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/prospects/${h.prospect_id}`} className="hover:underline">
                        {h.prospects?.business_name}
                      </Link>
                    </TableCell>
                    <TableCell>{h.prospects ? <StageBadge stage={h.prospects.stage} /> : null}</TableCell>
                    <TableCell>
                      <HandoffStatusBadge status={h.status} />
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-xs text-muted-foreground">{gaps.length ? gaps.join(", ") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/handoffs/${h.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<Handshake />}
            title="No handoffs yet"
            description="When a lead is qualified, use “Prepare handoff” on the prospect page to generate a summary for BharatCoder."
          />
        )}
      </Card>
    </>
  );
}
