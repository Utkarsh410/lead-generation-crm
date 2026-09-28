import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ProspectFilters } from "@/components/prospects/filters";
import { ProspectsTable } from "@/components/prospects/prospects-table";
import { requireMember } from "@/lib/auth/session";
import { listProspects } from "@/lib/data/prospects";
import { prospectListQuerySchema } from "@/lib/validation/schemas";
import { todayInTimezone } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Prospects" };

export default async function ProspectsPage(props: PageProps<"/prospects">) {
  const { db } = await requireMember();
  const raw = await props.searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const query = prospectListQuerySchema.parse(flat);
  const { rows, total, page, pageSize } = await listProspects(db, query);
  const today = todayInTimezone();
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const exportParams = new URLSearchParams(
    Object.entries(query).filter(([k, v]) => v !== undefined && k !== "page").map(([k, v]) => [k, String(v)]),
  ).toString();
  const pageHref = (p: number) => {
    const sp = new URLSearchParams(Object.entries(flat).filter(([, v]) => v !== undefined) as [string, string][]);
    sp.set("page", String(p));
    return `/prospects?${sp.toString()}`;
  };
  const filtered = Object.keys(flat).some((k) => !["page", "sort", "dir"].includes(k));

  return (
    <>
      <PageHeader
        title="Prospects"
        description={`${total} ${filtered ? "matching" : "active"} prospect${total === 1 ? "" : "s"}`}
        actions={
          <Button asChild>
            <Link href="/prospects/new">
              <Plus /> New prospect
            </Link>
          </Button>
        }
      />
      <div className="mb-3">
        <ProspectFilters />
      </div>
      <Card className="overflow-hidden">
        {rows.length ? (
          <ProspectsTable rows={rows} today={today} exportQuery={exportParams} />
        ) : (
          <EmptyState
            icon={<Users />}
            title={filtered ? "No prospects match these filters" : "No prospects yet"}
            description={
              filtered
                ? "Try clearing a filter or searching for something else."
                : "Add your first prospect — or load demo data from Settings to explore the workflow."
            }
            action={
              filtered ? null : (
                <div className="flex gap-2">
                  <Button asChild>
                    <Link href="/prospects/new">
                      <Plus /> New prospect
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/settings">Load demo data</Link>
                  </Button>
                </div>
              )
            }
          />
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              Page {page} of {pages} · {total} prospects
            </span>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                <Link href={pageHref(page - 1)} aria-disabled={page <= 1}>
                  Previous
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className={page >= pages ? "pointer-events-none opacity-50" : ""}>
                <Link href={pageHref(page + 1)} aria-disabled={page >= pages}>
                  Next
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </>
  );
}
