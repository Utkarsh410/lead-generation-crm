import type { Metadata } from "next";
import { AlertCircle, CalendarCheck, CalendarDays, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { TaskList } from "@/components/tasks/task-list";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { requireMember } from "@/lib/auth/session";
import { listOpenTasks } from "@/lib/data/tasks";
import { listProspectOptions } from "@/lib/data/prospects";
import { addDays, dueBucket, todayInTimezone } from "@/lib/domain/dates";
import { formatDay } from "@/lib/client/format";

export const metadata: Metadata = { title: "Follow-ups" };

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export default async function FollowUpsPage() {
  const { db } = await requireMember();
  const today = todayInTimezone();
  const [tasks, prospects] = await Promise.all([listOpenTasks(db, { dueOnOrBefore: addDays(today, 14) }), listProspectOptions(db)]);

  const byPriority = <T extends { priority: keyof typeof PRIORITY_ORDER; due_date: string }>(a: T, b: T) =>
    a.due_date.localeCompare(b.due_date) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  const overdue = tasks.filter((t) => dueBucket(t.due_date, today) === "overdue").sort(byPriority);
  const dueToday = tasks.filter((t) => dueBucket(t.due_date, today) === "today").sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const upcoming = tasks.filter((t) => dueBucket(t.due_date, today) === "upcoming");

  return (
    <>
      <PageHeader
        title="Today's follow-ups"
        description={`${formatDay(today, true)} · ${overdue.length} overdue · ${dueToday.length} due today · ${upcoming.length} in the next 2 weeks`}
        actions={
          <>
            <ExportButton kind="follow-ups" label="Export CSV" />
            <NewTaskDialog today={today} prospects={prospects} trigger={<Button>New follow-up</Button>} />
          </>
        }
      />
      {!tasks.length ? (
        <Card>
          <EmptyState
            icon={<CalendarCheck />}
            title="You're all caught up"
            description="No follow-ups in the next two weeks. Recording outreach automatically schedules the next reminder."
          />
        </Card>
      ) : (
        <div className="space-y-5">
          <Card className={overdue.length ? "border-red-200" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-4" /> Overdue ({overdue.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdue.length ? <TaskList tasks={overdue} today={today} /> : <p className="text-sm text-muted-foreground">Nothing overdue.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="size-4 text-amber-500" /> Due today ({dueToday.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dueToday.length ? <TaskList tasks={dueToday} today={today} showDue={false} /> : <p className="text-sm text-muted-foreground">Nothing due today.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" /> Upcoming — next 14 days ({upcoming.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length ? <TaskList tasks={upcoming} today={today} /> : <p className="text-sm text-muted-foreground">Nothing scheduled.</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
