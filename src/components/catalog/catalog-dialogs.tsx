"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import { useMoney, useWorkspace } from "@/components/workspace/workspace-context";
import { DELIVERY_MODELS, PARTNER_STATUSES, PARTNER_TYPES, PRICING_MODELS } from "@/lib/domain/constants";
import { addStarterServicesAction, deletePartnerAction, deleteServiceAction, savePartnerAction, saveServiceAction } from "@/lib/actions/catalog";
import { useAction } from "@/lib/client/use-action";

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const lines = (v: string) =>
  v
    .split(/\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------------

type PartnerValues = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedin_url: string | null;
  location: string | null;
  partner_type: string;
  services: string[];
  notes: string | null;
  status: string;
};

export function PartnerDialog({ partner, trigger }: { partner?: PartnerValues; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: s(partner?.name),
    contact_name: s(partner?.contact_name),
    email: s(partner?.email),
    phone: s(partner?.phone),
    website: s(partner?.website),
    linkedin_url: s(partner?.linkedin_url),
    location: s(partner?.location),
    partner_type: partner?.partner_type ?? "development_agency",
    services: (partner?.services ?? []).join(", "),
    notes: s(partner?.notes),
    status: partner?.status ?? "prospect",
  });
  const { pending, run, fieldErrors } = useAction();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={partner ? "outline" : "default"}>
            {partner ? <Pencil /> : <Plus />} {partner ? "Edit" : "New partner"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{partner ? "Edit partner" : "New partner"}</DialogTitle>
          <DialogDescription>Agencies, freelancers and firms you refer work to or deliver with.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="pa-name" error={fieldErrors.name?.[0]} required>
            <Input id="pa-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Contact person" htmlFor="pa-contact">
            <Input id="pa-contact" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          </Field>
          <Field label="Type" htmlFor="pa-type">
            <NativeSelect id="pa-type" value={form.partner_type} onChange={(e) => set("partner_type", e.target.value)}>
              {PARTNER_TYPES.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Status" htmlFor="pa-status">
            <NativeSelect id="pa-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {PARTNER_STATUSES.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Email" htmlFor="pa-email" error={fieldErrors.email?.[0]}>
            <Input id="pa-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="pa-phone" error={fieldErrors.phone?.[0]}>
            <Input id="pa-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Website" htmlFor="pa-web" error={fieldErrors.website?.[0]}>
            <Input id="pa-web" value={form.website} onChange={(e) => set("website", e.target.value)} />
          </Field>
          <Field label="LinkedIn" htmlFor="pa-li" error={fieldErrors.linkedin_url?.[0]}>
            <Input id="pa-li" value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} />
          </Field>
          <Field label="Location" htmlFor="pa-loc">
            <Input id="pa-loc" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Services they offer" htmlFor="pa-services" hint="Comma-separated" error={fieldErrors.services?.[0]}>
            <Input id="pa-services" value={form.services} onChange={(e) => set("services", e.target.value)} placeholder="e.g. Web apps, SEO, Branding" />
          </Field>
          <Field label="Notes" htmlFor="pa-notes" className="sm:col-span-2" hint="Rates, strengths, how you usually work together">
            <Textarea id="pa-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => savePartnerAction({ ...form, services: lines(form.services), id: partner?.id }), {
                success: "Partner saved",
                onSuccess: (r) => {
                  setOpen(false);
                  if (!partner) router.push(`/partners/${r.id}`);
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

export function DeletePartnerButton({ id }: { id: string }) {
  const router = useRouter();
  const { pending, run } = useAction();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" disabled={pending}>
          <Trash2 /> Delete
        </Button>
      }
      title="Delete this partner?"
      description="Only possible when no opportunities or projects use it — otherwise mark it Inactive."
      confirmLabel="Delete"
      destructive
      onConfirm={() => run(() => deletePartnerAction({ id }), { success: "Partner deleted", onSuccess: () => router.push("/partners") })}
    />
  );
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

type ServiceValues = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  target_customer: string | null;
  typical_problem: string | null;
  delivery_model: string | null;
  pricing_model: string | null;
  default_price: number | string | null;
  discovery_questions: string[];
  notes: string | null;
  active: boolean;
};

