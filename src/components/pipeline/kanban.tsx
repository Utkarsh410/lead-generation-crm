"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CalendarClock, GripVertical, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { OpportunityStageDialog } from "@/components/prospects/stage-change-dialog";
import { useMoney } from "@/components/workspace/workspace-context";
import { DELIVERY_MODELS, type DeliveryModel } from "@/lib/domain/constants";
import { sumMoney } from "@/lib/domain/money";
import { weightedValue } from "@/lib/domain/commercials";
import { formatDay, relativeAgo } from "@/lib/client/format";
import { moveOpportunityAction } from "@/lib/actions/pipeline";
import { useAction } from "@/lib/client/use-action";
import type { PipelineStageRow } from "@/lib/data/workspace";
import { cn } from "@/lib/utils";

export type KanbanCard = {
  id: string;
  title: string;
  prospect_id: string;
  business_name: string;
  stage_id: string;
  estimated_value: number | null;
  probability: number | null;
  service_name: string | null;
  partner_name: string | null;
  delivery_model: DeliveryModel | null;
  expected_close_date: string | null;
  next_action: string | null;
  updated_at: string;
};

// stages that need extra input open the dialog instead of moving immediately
const needsDialog = (s: PipelineStageRow) => s.key === "discovery" || s.kind === "lost";

const HEADER_COLOR: Record<string, string> = {
  slate: "bg-slate-400",
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  teal: "bg-teal-500",
};

export function Kanban({ cards: initial, stages, today }: { cards: KanbanCard[]; stages: PipelineStageRow[]; today: string }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    // server data refreshed (after revalidation) → drop optimistic state
    setSource(initial);
    setCards(initial);
  }
  const [dialog, setDialog] = useState<{ id: string; from: string; to: string } | null>(null);
  const { run } = useAction();
  const { compact } = useMoney();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  function afterMove(r: { suggestClient: boolean; prospectId: string }) {
    if (r.suggestClient) {
      toast.success("Won! Convert the prospect into a client to track the project and payments.", {
        action: { label: "Open prospect", onClick: () => router.push(`/prospects/${r.prospectId}`) },
      });
    }
  }

  function move(id: string, toId: string) {
    const card = cards.find((c) => c.id === id);
    const to = stages.find((s) => s.id === toId);
    if (!card || !to || card.stage_id === toId) return;
    if (needsDialog(to)) {
      setDialog({ id, from: card.stage_id, to: toId });
      return;
    }
    const previous = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage_id: toId } : c))); // optimistic
    run(() => moveOpportunityAction({ id, stage_id: toId }), {
      success: `${card.title} → ${to.label}`,
      onSuccess: afterMove,
      onError: () => setCards(previous),
    });
  }

  function onDragEnd(e: DragEndEvent) {
    if (e.over) move(String(e.active.id), String(e.over.id));
  }

  return (
    <>
      <DndContext id="opportunity-board" sensors={sensors} onDragEnd={onDragEnd}>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          {stages.map((stage) => {
            const items = cards.filter((c) => c.stage_id === stage.id).sort((a, b) => (Number(b.estimated_value) || 0) - (Number(a.estimated_value) || 0));
            return (
              <Column
                key={stage.id}
                stage={stage}
                count={items.length}
                total={sumMoney(items.map((i) => i.estimated_value))}
                weighted={stage.kind === "open" ? weightedValue(items) : null}
                compact={compact}
              >
                {items.map((c) => (
                  <Card key={c.id} card={c} stages={stages} today={today} onMove={move} compact={compact} />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>
      {dialog ? (
        <OpportunityStageDialog
          key={`${dialog.id}-${dialog.to}`}
          opportunityId={dialog.id}
          currentStageId={dialog.from}
          initialStageId={dialog.to}
          stages={stages}
          today={today}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          onMoved={afterMove}
        />
      ) : null}
    </>
  );
}

function Column({
  stage,
  count,
  total,
  weighted,
  compact,
  children,
}: {
  stage: PipelineStageRow;
  count: number;
  total: number;
  weighted: number | null;
  compact: (v: number) => string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      className={cn("flex w-64 shrink-0 flex-col rounded-lg border bg-muted/50", isOver && "border-primary bg-accent")}
      aria-label={`${stage.label} column`}
    >
      <header className="border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", HEADER_COLOR[stage.color] ?? "bg-slate-400")} />
            <h2 className="text-sm font-semibold">{stage.label}</h2>
            <span className="rounded bg-card px-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground" title="Sum of estimated values">
            {total ? compact(total) : ""}
          </span>
        </div>
        {weighted ? (
          <p className="mt-0.5 text-right text-[11px] text-muted-foreground" title={`Weighted by probability (${stage.probability}% default)`}>
            weighted {compact(weighted)}
          </p>
        ) : null}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">{children}</div>
    </section>
  );
}

function Card({
  card,
  stages,
  today,
  onMove,
  compact,
}: {
  card: KanbanCard;
  stages: PipelineStageRow[];
  today: string;
  onMove: (id: string, to: string) => void;
  compact: (v: number | null) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const overdue = card.expected_close_date && card.expected_close_date < today;
  return (
    <article ref={setNodeRef} style={style} className={cn("rounded-md border bg-card p-2.5 text-sm shadow-xs", isDragging && "z-10 opacity-80 shadow-lg")}>
      <div className="flex items-start gap-1">
        <button
          className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag ${card.title}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/opportunities/${card.id}`} className="line-clamp-2 font-medium hover:underline">
            {card.title}
          </Link>
          <Link href={`/prospects/${card.prospect_id}`} className="block truncate text-xs text-muted-foreground hover:underline">
            {card.business_name}
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Move ${card.title}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {stages
              .filter((s) => s.id !== card.stage_id)
              .map((s) => (
                <DropdownMenuItem key={s.id} onSelect={() => onMove(card.id, s.id)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {card.service_name ? <Badge tone="indigo">{card.service_name}</Badge> : null}
        {card.delivery_model ? <Badge tone="slate">{DELIVERY_MODELS.label(card.delivery_model)}</Badge> : null}
        {card.estimated_value !== null ? <span className="ml-auto text-xs font-medium tabular-nums">{compact(card.estimated_value)}</span> : null}
      </div>
      {card.partner_name ? <p className="mt-1 truncate text-[11px] text-muted-foreground">Partner: {card.partner_name}</p> : null}
      {card.next_action ? <p className="mt-1 line-clamp-1 text-[11px]">Next: {card.next_action}</p> : null}
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive")}>
          <CalendarClock className="size-3" />
          {card.expected_close_date ? `Close ${formatDay(card.expected_close_date)}` : "No close date"}
        </span>
        <span>
          {card.probability !== null ? `${card.probability}% · ` : ""}
          {relativeAgo(card.updated_at)}
        </span>
      </div>
    </article>
  );
}
