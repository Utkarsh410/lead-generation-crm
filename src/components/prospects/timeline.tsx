import {
  ArrowRightLeft,
  Archive,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  ClipboardCheck,
  Handshake,
  MessageSquareReply,
  Pencil,
  Send,
  Sparkles,
  StickyNote,
  UserPlus,
  Briefcase,
  ArchiveRestore,
} from "lucide-react";
import type { ActivityType } from "@/lib/domain/constants";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/domain/constants";
import { formatTimestampDay } from "@/lib/client/format";

const ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  prospect_created: UserPlus,
  prospect_updated: Pencil,
  note: StickyNote,
  stage_change: ArrowRightLeft,
  outreach_sent: Send,
  response_recorded: MessageSquareReply,
  task_created: CalendarPlus,
  task_completed: CalendarCheck,
  task_rescheduled: CalendarClock,
  task_cancelled: CalendarX,
  qualification: ClipboardCheck,
  handoff: Handshake,
  opportunity: Briefcase,
  archived: Archive,
  restored: ArchiveRestore,
};

type Activity = {
  id: string;
  activity_type: ActivityType;
  title: string;
  details: string | null;
  metadata: unknown;
  occurred_at: string;
};

function titleFor(a: Activity): string {
  if (a.activity_type === "stage_change" && a.metadata && typeof a.metadata === "object") {
    const m = a.metadata as { from?: PipelineStage; to?: PipelineStage };
    if (m.from && m.to) return `Stage: ${PIPELINE_STAGES.label(m.from)} → ${PIPELINE_STAGES.label(m.to)}`;
  }
  return a.title;
}

export function Timeline({ activities }: { activities: Activity[] }) {
  if (!activities.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4" /> No activity yet.
      </p>
    );
  }
  return (
    <ol className="relative space-y-3 border-l pl-5">
      {activities.map((a) => {
        const Icon = ICONS[a.activity_type] ?? StickyNote;
        return (
          <li key={a.id} className="relative">
            <span className="absolute top-0.5 -left-[29px] flex size-5 items-center justify-center rounded-full border bg-card">
              <Icon className="size-3 text-muted-foreground" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <time className="w-14 shrink-0 text-xs font-medium text-muted-foreground" dateTime={a.occurred_at}>
                {formatTimestampDay(a.occurred_at)}
              </time>
              <p className="text-sm">{titleFor(a)}</p>
            </div>
            {a.details ? <p className="mt-0.5 ml-16 line-clamp-3 text-xs whitespace-pre-line text-muted-foreground">{a.details}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
