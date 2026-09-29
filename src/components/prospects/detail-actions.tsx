"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, Handshake, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import { addContactAction, addNoteAction, deleteContactAction, setArchivedAction } from "@/lib/actions/prospects";
import { createHandoffAction } from "@/lib/actions/pipeline";
import { useAction } from "@/lib/client/use-action";

export function ArchiveButton({ prospectId, archived }: { prospectId: string; archived: boolean }) {
  const { pending, run } = useAction();
  if (archived) {
    return (
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setArchivedAction({ ids: [prospectId], archived: false }), { success: "Prospect restored" })}>
        <ArchiveRestore /> Restore
      </Button>
    );
  }
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" disabled={pending}>
          <Archive /> Archive
        </Button>
      }
      title="Archive this prospect?"
      description="It will be hidden from lists, the pipeline and analytics, and its open follow-ups will be cancelled. You can restore it later."
      confirmLabel="Archive"
      destructive
      onConfirm={() => run(() => setArchivedAction({ ids: [prospectId], archived: true }), { success: "Prospect archived" })}
    />
  );
}

export function PrepareHandoffButton({
  prospectId,
  opportunities = [],
  partners = [],
  defaultOpportunityId,
  variant = "outline",
  size = "sm",
  label = "Prepare handoff",
}: {
  prospectId: string;
  opportunities?: { id: string; title: string; partner_id: string | null }[];
  partners?: { id: string; name: string }[];
  defaultOpportunityId?: string;
  variant?: "default" | "outline";
  size?: "sm" | "default";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const initialOpp = defaultOpportunityId ?? opportunities[0]?.id ?? "";
  const [opportunityId, setOpportunityId] = useState(initialOpp);
  const [partnerId, setPartnerId] = useState(opportunities.find((o) => o.id === initialOpp)?.partner_id ?? "");
  const { pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Handshake /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prepare partner handoff</DialogTitle>
          <DialogDescription>
            Generates a copyable “Opportunity Handoff” summary from the prospect, the opportunity and the latest qualification. You can edit it before sharing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Opportunity" htmlFor="handoff-opp">
            <NativeSelect
              id="handoff-opp"
              value={opportunityId}
              onChange={(e) => {
                setOpportunityId(e.target.value);
                const p = opportunities.find((o) => o.id === e.target.value)?.partner_id;
                if (p) setPartnerId(p);
              }}
            >
              <option value="">None (prospect only)</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Partner" htmlFor="handoff-partner" hint={partners.length ? undefined : "Add partners under Partners"}>
            <NativeSelect id="handoff-partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
              <option value="">Not chosen yet</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Notes for the partner (optional)" htmlFor="handoff-notes">
          <Textarea
            id="handoff-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Client wants to discuss requirements this week."
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => createHandoffAction({ prospect_id: prospectId, opportunity_id: opportunityId || null, partner_id: partnerId || null, notes }), {
                success: "Handoff prepared",
                onSuccess: (d) => router.push(`/handoffs/${d.id}`),
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Generate handoff
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NoteForm({ prospectId }: { prospectId: string }) {
  const [note, setNote] = useState("");
  const { pending, run } = useAction();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!note.trim()) return;
        run(() => addNoteAction({ prospect_id: prospectId, details: note }), { success: "Note added", onSuccess: () => setNote("") });
      }}
    >
      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (call summary, observation…)" aria-label="Add note" />
      <div className="flex justify-end">
        <Button size="sm" type="submit" disabled={pending || !note.trim()}>
          Add note
        </Button>
      </div>
    </form>
  );
}

export function ContactsEditor({
  prospectId,
  contacts,
}: {
  prospectId: string;
  contacts: { id: string; name: string; job_title: string | null; email: string | null; phone: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", job_title: "", email: "", phone: "" });
  const { pending, run, fieldErrors } = useAction();
  return (
    <div className="space-y-2">
      {contacts.length ? (
        <ul className="divide-y text-sm">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <p className="font-medium">
                  {c.name} {c.job_title ? <span className="font-normal text-muted-foreground">· {c.job_title}</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ") || "No details"}</p>
              </div>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${c.name}`}>
                    <Trash2 />
                  </Button>
                }
                title={`Remove ${c.name}?`}
                description="This removes the additional contact from the prospect."
                confirmLabel="Remove"
                destructive
                onConfirm={() => run(() => deleteContactAction({ id: c.id, prospect_id: prospectId }), { success: "Contact removed" })}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No additional contacts.</p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost">
            <Plus /> Add contact
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add contact</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Name" htmlFor="c-name" error={fieldErrors.name?.[0]} required>
              <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Job title" htmlFor="c-title">
              <Input id="c-title" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="c-email" error={fieldErrors.email?.[0]}>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone" htmlFor="c-phone" error={fieldErrors.phone?.[0]}>
              <Input id="c-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                run(() => addContactAction({ ...form, prospect_id: prospectId }), {
                  success: "Contact added",
                  onSuccess: () => {
                    setOpen(false);
                    setForm({ name: "", job_title: "", email: "", phone: "" });
                  },
                })
              }
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
