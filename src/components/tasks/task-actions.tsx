"use client";

import { useState } from "react";
import { CalendarClock, Check, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import { rescheduleTaskAction, setTaskStatusAction } from "@/lib/actions/tasks";
import { useAction } from "@/lib/client/use-action";
import { addDays } from "@/lib/domain/dates";

export function TaskActions({ taskId, today, compact = false }: { taskId: string; today: string; compact?: boolean }) {
  const { pending, run } = useAction();
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState(addDays(today, 1));

  const complete = () => run(() => setTaskStatusAction({ id: taskId, status: "completed" }), { success: "Marked complete" });
  const cancel = () => run(() => setTaskStatusAction({ id: taskId, status: "cancelled" }), { success: "Task cancelled" });
  const reschedule = (date: string, snooze = false) =>
    run(() => rescheduleTaskAction({ id: taskId, due_date: date, snooze }), {
      success: snooze ? "Snoozed" : "Rescheduled",
      onSuccess: () => setCustomOpen(false),
    });

  return (
    <div className="flex items-center gap-1">
      <Button size={compact ? "icon-sm" : "sm"} variant="outline" onClick={complete} disabled={pending} title="Mark complete" aria-label="Mark complete">
        <Check />
        {compact ? null : "Done"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={compact ? "icon-sm" : "sm"} variant="ghost" disabled={pending} aria-label="Reschedule or cancel" title="Reschedule">
            {compact ? <MoreHorizontal /> : <><CalendarClock /> Reschedule</>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Reschedule</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => reschedule(addDays(today, 1))}>Tomorrow</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => reschedule(addDays(today, 3))}>In 3 days</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => reschedule(addDays(today, 7))}>Next week</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => reschedule(addDays(today, 7), true)}>Snooze 1 week</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setCustomOpen(true)}>Pick a date…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={cancel}>
            <X /> Cancel task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule</DialogTitle>
          </DialogHeader>
          <Field label="New due date" htmlFor={`due-${taskId}`}>
            <Input id={`due-${taskId}`} type="date" min={today} value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => reschedule(customDate)} disabled={pending || !customDate}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
