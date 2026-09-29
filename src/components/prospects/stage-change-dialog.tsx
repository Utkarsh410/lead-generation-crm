"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Field } from "@/components/ui/misc";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/domain/constants";
import { moveOpportunityAction, setLeadStatusAction } from "@/lib/actions/pipeline";
import { useAction } from "@/lib/client/use-action";
import type { PipelineStageRow } from "@/lib/data/workspace";

const LEAD_HINTS: Partial<Record<LeadStatus, string>> = {
  qualified: "If the lead has no opportunity yet, one is created in the Qualified stage.",
  nurture: "Stops the automated follow-up sequence. Add a re-engagement follow-up so it doesn't go cold.",
  lost: "Stops the automated follow-up sequence.",
  client: "Usually set by “Convert to client” when a deal is won.",
};

/** Change a prospect's lead status. */
export function LeadStatusDialog({ prospectId, current, trigger }: { prospectId: string; current: LeadStatus; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<LeadStatus>(current);
  const [lostReason, setLostReason] = useState("");
  const { pending, run } = useAction();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setTo(current);
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lead status</DialogTitle>
          <DialogDescription>Currently {LEAD_STATUSES.label(current)}. Deals are tracked separately on opportunities.</DialogDescription>
        </DialogHeader>
        <Field label="Move to" htmlFor="lead-status-to">
          <NativeSelect id="lead-status-to" value={to} onChange={(e) => setTo(e.target.value as LeadStatus)}>
            {LEAD_STATUSES.list.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
                {s.value === current ? " (current)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {LEAD_HINTS[to] && to !== current ? <Alert tone="info">{LEAD_HINTS[to]}</Alert> : null}
        {to === "lost" ? (
          <Field label="Why was it lost?" htmlFor="lead-lost-reason">
            <Textarea id="lead-lost-reason" rows={2} value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
          </Field>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || to === current}
            onClick={() =>
              run(() => setLeadStatusAction({ prospect_id: prospectId, to, lost_reason: to === "lost" ? lostReason : null }), {
                success: `Lead status: ${LEAD_STATUSES.label(to)}`,
                onSuccess: () => setOpen(false),
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Move an opportunity to another pipeline stage (optionally scheduling a call / recording a loss). */
export function OpportunityStageDialog({
  opportunityId,
  currentStageId,
  stages,
  today,
  initialStageId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onMoved,
}: {
  opportunityId: string;
  currentStageId: string;
  stages: PipelineStageRow[];
  today: string;
  initialStageId?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  onMoved?: (result: { suggestClient: boolean; prospectId: string }) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [to, setTo] = useState(initialStageId ?? currentStageId);
  const [callDate, setCallDate] = useState("");
  const [callTime, setCallTime] = useState("");
  const [lostReason, setLostReason] = useState("");
  const { pending, run } = useAction();
  const target = stages.find((s) => s.id === to);
  const current = stages.find((s) => s.id === currentStageId);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setTo(initialStageId ?? currentStageId);
        setOpen(o);
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move opportunity</DialogTitle>
          <DialogDescription>Currently {current?.label ?? "—"}. The move is recorded in the prospect&apos;s activity history.</DialogDescription>
        </DialogHeader>
        <Field label="Move to" htmlFor="opp-stage-to">
          <NativeSelect id="opp-stage-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.id === currentStageId ? " (current)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {target?.key === "discovery" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Call date (optional)" htmlFor="call-date">
              <Input id="call-date" type="date" min={today} value={callDate} onChange={(e) => setCallDate(e.target.value)} />
            </Field>
            <Field label="Time" htmlFor="call-time">
              <Input id="call-time" type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)} />
            </Field>
          </div>
        ) : null}
        {target?.key === "proposal" ? <Alert tone="info">A proposal follow-up reminder is created for 3 days from today.</Alert> : null}
        {target?.kind === "won" ? <Alert tone="success">Next you can convert the prospect into a client and create the project.</Alert> : null}
        {target?.kind === "lost" ? (
          <Field label="Why was it lost?" htmlFor="opp-lost-reason">
            <Textarea id="opp-lost-reason" rows={2} value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
          </Field>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || to === currentStageId}
            onClick={() =>
              run(
                () =>
                  moveOpportunityAction({
                    id: opportunityId,
                    stage_id: to,
                    discovery_call_date: target?.key === "discovery" ? callDate : null,
                    discovery_call_time: target?.key === "discovery" ? callTime : null,
                    lost_reason: target?.kind === "lost" ? lostReason : null,
                  }),
                {
                  success: `Moved to ${target?.label}`,
                  onSuccess: (r) => {
                    setOpen(false);
                    onMoved?.(r);
                  },
                },
              )
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Move to {target?.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
