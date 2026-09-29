import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge } from "@/components/badges";
import { TaskActions } from "@/components/tasks/task-actions";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TASK_TYPES, type TaskPriority, type TaskType } from "@/lib/domain/constants";
import { relativeDue } from "@/lib/client/format";
import { cn } from "@/lib/utils";

type OpenTask = { id: string; title: string; task_type: TaskType; due_date: string; due_time: string | null; priority: TaskPriority; is_automated: boolean };

/** Open follow-ups linked to a record, with an "Add follow-up" dialog pre-linked to it. */
export function OpenTasksCard({
  tasks,
  today,
  prospectId,
  link,
  defaultType = "follow_up",
  defaultTitle,
  readOnly = false,
}: {
  tasks: OpenTask[];
  today: string;
  prospectId?: string | null;
  link?: { opportunity_id?: string; client_id?: string; partner_id?: string };
  defaultType?: TaskType;
  defaultTitle?: string;
  readOnly?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Follow-ups</CardTitle>
          {!readOnly ? (
            <NewTaskDialog today={today} prospectId={prospectId ?? undefined} link={link} defaultType={defaultType} defaultTitle={defaultTitle} />
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length ? (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.id} className="rounded-md border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className={cn("text-xs text-muted-foreground", t.due_date < today && "font-medium text-destructive")}>
                      {TASK_TYPES.label(t.task_type)} · {relativeDue(t.due_date, today)}
                      {t.due_time ? ` at ${t.due_time.slice(0, 5)}` : ""}
                      {t.is_automated ? " · auto" : ""}
                    </p>
                  </div>
                  <PriorityBadge priority={t.priority} />
                </div>
                <div className="mt-2">
                  <TaskActions taskId={t.id} today={today} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No open follow-ups.</p>
        )}
      </CardContent>
    </Card>
  );
}
