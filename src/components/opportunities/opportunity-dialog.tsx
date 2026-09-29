"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import { TermsFields, termsFromRow, type TermsState } from "@/components/commercial/terms-fields";
import { useMoney } from "@/components/workspace/workspace-context";
import { DELIVERY_MODELS, PROJECT_TYPES } from "@/lib/domain/constants";
import { createOpportunityAction, updateOpportunityAction } from "@/lib/actions/pipeline";
import { useAction } from "@/lib/client/use-action";
import type { PipelineStageRow } from "@/lib/data/workspace";

export type PickerOption = { id: string; name: string };

type OpportunityValues = {
  id?: string;
  title: string;
  service_id: string | null;
  description: string | null;
  estimated_value: number | string | null;
  expected_close_date: string | null;
  probability: number | null;
  delivery_model: string | null;
  partner_id: string | null;
  project_type: string | null;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  stage_id?: string;
} & Parameters<typeof termsFromRow>[0];

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function OpportunityDialog({
  prospectId,
  prospects,
  opportunity,
  services,
  partners,
  stages,
  defaults,
  trigger,
}: {
  prospectId?: string;
  /** Prospect picker when creating outside a prospect page. */
  prospects?: { id: string; business_name: string }[];
  opportunity?: OpportunityValues;
  services: PickerOption[];
  partners: PickerOption[];
  stages?: PipelineStageRow[];
  defaults?: Partial<OpportunityValues>;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const editing = Boolean(opportunity?.id);
  const init = opportunity ?? defaults ?? {};
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: s(init.title),
    service_id: s(init.service_id),
    description: s(init.description),
    estimated_value: s(init.estimated_value),
    expected_close_date: s(init.expected_close_date),
    probability: s(init.probability),
    delivery_model: s(init.delivery_model),
    partner_id: s(init.partner_id),
    project_type: s(init.project_type),
    next_action: s(init.next_action),
    next_action_date: s(init.next_action_date),
    notes: s(init.notes),
    stage_id: s(init.stage_id) || (stages?.find((x) => x.key === "new")?.id ?? ""),
  });
  const [pickedProspect, setPickedProspect] = useState(prospectId ?? "");
  const [terms, setTerms] = useState<TermsState>(termsFromRow(init));
  const { pending, run, fieldErrors } = useAction();
  const { currency } = useMoney();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const needsPartner = ["partner_delivered", "referral", "white_label", "joint_delivery"].includes(form.delivery_model);

  function submit() {
    const payload = { ...form, ...terms };
    if (editing) {
      run(() => updateOpportunityAction({ ...payload, id: opportunity!.id }), { success: "Opportunity saved", onSuccess: () => setOpen(false) });
    } else {
      run(() => createOpportunityAction({ ...payload, prospect_id: prospectId ?? pickedProspect }), {
        success: "Opportunity created",
        onSuccess: (row) => {
          setOpen(false);
          router.push(`/opportunities/${row.id}`);
        },
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={editing ? "outline" : "default"}>
            {editing ? <Pencil /> : <Plus />} {editing ? "Edit" : "New opportunity"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit opportunity" : "New opportunity"}</DialogTitle>
          <DialogDescription>A prospect can have several opportunities — e.g. a website now and a booking system later.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {!editing && !prospectId && prospects ? (
            <Field label="Prospect" htmlFor="o-prospect" className="sm:col-span-2 lg:col-span-3" error={fieldErrors.prospect_id?.[0]} required>
              <NativeSelect id="o-prospect" value={pickedProspect} onChange={(e) => setPickedProspect(e.target.value)}>
                <option value="">Choose a prospect…</option>
                {prospects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.business_name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <Field label="Opportunity name" htmlFor="o-title" className="sm:col-span-2" error={fieldErrors.title?.[0]} required>
            <Input id="o-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Website redesign" />
          </Field>
          {!editing && stages ? (
            <Field label="Stage" htmlFor="o-stage">
              <NativeSelect id="o-stage" value={form.stage_id} onChange={(e) => set("stage_id", e.target.value)}>
                {stages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <Field label="Service" htmlFor="o-service" hint={services.length ? undefined : "Add services in Services"}>
            <NativeSelect id="o-service" value={form.service_id} onChange={(e) => set("service_id", e.target.value)}>
              <option value="">Not set</option>
              {services.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={`Estimated value (${currency})`} htmlFor="o-value" error={fieldErrors.estimated_value?.[0]}>
            <Input id="o-value" inputMode="decimal" value={form.estimated_value} onChange={(e) => set("estimated_value", e.target.value)} placeholder="e.g. 150000 or 1.5L" />
          </Field>
          <Field label="Probability %" htmlFor="o-prob" hint="Blank = stage default" error={fieldErrors.probability?.[0]}>
            <Input id="o-prob" inputMode="numeric" value={form.probability} onChange={(e) => set("probability", e.target.value)} />
          </Field>
          <Field label="Expected close" htmlFor="o-close" error={fieldErrors.expected_close_date?.[0]}>
            <Input id="o-close" type="date" value={form.expected_close_date} onChange={(e) => set("expected_close_date", e.target.value)} />
          </Field>
          <Field label="Delivery model" htmlFor="o-delivery">
            <NativeSelect id="o-delivery" value={form.delivery_model} onChange={(e) => set("delivery_model", e.target.value)}>
              <option value="">Not decided</option>
              {DELIVERY_MODELS.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Partner" htmlFor="o-partner" hint={needsPartner && !form.partner_id ? "This delivery model usually involves a partner" : undefined}>
            <NativeSelect id="o-partner" value={form.partner_id} onChange={(e) => set("partner_id", e.target.value)}>
              <option value="">None</option>
              {partners.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Project type" htmlFor="o-ptype">
            <NativeSelect id="o-ptype" value={form.project_type} onChange={(e) => set("project_type", e.target.value)}>
              <option value="">Not set</option>
              {PROJECT_TYPES.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Next action" htmlFor="o-next" className="sm:col-span-2">
            <Input id="o-next" value={form.next_action} onChange={(e) => set("next_action", e.target.value)} placeholder="e.g. Send proposal draft" />
          </Field>
          <Field label="Next action date" htmlFor="o-next-date">
            <Input id="o-next-date" type="date" value={form.next_action_date} onChange={(e) => set("next_action_date", e.target.value)} />
          </Field>
          <Field label="Description / requirements" htmlFor="o-desc" className="sm:col-span-2 lg:col-span-3">
            <Textarea id="o-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
        <div className="rounded-md border p-3">
          <p className="mb-2 text-sm font-medium">Commercial terms</p>
          <TermsFields value={terms} onChange={setTerms} errors={fieldErrors} />
        </div>
        <Field label="Notes" htmlFor="o-notes">
          <Textarea id="o-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {editing ? "Save" : "Create opportunity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
