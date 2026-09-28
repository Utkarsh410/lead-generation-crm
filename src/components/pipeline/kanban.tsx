"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CalendarClock, GripVertical, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TemperatureBadge, STAGE_TONES } from "@/components/badges";
import { StageChangeDialog } from "@/components/prospects/stage-change-dialog";
import { PIPELINE_STAGES, PROJECT_TYPES, type LeadTemperature, type PipelineStage, type ProjectType } from "@/lib/domain/constants";
import { formatINRCompact, sumMoney } from "@/lib/domain/money";
import { relativeAgo, relativeDue } from "@/lib/client/format";
import { changeStageAction } from "@/lib/actions/pipeline";
import { useAction } from "@/lib/client/use-action";
import { cn } from "@/lib/utils";

export type KanbanCard = {
  id: string;
  business_name: string;
  contact_name: string | null;
  industry: string | null;
  stage: PipelineStage;
  opportunity_score: number;
  lead_temperature: LeadTemperature;
  potential_project: string | null;
  estimated_value: number | null;
  next_follow_up_date: string | null;
  last_activity_at: string | null;
  is_demo: boolean;
};

const NEEDS_INPUT: PipelineStage[] = ["discovery_call", "lost"];
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
};

export function Kanban({ cards: initial, today }: { cards: KanbanCard[]; today: string }) {
  const [cards, setCards] = useState(initial);
  const [dialog, setDialog] = useState<{ id: string; from: PipelineStage; to: PipelineStage } | null>(null);
  const { run } = useAction();
  // server data refreshed (after revalidation) → drop optimistic state
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setCards(initial);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function move(id: string, to: PipelineStage) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === to) return;
    if (NEEDS_INPUT.includes(to)) {
      setDialog({ id, from: card.stage, to });
      return;
    }
    const previous = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage: to } : c))); // optimistic
    run(() => changeStageAction({ prospect_id: id, to }), {
      success: `${card.business_name} → ${PIPELINE_STAGES.label(to)}`,
      onError: () => setCards(previous),
    });
  }

  function onDragEnd(e: DragEndEvent) {
    if (e.over) move(String(e.active.id), e.over.id as PipelineStage);
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          {PIPELINE_STAGES.list.map((stage) => {
            const items = cards
              .filter((c) => c.stage === stage.value)
              .sort((a, b) => b.opportunity_score - a.opportunity_score);
            return (
              <Column
                key={stage.value}
                stage={stage.value}
                label={stage.label}
                count={items.length}
                total={sumMoney(items.map((i) => i.estimated_value))}
              >
                {items.map((c) => (
                  <Card key={c.id} card={c} today={today} onMove={move} />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>
      {dialog ? (
        <StageChangeDialog
          key={`${dialog.id}-${dialog.to}`}
          prospectId={dialog.id}
          current={dialog.from}
          initialStage={dialog.to}
          today={today}
          open
          onOpenChange={(o) => !o && setDialog(null)}
        />
      ) : null}
    </>
  );
}

function Column({
  stage,
  label,
  count,
  total,
  children,
}: {
  stage: PipelineStage;
  label: string;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      className={cn("flex w-64 shrink-0 flex-col rounded-lg border bg-muted/50", isOver && "border-primary bg-accent")}
      aria-label={`${label} column`}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", HEADER_COLOR[STAGE_TONES[stage]] ?? "bg-slate-400")} />
          <h2 className="text-sm font-semibold">{label}</h2>
          <span className="rounded bg-card px-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground" title="Sum of estimated values">
          {total ? formatINRCompact(total) : ""}
        </span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">{children}</div>
    </section>
  );
}

function Card({ card, today, onMove }: { card: KanbanCard; today: string; onMove: (id: string, to: PipelineStage) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const overdue = card.next_follow_up_date && card.next_follow_up_date < today;
  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn("rounded-md border bg-card p-2.5 text-sm shadow-xs", isDragging && "z-10 opacity-80 shadow-lg")}
    >
      <div className="flex items-start gap-1">
        <button
          className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag ${card.business_name}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/prospects/${card.id}`} className="line-clamp-2 font-medium hover:underline">
            {card.business_name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {[card.contact_name, card.industry].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Move ${card.business_name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {PIPELINE_STAGES.list
              .filter((s) => s.value !== card.stage)
              .map((s) => (
                <DropdownMenuItem key={s.value} onSelect={() => onMove(card.id, s.value)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TemperatureBadge temperature={card.lead_temperature} score={card.opportunity_score} />
        {card.potential_project ? (
          <span className="text-xs text-muted-foreground">{PROJECT_TYPES.label(card.potential_project as ProjectType)}</span>
        ) : null}
        {card.estimated_value !== null ? <span className="ml-auto text-xs font-medium tabular-nums">{formatINRCompact(card.estimated_value)}</span> : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive")}>
          <CalendarClock className="size-3" />
          {card.next_follow_up_date ? relativeDue(card.next_follow_up_date, today) : "No follow-up"}
        </span>
        <span>{relativeAgo(card.last_activity_at)}</span>
      </div>
    </article>
  );
}