export function ServiceDialog({ service, trigger }: { service?: ServiceValues; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { serviceCategories } = useWorkspace();
  const { currency } = useMoney();
  const [form, setForm] = useState({
    name: s(service?.name),
    category: s(service?.category),
    description: s(service?.description),
    target_customer: s(service?.target_customer),
    typical_problem: s(service?.typical_problem),
    delivery_model: s(service?.delivery_model),
    pricing_model: s(service?.pricing_model),
    default_price: s(service?.default_price),
    discovery_questions: (service?.discovery_questions ?? []).join("\n"),
    notes: s(service?.notes),
    active: service?.active ?? true,
  });
  const { pending, run, fieldErrors } = useAction();
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const categoryKnown = !form.category || serviceCategories.some((c) => c.value === form.category);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={service ? "ghost" : "default"}>
            {service ? <Pencil /> : <Plus />} {service ? "Edit" : "New service"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{service ? "Edit service" : "New service"}</DialogTitle>
          <DialogDescription>Something you sell — delivered yourself, through a partner, or referred.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Service name" htmlFor="sv-name" error={fieldErrors.name?.[0]} required>
            <Input id="sv-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Category" htmlFor="sv-cat" hint="Add categories in Settings → Lists">
            <NativeSelect id="sv-cat" value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">None</option>
              {!categoryKnown ? <option value={form.category}>{form.category}</option> : null}
              {serviceCategories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Delivery model" htmlFor="sv-delivery">
            <NativeSelect id="sv-delivery" value={form.delivery_model} onChange={(e) => set("delivery_model", e.target.value)}>
              <option value="">Varies</option>
              {DELIVERY_MODELS.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Pricing model" htmlFor="sv-pricing">
            <NativeSelect id="sv-pricing" value={form.pricing_model} onChange={(e) => set("pricing_model", e.target.value)}>
              <option value="">Not set</option>
              {PRICING_MODELS.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={`Default price (${currency})`} htmlFor="sv-price" error={fieldErrors.default_price?.[0]} hint="Optional starting point for opportunities">
            <Input id="sv-price" inputMode="decimal" value={form.default_price} onChange={(e) => set("default_price", e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
            Active (offered in pickers)
          </label>
          <Field label="Description" htmlFor="sv-desc" className="sm:col-span-2">
            <Textarea id="sv-desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Target customer" htmlFor="sv-target">
            <Textarea id="sv-target" rows={2} value={form.target_customer} onChange={(e) => set("target_customer", e.target.value)} />
          </Field>
          <Field label="Typical problem it solves" htmlFor="sv-problem">
            <Textarea id="sv-problem" rows={2} value={form.typical_problem} onChange={(e) => set("typical_problem", e.target.value)} />
          </Field>
          <Field label="Discovery questions" htmlFor="sv-questions" className="sm:col-span-2" hint="One per line">
            <Textarea id="sv-questions" rows={3} value={form.discovery_questions} onChange={(e) => set("discovery_questions", e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="sv-notes" className="sm:col-span-2">
            <Textarea id="sv-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  saveServiceAction({
                    ...form,
                    discovery_questions: form.discovery_questions
                      .split("\n")
                      .map((q) => q.trim())
                      .filter(Boolean),
                    id: service?.id,
                  }),
                { success: "Service saved", onSuccess: () => setOpen(false) },
              )
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

export function DeleteServiceButton({ id, name }: { id: string; name: string }) {
  const { pending, run } = useAction();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${name}`} disabled={pending}>
          <Trash2 />
        </Button>
      }
      title={`Delete “${name}”?`}
      description="Opportunities and projects that use it keep their data but lose the service link. Consider marking it inactive instead."
      confirmLabel="Delete"
      destructive
      onConfirm={() => run(() => deleteServiceAction({ id }), { success: "Service deleted" })}
    />
  );
}

export function StarterServicesButton() {
  const { pending, run } = useAction();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => run(() => addStarterServicesAction(), { success: (r) => (r.count ? `Added ${r.count} starter services` : "Starter services already added") })}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add starter services
    </Button>
  );
}
