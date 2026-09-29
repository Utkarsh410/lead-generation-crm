"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import { TASK_PRIORITIES, TASK_TYPES, type TaskPriority, type TaskType } from "@/lib/domain/constants";
import { createTaskAction } from "@/lib/actions/tasks";
import { useAction } from "@/lib/client/use-action";
import { addDays } from "@/lib/domain/dates";

export function NewTaskDialog({
  today,
  prospectId,
  prospects,
  link,
  defaultType = "follow_up",
  defaultTitle = "",
  trigger,
}: {
  today: string;
  prospectId?: string;
  prospects?: { id: string; business_name: string }[];
  /** Also attach the task to an opportunity, client or partner. */
  link?: { opportunity_id?: string; client_id?: string; partner_id?: string };
  defaultType?: TaskType;
  defaultTitle?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    prospect_id: prospectId ?? "",
    task_type: defaultType as TaskType,
    title: defaultTitle,
    due_date: addDays(today, 1),
    due_time: "",
    priority: "medium" as TaskPriority,
    notes: "",
  });
  const { pending, run, fieldErrors } = useAction();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus /> Add follow-up
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New follow-up / task</DialogTitle>
          <DialogDescription>Reminders only — LeadOS never sends messages for you.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {prospects && !prospectId ? (
            <Field label="Prospect" htmlFor="task-prospect" className="sm:col-span-2" hint="Leave empty for an internal task.">
              <NativeSelect id="task-prospect" value={form.prospect_id} onChange={(e) => set("prospect_id", e.target.value)}>
                <option value="">— Internal (no prospect) —</option>
                {prospects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.business_name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <Field label="Type" htmlFor="task-type">
            <NativeSelect id="task-type" value={form.task_type} onChange={(e) => set("task_type", e.target.value as TaskType)}>
              {TASK_TYPES.list.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Priority" htmlFor="task-priority">
            <NativeSelect id="task-priority" value={form.priority} onChange={(e) => set("priority", e.target.value as TaskPriority)}>
              {TASK_PRIORITIES.list.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Title" htmlFor="task-title" className="sm:col-span-2" error={fieldErrors.title?.[0]} required>
            <Input id="task-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Call to discuss requirements" />
          </Field>
          <Field label="Due date" htmlFor="task-due" error={fieldErrors.due_date?.[0]} required>
            <Input id="task-due" type="date" min={today} value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </Field>
          <Field label="Time (optional)" htmlFor="task-time">
            <Input id="task-time" type="time" value={form.due_time} onChange={(e) => set("due_time", e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="task-notes" className="sm:col-span-2">
            <Textarea id="task-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => createTaskAction({ ...form, ...link }), {
                success: "Follow-up added",
                onSuccess: () => {
                  setOpen(false);
                  setForm((f) => ({ ...f, title: defaultTitle, notes: "" }));
                },
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
