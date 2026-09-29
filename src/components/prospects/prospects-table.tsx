"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, ArchiveRestore, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DemoBadge, LeadStatusBadge, TemperatureBadge } from "@/components/badges";
import { useMoney, useSourceLabel } from "@/components/workspace/workspace-context";
import { Badge } from "@/components/ui/badge";
import { SortHeader } from "./sort-header";
import { PROJECT_TYPES, PROSPECT_TYPES } from "@/lib/domain/constants";
import { formatDay, formatTimestampDay, relativeDue } from "@/lib/client/format";
import { setArchivedAction } from "@/lib/actions/prospects";
import { useAction } from "@/lib/client/use-action";
import type { ProspectListRow } from "@/lib/data/prospects";
import { cn } from "@/lib/utils";

export function ProspectsTable({ rows, today, exportQuery }: { rows: ProspectListRow[]; today: string; exportQuery: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { pending, run } = useAction();
  const { compact } = useMoney();
  const sourceLabel = useSourceLabel();
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const anyArchived = selectedRows.some((r) => r.archived_at);
  const anyActive = selectedRows.some((r) => !r.archived_at);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function archive(archived: boolean) {
    const ids = selectedRows.filter((r) => Boolean(r.archived_at) !== archived).map((r) => r.id);
    run(() => setArchivedAction({ ids, archived }), {
      success: (d) => `${d.count} prospect${d.count === 1 ? "" : "s"} ${archived ? "archived" : "restored"}`,
      onSuccess: () => setSelected(new Set()),
    });
  }

  const exportHref = `/api/export/prospects?${exportQuery}${
    selected.size ? `${exportQuery ? "&" : ""}ids=${[...selected].join(",")}` : ""
  }`;

  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-2 border-b px-3 py-1.5">
        {selected.size ? (
          <>
            <span className="text-sm font-medium">{selected.size} selected</span>
            {anyActive ? (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline" disabled={pending}>
                    <Archive /> Archive
                  </Button>
                }
                title="Archive selected prospects?"
                description="Archived prospects are hidden from lists and their open follow-ups are cancelled. You can restore them later."
                confirmLabel="Archive"
                destructive
                onConfirm={() => archive(true)}
              />
            ) : null}
            {anyArchived ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => archive(false)}>
                <ArchiveRestore /> Restore
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Select rows for bulk actions</span>
        )}
        <Button asChild size="sm" variant="outline" className="ml-auto">
          <a href={exportHref}>
            <Download /> Export CSV{selected.size ? ` (${selected.size})` : ""}
          </a>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <input
                type="checkbox"
                aria-label="Select all"
                className="size-4 accent-primary"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
              />
            </TableHead>
            <TableHead><SortHeader column="opportunity_score" label="Priority" /></TableHead>
            <TableHead><SortHeader column="business_name" label="Business" /></TableHead>
            <TableHead>Contact</TableHead>
            <TableHead><SortHeader column="industry" label="Industry" /></TableHead>
            <TableHead><SortHeader column="prospect_type" label="Type" /></TableHead>
            <TableHead><SortHeader column="lead_source" label="Source" /></TableHead>
            <TableHead className="text-right"><SortHeader column="opportunity_score" label="Score" /></TableHead>
            <TableHead><SortHeader column="stage" label="Status" /></TableHead>
            <TableHead>Potential project</TableHead>
            <TableHead className="text-right"><SortHeader column="estimated_value" label="Est. value" /></TableHead>
            <TableHead><SortHeader column="last_contacted_at" label="Last contact" /></TableHead>
            <TableHead><SortHeader column="next_follow_up_date" label="Next follow-up" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const overdue = r.next_follow_up_date && r.next_follow_up_date < today;
            return (
              <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined} className={cn(r.archived_at && "opacity-60")}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.business_name}`}
                    className="size-4 accent-primary"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </TableCell>
                <TableCell>
                  <TemperatureBadge temperature={r.lead_temperature} />
                </TableCell>
                <TableCell className="max-w-56">
                  <Link href={`/prospects/${r.id}`} className="font-medium hover:underline">
                    {r.business_name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {r.location}
                    {r.is_demo ? <DemoBadge /> : null}
                    {r.archived_at ? <Badge>Archived</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="max-w-44">
                  <div className="truncate">{r.contact_name ?? <span className="text-muted-foreground">—</span>}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.job_title}</div>
                </TableCell>
                <TableCell className="max-w-36 truncate">{r.industry ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{PROSPECT_TYPES.label(r.prospect_type)}</TableCell>
                <TableCell className="whitespace-nowrap">{sourceLabel(r.lead_source)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{r.opportunity_score}</TableCell>
                <TableCell>
                  <LeadStatusBadge status={r.stage} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {r.potential_project ? PROJECT_TYPES.label(r.potential_project as never) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{compact(r.estimated_value)}</TableCell>
                <TableCell className="whitespace-nowrap">{formatTimestampDay(r.last_contacted_at)}</TableCell>
                <TableCell className={cn("whitespace-nowrap", overdue && "font-medium text-destructive")}>
                  {r.next_follow_up_date ? (
                    <span title={formatDay(r.next_follow_up_date, true)}>{relativeDue(r.next_follow_up_date, today)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
