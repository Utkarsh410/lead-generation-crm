"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Field } from "@/components/ui/misc";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/domain/constants";
import { changeStageAction } from "@/lib/actions/pipeline";
import { useAction } from "@/lib/client/use-action";

const HINTS: Partial<Record<PipelineStage, string>> = {
  qualified: "Creates an opportunity record and a “Prepare handoff” reminder.",
  discovery_call: "Optionally schedule the call — it will appear in Follow-ups.",
  proposal_sent: "Creates a proposal follow-up reminder in 3 days.",
  won: "Closes the opportunity as won and stops automated follow-ups.",
  lost: "Closes the opportunity and stops automated follow-ups.",
};

export function StageChangeDialog({
  prospectId,
  current,
  today,
  initialStage,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  prospectId: string;
  current: PipelineStage;
  today: string;
  initialStage?: PipelineStage;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [to, setTo] = useState<PipelineStage>(initialStage ?? current);
  const [callDate, setCallDate] = useState("");
  const [callTime, setCallTime] = useState("");
  const [lostReason, setLostReason] = useState("");
  const { pending, run } = useAction();

  function submit() {
    run(
      () =>
        changeStageAction({
          prospect_id: prospectId,
          to,
          discovery_call_date: to === "discovery_call" ? callDate : null,
          discovery_call_time: to === "discovery_call" ? callTime : null,
          lost_reason: to === "lost" ? lostReason : null,
        }),
      { success: `Moved to ${PIPELINE_STAGES.label(to)}`, onSuccess: () => setOpen(false) },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setTo(initialStage ?? current);
        setOpen(o);
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change stage</DialogTitle>
          <DialogDescription>Currently {PIPELINE_STAGES.label(current)}. The change is recorded in the activity history.</DialogDescription>
        </DialogHeader>
        <Field label="Move to" htmlFor="stage-to">
          <NativeSelect id="stage-to" value={to} onChange={(e) => setTo(e.target.value as PipelineStage)}>
            {PIPELINE_STAGES.list.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
                {s.value === current ? " (current)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {HINTS[to] && to !== current ? <Alert tone="info">{HINTS[to]}</Alert> : null}
        {to === "discovery_call" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Call date" htmlFor="call-date">
              <Input id="call-date" type="date" min={today} value={callDate} onChange={(e) => setCallDate(e.target.value)} />
            </Field>
            <Field label="Time (optional)" htmlFor="call-time">
              <Input id="call-time" type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)} />
            </Field>
          </div>
        ) : null}
        {to === "lost" ? (
          <Field label="Why was it lost?" htmlFor="lost-reason" hint="Helps you learn which prospects to prioritise.">
            <Textarea id="lost-reason" rows={2} value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
          </Field>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || to === current}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Move to {PIPELINE_STAGES.label(to)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
