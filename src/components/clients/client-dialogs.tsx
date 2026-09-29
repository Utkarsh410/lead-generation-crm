"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Field } from "@/components/ui/misc";
import { TermsFields, termsFromRow, type TermsState } from "@/components/commercial/terms-fields";
import { useMoney } from "@/components/workspace/workspace-context";
import {
  CLIENT_STATUSES,
  DELIVERY_MODELS,
  PAYMENT_FLOWS,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  PROJECT_STATUSES,
} from "@/lib/domain/constants";
import {
  addPaymentAction,
  createClientAction,
  createProjectAction,
  deletePaymentAction,
  updateClientAction,
  updatePaymentAction,
  updateProjectAction,
} from "@/lib/actions/clients";
import { convertToClientAction } from "@/lib/actions/pipeline";
import { useAction } from "@/lib/client/use-action";
import type { PickerOption } from "@/components/opportunities/opportunity-dialog";

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

type ClientValues = {
  id?: string;
  company: string;
  primary_contact: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
  notes: string | null;
  status: string;
};

export function ClientDialog({ client, trigger }: { client?: ClientValues; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company: s(client?.company),
    primary_contact: s(client?.primary_contact),
    email: s(client?.email),
    phone: s(client?.phone),
    website: s(client?.website),
    industry: s(client?.industry),
    location: s(client?.location),
    notes: s(client?.notes),
    status: client?.status ?? "active",
  });
  const { pending, run, fieldErrors } = useAction();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={client ? "outline" : "default"}>
            {client ? <Pencil /> : <Plus />} {client ? "Edit" : "New client"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{client ? "Edit client" : "New client"}</DialogTitle>
          <DialogDescription>Clients usually come from won opportunities (“Convert to client”), but you can add one directly.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company" htmlFor="c-company" error={fieldErrors.company?.[0]} required>
            <Input id="c-company" value={form.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="Status" htmlFor="c-status">
            <NativeSelect id="c-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {CLIENT_STATUSES.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Primary contact" htmlFor="c-contact">
            <Input id="c-contact" value={form.primary_contact} onChange={(e) => set("primary_contact", e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="c-email" error={fieldErrors.email?.[0]}>
            <Input id="c-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="c-phone" error={fieldErrors.phone?.[0]}>
            <Input id="c-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Website" htmlFor="c-website" error={fieldErrors.website?.[0]}>
            <Input id="c-website" value={form.website} onChange={(e) => set("website", e.target.value)} />
          </Field>
          <Field label="Industry" htmlFor="c-industry">
            <Input id="c-industry" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
          </Field>
          <Field label="Location" htmlFor="c-location">
            <Input id="c-location" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="c-notes" className="sm:col-span-2">
            <Textarea id="c-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              client?.id
                ? run(() => updateClientAction({ ...form, id: client.id }), { success: "Client saved", onSuccess: () => setOpen(false) })
                : run(() => createClientAction(form), { success: "Client created", onSuccess: (r) => router.push(`/clients/${r.id}`) })
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

// ---------------------------------------------------------------------------
// Convert prospect → client
// ---------------------------------------------------------------------------

export function ConvertToClientButton({
  prospectId,
  wonOpportunities,
  label = "Convert to client",
  variant = "default",
}: {
  prospectId: string;
  wonOpportunities: { id: string; title: string }[];
  label?: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [opportunityId, setOpportunityId] = useState(wonOpportunities[0]?.id ?? "");
  const { pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          <Building2 /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to client</DialogTitle>
          <DialogDescription>Creates the client record (once) and, optionally, a project from a won opportunity — copying its service, partner, value and commercial terms.</DialogDescription>
        </DialogHeader>
        <Field label="Create a project from" htmlFor="conv-opp">
          <NativeSelect id="conv-opp" value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
            <option value="">No project yet</option>
            {wonOpportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => convertToClientAction({ prospect_id: prospectId, opportunity_id: opportunityId || null, create_project: Boolean(opportunityId) }), {
                success: (r) => (r.projectId ? "Client and project created" : r.created ? "Client created" : "Already a client"),
                onSuccess: (r) => router.push(r.projectId ? `/projects/${r.projectId}` : `/clients/${r.clientId}`),
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

type ProjectValues = {
  id?: string;
  name: string;
  client_id: string;
  opportunity_id: string | null;
  service_id: string | null;
  partner_id: string | null;
  delivery_model: string | null;
  total_project_value: number | string | null;
  start_date: string | null;
  expected_end_date: string | null;
  status: string;
  notes: string | null;
  payment_flow: string;
  partner_cost: number | string | null;
  commission_received: number | string | null;
} & Parameters<typeof termsFromRow>[0];

export function ProjectDialog({
  project,
  clientId,
  clients,
  services,
  partners,
  trigger,
}: {
  project?: ProjectValues;
  clientId?: string;
  clients?: PickerOption[];
  services: PickerOption[];
  partners: PickerOption[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { currency } = useMoney();
  const [form, setForm] = useState({
    name: s(project?.name),
    client_id: project?.client_id ?? clientId ?? clients?.[0]?.id ?? "",
    opportunity_id: s(project?.opportunity_id),
    service_id: s(project?.service_id),
    partner_id: s(project?.partner_id),
    delivery_model: s(project?.delivery_model),
    total_project_value: s(project?.total_project_value),
    start_date: s(project?.start_date),
    expected_end_date: s(project?.expected_end_date),
    status: project?.status ?? "not_started",
    notes: s(project?.notes),
    payment_flow: project?.payment_flow ?? "client_pays_me",
    partner_cost: s(project?.partner_cost),
    commission_received: s(project?.commission_received),
  });
  const [terms, setTerms] = useState<TermsState>(termsFromRow(project ?? {}));
  const { pending, run, fieldErrors } = useAction();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={project ? "outline" : "default"}>
            {project ? <Pencil /> : <Plus />} {project ? "Edit" : "New project"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>Record how it&apos;s delivered and how money flows — nothing is assumed.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Project name" htmlFor="p-name" className="sm:col-span-2" error={fieldErrors.name?.[0]} required>
            <Input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Status" htmlFor="p-status">
            <NativeSelect id="p-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {PROJECT_STATUSES.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {clients && !clientId ? (
            <Field label="Client" htmlFor="p-client" error={fieldErrors.client_id?.[0]} required>
              <NativeSelect id="p-client" value={form.client_id} onChange={(e) => set("client_id", e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <Field label="Service" htmlFor="p-service">
            <NativeSelect id="p-service" value={form.service_id} onChange={(e) => set("service_id", e.target.value)}>
              <option value="">Not set</option>
              {services.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Delivery model" htmlFor="p-delivery">
            <NativeSelect id="p-delivery" value={form.delivery_model} onChange={(e) => set("delivery_model", e.target.value)}>
              <option value="">Not set</option>
              {DELIVERY_MODELS.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Partner" htmlFor="p-partner">
            <NativeSelect id="p-partner" value={form.partner_id} onChange={(e) => set("partner_id", e.target.value)}>
              <option value="">None</option>
              {partners.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={`Total project value (${currency})`} htmlFor="p-value" error={fieldErrors.total_project_value?.[0]}>
            <Input id="p-value" inputMode="decimal" value={form.total_project_value} onChange={(e) => set("total_project_value", e.target.value)} />
          </Field>
          <Field label="Start date" htmlFor="p-start">
            <Input id="p-start" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </Field>
          <Field label="Expected end" htmlFor="p-end" error={fieldErrors.expected_end_date?.[0]}>
            <Input id="p-end" type="date" value={form.expected_end_date} onChange={(e) => set("expected_end_date", e.target.value)} />
          </Field>
        </div>
        <div className="rounded-md border p-3">
          <p className="mb-2 text-sm font-medium">Money flow</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Who does the client pay?" htmlFor="p-flow">
              <NativeSelect id="p-flow" value={form.payment_flow} onChange={(e) => set("payment_flow", e.target.value)}>
                {PAYMENT_FLOWS.list.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {form.payment_flow === "client_pays_me" ? (
              <Field label={`Partner cost (${currency})`} htmlFor="p-cost" hint="What you pay the partner for delivery" error={fieldErrors.partner_cost?.[0]}>
                <Input id="p-cost" inputMode="decimal" value={form.partner_cost} onChange={(e) => set("partner_cost", e.target.value)} />
              </Field>
            ) : null}
            <Field label={`Commission received (${currency})`} htmlFor="p-crec" hint="Commission actually paid to you so far" error={fieldErrors.commission_received?.[0]}>
              <Input id="p-crec" inputMode="decimal" value={form.commission_received} onChange={(e) => set("commission_received", e.target.value)} />
            </Field>
          </div>
          {form.payment_flow === "client_pays_partner" ? (
            <Alert tone="info" className="mt-3">
              Record the client&apos;s payments to the partner as payments on this project — commission on “Amount Received” is calculated from them.
            </Alert>
          ) : null}
        </div>
        <div className="rounded-md border p-3">
          <p className="mb-2 text-sm font-medium">Commercial terms</p>
          <TermsFields value={terms} onChange={setTerms} errors={fieldErrors} showCustomBase />
        </div>
        <Field label="Notes" htmlFor="p-notes">
          <Textarea id="p-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              const payload = { ...form, ...terms };
              if (project?.id) run(() => updateProjectAction({ ...payload, id: project.id }), { success: "Project saved", onSuccess: () => setOpen(false) });
              else run(() => createProjectAction(payload), { success: "Project created", onSuccess: (r) => router.push(`/projects/${r.id}`) });
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

type PaymentValues = { id: string; payment_date: string; amount: number | string; payment_type: string; status: string; reference: string | null; notes: string | null };

export function PaymentDialog({ projectId, payment, today, trigger }: { projectId: string; payment?: PaymentValues; today: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { currency } = useMoney();
  const [form, setForm] = useState({
    payment_date: payment?.payment_date ?? today,
    amount: s(payment?.amount),
    payment_type: payment?.payment_type ?? "milestone",
    status: payment?.status ?? "received",
    reference: s(payment?.reference),
    notes: s(payment?.notes),
  });
  const { pending, run, fieldErrors } = useAction();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus /> Add payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{payment ? "Edit payment" : "Add payment"}</DialogTitle>
          <DialogDescription>A client payment towards this project (expected or received).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Amount (${currency})`} htmlFor="pm-amount" error={fieldErrors.amount?.[0]} required>
            <Input id="pm-amount" inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </Field>
          <Field label="Date" htmlFor="pm-date" error={fieldErrors.payment_date?.[0]}>
            <Input id="pm-date" type="date" value={form.payment_date} onChange={(e) => set("payment_date", e.target.value)} />
          </Field>
          <Field label="Type" htmlFor="pm-type">
            <NativeSelect id="pm-type" value={form.payment_type} onChange={(e) => set("payment_type", e.target.value)}>
              {PAYMENT_TYPES.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Status" htmlFor="pm-status">
            <NativeSelect id="pm-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {PAYMENT_STATUSES.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Reference" htmlFor="pm-ref" className="sm:col-span-2">
            <Input id="pm-ref" value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Invoice / UTR / transaction id" />
          </Field>
          <Field label="Notes" htmlFor="pm-notes" className="sm:col-span-2">
            <Textarea id="pm-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              payment
                ? run(() => updatePaymentAction({ ...form, id: payment.id, project_id: projectId }), { success: "Payment saved", onSuccess: () => setOpen(false) })
                : run(() => addPaymentAction({ ...form, project_id: projectId }), {
                    success: "Payment added",
                    onSuccess: () => {
                      setOpen(false);
                      setForm((f) => ({ ...f, amount: "", reference: "", notes: "" }));
                    },
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

export function DeletePaymentButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Delete payment" disabled={pending}>
          <Trash2 />
        </Button>
      }
      title="Delete this payment?"
      description="Commission and revenue totals will be recalculated."
      confirmLabel="Delete"
      destructive
      onConfirm={() => run(() => deletePaymentAction({ id }), { success: "Payment deleted" })}
    />
  );
}
