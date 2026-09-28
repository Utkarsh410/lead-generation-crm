import Link from "next/link";
import { ArrowUpRight, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge, StageBadge } from "@/components/badges";
import { TaskActions } from "./task-actions";
import { TASK_TYPES } from "@/lib/domain/constants";
import { formatDay, relativeAgo, relativeDue } from "@/lib/client/format";
import type { TaskListItem } from "@/lib/data/tasks";
import { cn } from "@/lib/utils";

export function TaskList({ tasks, today, showDue = true }: { tasks: TaskListItem[]; today: string; showDue?: boolean }) {
  return (
    <ul className="divide-y">
      {tasks.map((t) => {
        const overdue = t.due_date < today;
        return (
          <li key={t.id} className="flex flex-col gap-2 py-2.5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{t.title}</p>
                <PriorityBadge priority={t.priority} />
                {t.is_automated ? (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground" title="Created automatically by the follow-up rules">
                    <Bot className="size-3" /> auto
                  </span>
                ) : null}
                {t.status === "snoozed" ? <span className="text-[11px] text-amber-700">snoozed</span> : null}
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{TASK_TYPES.label(t.task_type)}</span>
                {showDue ? (
                  <span className={cn(overdue && "font-medium text-destructive")} title={formatDay(t.due_date, true)}>
                    {relativeDue(t.due_date, today)}
                    {t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ""}
                  </span>
                ) : t.due_time ? (
                  <span>{t.due_time.slice(0, 5)}</span>
                ) : null}
                {t.prospects ? (
                  <>
                    <span>·</span>
                    <Link href={`/prospects/${t.prospects.id}`} className="font-medium text-foreground hover:underline">
                      {t.prospects.business_name}
                    </Link>
                    <StageBadge stage={t.prospects.stage} />
                    <span>last interaction {relativeAgo(t.prospects.last_activity_at)}</span>
                  </>
                ) : (
                  <span>· Internal</span>
                )}
              </p>
              {t.notes ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.notes}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <TaskActions taskId={t.id} today={today} />
              {t.prospects ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/prospects/${t.prospects.id}`}>
                    Open <ArrowUpRight />
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
