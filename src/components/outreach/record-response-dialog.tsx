"use client";

import { useState } from "react";
import { Loader2, MessageSquareReply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Field } from "@/components/ui/misc";
import { RESPONSE_STATUSES, type ResponseStatus } from "@/lib/domain/constants";
import { recordResponseAction } from "@/lib/actions/outreach";
import { useAction } from "@/lib/client/use-action";
import { addDays } from "@/lib/domain/dates";

const EFFECTS: Partial<Record<ResponseStatus, string>> = {
  replied: "Pending automated follow-ups are cancelled, the prospect moves to Replied and a “Reply & qualify” task is added for today.",
  interested: "Pending automated follow-ups are cancelled, the prospect moves to Replied and an urgent “Reply & qualify” task is added.",
  not_interested: "The follow-up sequence stops. Consider moving the prospect to Lost.",
  not_now: "The sequence stops and a follow-up is created on the date you choose.",
  wrong_contact: "The sequence stops and a task to find the right contact is created.",
  no_response: "Nothing changes — scheduled follow-ups continue.",
};

export function RecordResponseDialog({
  messageId,
  today,
  current,
  trigger,
}: {
  messageId: string;
  today: string;
  current: ResponseStatus;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ResponseStatus>(current === "sent" || current === "delivered" ? "replied" : current);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState(addDays(today, 30));
  const { pending, run, fieldErrors } = useAction();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <MessageSquareReply /> Record response
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record response</DialogTitle>
          <DialogDescription>What happened after this message?</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Response" htmlFor="resp-status">
            <NativeSelect id="resp-status" value={status} onChange={(e) => setStatus(e.target.value as ResponseStatus)}>
              {RESPONSE_STATUSES.list.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Date" htmlFor="resp-date" error={fieldErrors.response_date?.[0]}>
            <Input id="resp-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {status === "not_now" ? (
            <Field label="Follow up on" htmlFor="resp-followup" className="sm:col-span-2" error={fieldErrors.follow_up_date?.[0]} hint="When did they ask you to get back in touch?">
              <Input id="resp-followup" type="date" min={today} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
            </Field>
          ) : null}
          <Field label="Notes" htmlFor="resp-notes" className="sm:col-span-2">
            <Textarea id="resp-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did they say?" />
          </Field>
        </div>
        {EFFECTS[status] ? <Alert tone="info">{EFFECTS[status]}</Alert> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  recordResponseAction({
                    message_id: messageId,
                    response_status: status,
                    response_date: date,
                    response_notes: notes,
                    follow_up_date: status === "not_now" ? followUp : null,
                  }),
                { success: "Response recorded", onSuccess: () => setOpen(false) },
              )
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save response
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
