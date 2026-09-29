"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/badges";
import { OpportunityStageDialog } from "@/components/prospects/stage-change-dialog";
import { OpportunityDialog, type PickerOption } from "@/components/opportunities/opportunity-dialog";
import { useMoney } from "@/components/workspace/workspace-context";
import { DELIVERY_MODELS, REVENUE_MODELS } from "@/lib/domain/constants";
import { describeTerms } from "@/lib/domain/commercials";
import { formatDay } from "@/lib/client/format";
import type { OpportunityRow } from "@/lib/data/opportunities";
import type { PipelineStageRow } from "@/lib/data/workspace";

/** Compact opportunity summary with stage/edit actions (prospect page). */
export function OpportunityCard({
  opp,
  stages,
  services,
  partners,
  today,
  readOnly = false,
}: {
  opp: OpportunityRow;
  stages: PipelineStageRow[];
  services: PickerOption[];
  partners: PickerOption[];
  today: string;
  readOnly?: boolean;
}) {
  const { money } = useMoney();
  const stage = opp.pipeline_stages;
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/opportunities/${opp.id}`} className="font-medium hover:underline">
          {opp.title}
        </Link>
        {stage ? <StageBadge label={stage.label} color={stage.color} /> : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Value</dt>
        <dd className="text-right tabular-nums">{opp.estimated_value !== null ? money(opp.estimated_value) : "—"}</dd>
        <dt className="text-muted-foreground">Probability</dt>
        <dd className="text-right tabular-nums">{opp.probability !== null ? `${opp.probability}%` : "—"}</dd>
        {opp.services ? (
          <>
            <dt className="text-muted-foreground">Service</dt>
            <dd className="truncate text-right">{opp.services.name}</dd>
          </>
        ) : null}
        {opp.delivery_model ? (
          <>
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="text-right">{DELIVERY_MODELS.label(opp.delivery_model)}</dd>
          </>
        ) : null}
        {opp.partners ? (
          <>
            <dt className="text-muted-foreground">Partner</dt>
            <dd className="truncate text-right">
              <Link href={`/partners/${opp.partners.id}`} className="hover:underline">
                {opp.partners.name}
              </Link>
            </dd>
          </>
        ) : null}
        {opp.revenue_model ? (
          <>
            <dt className="text-muted-foreground">Revenue model</dt>
            <dd className="text-right">{REVENUE_MODELS.label(opp.revenue_model)}</dd>
          </>
        ) : null}
        {opp.expected_close_date ? (
          <>
            <dt className="text-muted-foreground">Expected close</dt>
            <dd className="text-right">{formatDay(opp.expected_close_date, true)}</dd>
          </>
        ) : null}
      </dl>
      {opp.commission_type ? <p className="text-xs text-muted-foreground">Terms: {describeTerms(opp, (v) => money(v))}</p> : null}
      {opp.next_action ? (
        <p className="text-xs">
          <span className="font-medium">Next:</span> {opp.next_action}
          {opp.next_action_date ? ` (${formatDay(opp.next_action_date)})` : ""}
        </p>
      ) : null}
      {!readOnly ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <OpportunityStageDialog
            opportunityId={opp.id}
            currentStageId={opp.stage_id}
            stages={stages}
            today={today}
            trigger={
              <Button size="sm" variant="outline">
                <ArrowRight /> Stage
              </Button>
            }
          />
          <OpportunityDialog opportunity={opp} services={services} partners={partners} />
        </div>
      ) : null}
    </div>
  );
}
