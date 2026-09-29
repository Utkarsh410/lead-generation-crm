import type { Metadata } from "next";
import Link from "next/link";
import { KanbanSquare, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StageBadge } from "@/components/badges";
import { ExportButton } from "@/components/export-button";
import { Kanban, type KanbanCard } from "@/components/pipeline/kanban";
import { OpportunityDialog } from "@/components/opportunities/opportunity-dialog";
import { UrlFilters } from "@/components/url-filters";
import { requireMember, todayFor } from "@/lib/auth/session";
import { listOpportunities } from "@/lib/data/opportunities";
import { listProspectOptions } from "@/lib/data/prospects";
import { getDefaultPipeline, listPartnerOptions, listServiceOptions } from "@/lib/data/workspace";
import { DELIVERY_MODELS, REVENUE_MODELS } from "@/lib/domain/constants";
import { weightedValue } from "@/lib/domain/commercials";
import { formatMoney, formatMoneyCompact, sumMoney } from "@/lib/domain/money";
import { formatDay } from "@/lib/client/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Opportunities" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const isDate = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function OpportunitiesPage(props: PageProps<"/opportunities">) {
  const { db, settings } = await requireMember();
  const sp = await props.searchParams;
  const view = one(sp.view) === "list" ? "list" : "board";
  const filters = {
    stageId: one(sp.stage),
    serviceId: one(sp.service),
    partnerId: one(sp.partner),
    deliveryModel: one(sp.delivery),
    revenueModel: one(sp.revenue),
    q: one(sp.q),
    from: isDate(one(sp.from)),
    to: isDate(one(sp.to)),
  };
  const uuidOk = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);
  filters.stageId = uuidOk(filters.stageId);
  filters.serviceId = uuidOk(filters.serviceId);
  filters.partnerId = uuidOk(filters.partnerId);

  const [pipeline, opportunities, services, partners, prospects] = await Promise.all([
    getDefaultPipeline(db),
    listOpportunities(db, filters),
    listServiceOptions(db),
    listPartnerOptions(db),
    listProspectOptions(db),
  ]);
  const today = todayFor(settings);
  const money = (v: string | number | null) => formatMoney(v, settings.currency);
  const open = opportunities.filter((o) => o.pipeline_stages?.kind === "open");
  const cards: KanbanCard[] = opportunities.map((o) => ({
    id: o.id,
    title: o.title,
    prospect_id: o.prospect_id,
    business_name: o.prospects?.business_name ?? "—",
    stage_id: o.stage_id,
    estimated_value: o.estimated_value,
    probability: o.probability,
    service_name: o.services?.name ?? null,
    partner_name: o.partners?.name ?? null,
    delivery_model: o.delivery_model,
    expected_close_date: o.expected_close_date,
    next_action: o.next_action,
    updated_at: o.updated_at,
  }));
  const viewHref = (v: string) => {
    const next = new URLSearchParams(Object.entries(sp).flatMap(([k, val]) => (typeof val === "string" ? [[k, val]] : [])));
    next.set("view", v);
    return `/opportunities?${next.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Opportunities"
        description={`${open.length} open · ${formatMoneyCompact(sumMoney(open.map((o) => o.estimated_value)), settings.currency)} estimated · ${formatMoneyCompact(weightedValue(open), settings.currency)} weighted by probability`}
        actions={
          <>
            <ExportButton kind="opportunities" label="Export" />
            <OpportunityDialog prospects={prospects} services={services} partners={partners} stages={pipeline.stages} />
          </>
        }
      />
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <UrlFilters
          searchPlaceholder="Search opportunities…"
          keep={["view"]}
          dates
          selects={[
            { key: "stage", label: "Stage", options: pipeline.stages.map((s) => ({ value: s.id, label: s.label })) },
            { key: "service", label: "Service", options: services.map((s) => ({ value: s.id, label: s.name })) },
            { key: "partner", label: "Partner", options: partners.map((p) => ({ value: p.id, label: p.name })) },
            { key: "delivery", label: "Delivery", options: DELIVERY_MODELS.list },
            { key: "revenue", label: "Revenue model", options: REVENUE_MODELS.list },
          ]}
        />
        <div className="flex shrink-0 gap-1">
          <Button asChild size="sm" variant={view === "board" ? "default" : "outline"}>
            <Link href={viewHref("board")}>
              <KanbanSquare /> Board
            </Link>
          </Button>
          <Button asChild size="sm" variant={view === "list" ? "default" : "outline"}>
            <Link href={viewHref("list")}>
              <List /> List
            </Link>
          </Button>
        </div>
      </div>

      {!opportunities.length ? (
        <Card>
          <EmptyState
            icon={<KanbanSquare />}
            title="No opportunities here"
            description="An opportunity is a potential deal with a prospect — create one from a prospect page or with “New opportunity”."
          />
        </Card>
      ) : view === "board" ? (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Drag cards between stages (or use the ⋯ menu). Every move is recorded in the prospect&apos;s activity history. Values are your estimates.
          </p>
          <Kanban cards={cards} stages={pipeline.stages} today={today} />
        </>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Prob.</TableHead>
                <TableHead>Close</TableHead>
                <TableHead>Next action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link href={`/opportunities/${o.id}`} className="font-medium hover:underline">
                      {o.title}
                    </Link>
                    <Link href={`/prospects/${o.prospect_id}`} className="block text-xs text-muted-foreground hover:underline">
                      {o.prospects?.business_name}
                    </Link>
                  </TableCell>
                  <TableCell>{o.pipeline_stages ? <StageBadge label={o.pipeline_stages.label} color={o.pipeline_stages.color} /> : null}</TableCell>
                  <TableCell>{o.services?.name ?? "—"}</TableCell>
                  <TableCell>{o.delivery_model ? DELIVERY_MODELS.label(o.delivery_model) : "—"}</TableCell>
                  <TableCell>{o.partners?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(o.estimated_value)}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.probability !== null ? `${o.probability}%` : "—"}</TableCell>
                  <TableCell className={cn("text-xs", o.pipeline_stages?.kind === "open" && o.expected_close_date && o.expected_close_date < today && "font-medium text-destructive")}>
                    {o.expected_close_date ? formatDay(o.expected_close_date, true) : "—"}
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-xs">{o.next_action ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
