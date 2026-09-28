"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, Field } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import {
  OUTREACH_STAGES,
  TEMPLATE_AUDIENCES,
  TEMPLATE_CHANNELS,
  type OutreachStage,
  type TemplateAudience,
  type TemplateChannel,
} from "@/lib/domain/constants";
import { PERSONALIZE_WARNING, TEMPLATE_VARIABLES, findPlaceholders, renderTemplate } from "@/lib/domain/templates";
import { createTemplateAction, deleteTemplateAction, updateTemplateAction } from "@/lib/actions/outreach";
import { useAction } from "@/lib/client/use-action";
import type { TemplateRow } from "@/lib/data/outreach";

const SAMPLE = {
  first_name: "Priya",
  last_name: "Shah",
  company_name: "Acme Physio",
  industry: "Healthcare",
  service_area: "performance marketing",
  specific_problem: "your website has no online booking",
  personalized_observation: "your recent post about opening a second clinic",
  potential_solution: "a booking system with WhatsApp reminders",
  project_type: "Website",
};

type Draft = {
  id?: string;
  name: string;
  channel: TemplateChannel;
  audience: TemplateAudience;
  outreach_stage: OutreachStage;
  subject: string;
  body: string;
  is_generic: boolean;
  is_active: boolean;
};

const blank: Draft = {
  name: "",
  channel: "email",
  audience: "general",
  outreach_stage: "first_contact",
  subject: "",
  body: "",
  is_generic: true,
  is_active: true,
};

export function TemplateLibrary({ templates }: { templates: TemplateRow[] }) {
  const [channel, setChannel] = useState<string>("");
  const [audience, setAudience] = useState<string>("");
  const [stage, setStage] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const { pending, run, fieldErrors } = useAction();

  const filtered = useMemo(
    () =>
      templates.filter(
        (t) => (!channel || t.channel === channel) && (!audience || t.audience === audience) && (!stage || t.outreach_stage === stage),
      ),
    [templates, channel, audience, stage],
  );
  const grouped = OUTREACH_STAGES.list
    .map((s) => ({ stage: s, items: filtered.filter((t) => t.outreach_stage === s.value) }))
    .filter((g) => g.items.length);

  function save() {
    if (!draft) return;
    const { id, ...values } = draft;
    run(() => (id ? updateTemplateAction({ ...values, id }) : createTemplateAction(values)), {
      success: id ? "Template saved" : "Template created",
      onSuccess: () => setDraft(null),
    });
  }

  const preview = draft ? renderTemplate(draft.body, SAMPLE) : null;
  const unknown = draft ? findPlaceholders(draft.body).filter((p) => !TEMPLATE_VARIABLES.some((v) => v.key === p.toLowerCase())) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect className="w-auto" value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
          <option value="">All channels</option>
          {TEMPLATE_CHANNELS.list.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect className="w-auto" value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Prospect type">
          <option value="">All prospect types</option>
          {TEMPLATE_AUDIENCES.list.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect className="w-auto" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Outreach stage">
          <option value="">All stages</option>
          {OUTREACH_STAGES.list.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
        <Button className="ml-auto" onClick={() => setDraft({ ...blank })}>
          <Plus /> New template
        </Button>
      </div>

      {grouped.length ? (
        grouped.map((g) => (
          <section key={g.stage.value}>
            <h2 className="mb-2 text-sm font-semibold">{g.stage.label}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {g.items.map((t) => (
                <Card key={t.id} className={t.is_active ? "" : "opacity-60"}>
                  <CardContent className="flex h-full flex-col gap-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{t.name}</p>
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Duplicate"
                          title="Duplicate"
                          onClick={() => setDraft({ ...toDraft(t), id: undefined, name: `${t.name} (copy)` })}
                        >
                          <Copy />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Edit" title="Edit" onClick={() => setDraft(toDraft(t))}>
                          <Pencil />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button size="icon-sm" variant="ghost" aria-label="Delete" title="Delete">
                              <Trash2 />
                            </Button>
                          }
                          title={`Delete “${t.name}”?`}
                          description="Messages already sent with this template keep their text. This cannot be undone — you can also just deactivate it."
                          confirmLabel="Delete"
                          destructive
                          onConfirm={() => run(() => deleteTemplateAction({ id: t.id }), { success: "Template deleted" })}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge>{TEMPLATE_CHANNELS.label(t.channel)}</Badge>
                      <Badge tone="slate">{TEMPLATE_AUDIENCES.label(t.audience)}</Badge>
                      {t.is_generic ? <Badge tone="amber">Needs personalising</Badge> : null}
                      {!t.is_active ? <Badge tone="red">Inactive</Badge> : null}
                    </div>
                    {t.subject ? <p className="text-xs"><span className="text-muted-foreground">Subject:</span> {t.subject}</p> : null}
                    <p className="line-clamp-5 text-xs whitespace-pre-line text-muted-foreground">{t.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      ) : (
        <EmptyState title="No templates match" description="Change the filters or create a new template." />
      )}

      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>
              Variables: {TEMPLATE_VARIABLES.map((v) => `{{${v.key}}}`).join(" ")}
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Field label="Name" htmlFor="t-name" error={fieldErrors.name?.[0]} required>
                  <Input id="t-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Channel" htmlFor="t-channel">
                    <NativeSelect id="t-channel" value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value as TemplateChannel })}>
                      {TEMPLATE_CHANNELS.list.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Prospect type" htmlFor="t-aud">
                    <NativeSelect id="t-aud" value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as TemplateAudience })}>
                      {TEMPLATE_AUDIENCES.list.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Stage" htmlFor="t-stage">
                    <NativeSelect id="t-stage" value={draft.outreach_stage} onChange={(e) => setDraft({ ...draft, outreach_stage: e.target.value as OutreachStage })}>
                      {OUTREACH_STAGES.list.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
                {draft.channel === "email" ? (
                  <Field label="Subject" htmlFor="t-subject">
                    <Input id="t-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                  </Field>
                ) : null}
                <Field label="Message" htmlFor="t-body" error={fieldErrors.body?.[0]} required>
                  <Textarea id="t-body" rows={12} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                </Field>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="size-4 accent-primary" checked={draft.is_generic} onChange={(e) => setDraft({ ...draft, is_generic: e.target.checked })} />
                    Generic — warn to personalise before sending
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="size-4 accent-primary" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
                    Active
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[13px] font-medium">Preview with sample data</p>
                {draft.is_generic ? (
                  <Alert tone="warning" icon={<AlertTriangle />}>
                    {PERSONALIZE_WARNING}
                  </Alert>
                ) : null}
                {unknown.length ? (
                  <Alert tone="danger">Unknown variables: {unknown.map((u) => `{{${u}}}`).join(", ")}</Alert>
                ) : null}
                <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-line">
                  {draft.channel === "email" && draft.subject ? (
                    <p className="mb-2 border-b pb-2 font-medium">{renderTemplate(draft.subject, SAMPLE).text}</p>
                  ) : null}
                  {preview?.text || <span className="text-muted-foreground">Start typing the message…</span>}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (unknown.length) {
                  toast.error("Remove or fix unknown variables first.");
                  return;
                }
                save();
              }}
              disabled={pending}
            >
              {pending ? <Loader2 className="animate-spin" /> : null}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toDraft(t: TemplateRow): Draft {
  return {
    id: t.id,
    name: t.name,
    channel: t.channel,
    audience: t.audience,
    outreach_stage: t.outreach_stage,
    subject: t.subject ?? "",
    body: t.body,
    is_generic: t.is_generic,
    is_active: t.is_active,
  };
}
