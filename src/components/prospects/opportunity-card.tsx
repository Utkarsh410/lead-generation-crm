"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Field } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { OPPORTUNITY_STATUSES, PROJECT_TYPES, type OpportunityStatus, type ProjectType } from "@/lib/domain/constants";
import { commissionOnReceived, commissionOutstanding, referenceTier } from "@/lib/domain/commission";
import { formatINR, parseMoney } from "@/lib/domain/money";
import { updateOpportunityAction } from "@/lib/actions/pipeline";
import { useAction } from "@/lib/client/use-action";
import type { Tables } from "@/lib/supabase/database.types";

type Opp = Tables<"opportunities">;
const str = (v: number | string | null) => (v === null ? "" : String(v));

export function OpportunityCard({ opp }: { opp: Opp }) {
  const earned = commissionOnReceived(opp.eligible_amount_received, opp.agreed_commission_pct);
  const outstanding = commissionOutstanding(earned, opp.commission_paid);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{opp.title}</p>
          <p className="text-xs text-muted-foreground">
            {opp.project_type ? PROJECT_TYPES.label(opp.project_type as ProjectType) : "Project type not set"}
          </p>
        </div>
        <Badge tone={opp.status === "won" ? "green" : opp.status === "lost" ? "red" : "blue"}>{OPPORTUNITY_STATUSES.label(opp.status)}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Estimated value</dt>
        <dd className="text-right tabular-nums">{formatINR(opp.estimated_value)}</dd>
        <dt className="text-muted-foreground">Eligible project amount</dt>
        <dd className="text-right tabular-nums">{formatINR(opp.eligible_project_amount)}</dd>
        <dt className="text-muted-foreground">Agreed commission</dt>
        <dd className="text-right tabular-nums">{opp.agreed_commission_pct !== null ? `${opp.agreed_commission_pct}%` : "Not agreed yet"}</dd>
        <dt className="text-muted-foreground">Received by BharatCoder</dt>
        <dd className="text-right tabular-nums">{formatINR(opp.eligible_amount_received)}</dd>
        <dt className="text-muted-foreground">Commission earned</dt>
        <dd className="text-right font-medium tabular-nums">{earned === null ? "—" : formatINR(earned)}</dd>
        <dt className="text-muted-foreground">Commission paid / due</dt>
        <dd className="text-right tabular-nums">
          {formatINR(opp.commission_paid)} / {outstanding === null ? "—" : formatINR(outstanding)}
        </dd>
      </dl>
      <OpportunityDialog opp={opp} />
    </div>
  );
}

function OpportunityDialog({ opp }: { opp: Opp }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: opp.title,
    project_type: opp.project_type ?? "",
    status: opp.status as OpportunityStatus,
    estimated_value: str(opp.estimated_value),
    eligible_project_amount: str(opp.eligible_project_amount),
    agreed_commission_pct: str(opp.agreed_commission_pct),
    eligible_amount_received: str(opp.eligible_amount_received),
    commission_paid: str(opp.commission_paid),
    pass_through_notes: opp.pass_through_notes ?? "",
    expected_close_date: opp.expected_close_date ?? "",
    notes: opp.notes ?? "",
  });
  const { pending, run, fieldErrors } = useAction();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  let amount: string | null = null;
  try {
    amount = parseMoney(form.eligible_project_amount || form.estimated_value);
  } catch {
    amount = null;
  }
  const tier = referenceTier(amount);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil /> Update deal &amp; commission
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Opportunity</DialogTitle>
          <DialogDescription>Amounts exclude GST, hosting, domains, paid APIs, licences and other pass-through costs.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" htmlFor="o-title" className="sm:col-span-2" error={fieldErrors.title?.[0]}>
            <Input id="o-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Project type" htmlFor="o-type">
            <NativeSelect id="o-type" value={form.project_type} onChange={(e) => set("project_type", e.target.value)}>
              <option value="">Not set</option>
              {PROJECT_TYPES.list.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Status" htmlFor="o-status">
            <NativeSelect id="o-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {OPPORTUNITY_STATUSES.list.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Estimated value (₹)" htmlFor="o-est" error={fieldErrors.estimated_value?.[0]}>
            <Input id="o-est" inputMode="decimal" value={form.estimated_value} onChange={(e) => set("estimated_value", e.target.value)} />
          </Field>
          <Field label="Eligible project amount (₹)" htmlFor="o-amt" error={fieldErrors.eligible_project_amount?.[0]} hint="Final agreed amount, excluding pass-through costs">
            <Input id="o-amt" inputMode="decimal" value={form.eligible_project_amount} onChange={(e) => set("eligible_project_amount", e.target.value)} />
          </Field>
          <Field
            label="Agreed commission %"
            htmlFor="o-pct"
            error={fieldErrors.agreed_commission_pct?.[0]}
            hint={tier ? `Reference tier: ${tier.tier_name} ${tier.percentage}% — enter what was actually agreed.` : "Enter the percentage actually agreed for this project."}
          >
            <Input id="o-pct" inputMode="decimal" value={form.agreed_commission_pct} onChange={(e) => set("agreed_commission_pct", e.target.value)} />
          </Field>
          <Field label="Eligible amount received by BharatCoder (₹)" htmlFor="o-rcv" error={fieldErrors.eligible_amount_received?.[0]}>
            <Input id="o-rcv" inputMode="decimal" value={form.eligible_amount_received} onChange={(e) => set("eligible_amount_received", e.target.value)} />
          </Field>
          <Field label="Commission paid to you (₹)" htmlFor="o-paid" error={fieldErrors.commission_paid?.[0]}>
            <Input id="o-paid" inputMode="decimal" value={form.commission_paid} onChange={(e) => set("commission_paid", e.target.value)} />
          </Field>
          <Field label="Expected close date" htmlFor="o-close">
            <Input id="o-close" type="date" value={form.expected_close_date} onChange={(e) => set("expected_close_date", e.target.value)} />
          </Field>
          <Field label="Pass-through notes" htmlFor="o-pt" className="sm:col-span-2">
            <Textarea id="o-pt" rows={2} value={form.pass_through_notes} onChange={(e) => set("pass_through_notes", e.target.value)} placeholder="Hosting, domains, paid APIs billed separately…" />
          </Field>
          <Field label="Notes" htmlFor="o-notes" className="sm:col-span-2">
            <Textarea id="o-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <Alert tone="info">Commission is calculated only from the agreed % × eligible amount actually received — never automatically from project size.</Alert>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => run(() => updateOpportunityAction({ ...form, id: opp.id }), { success: "Opportunity saved", onSuccess: () => setOpen(false) })}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
