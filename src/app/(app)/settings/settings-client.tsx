"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Database, Eye, EyeOff, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import {
  loadDemoDataAction,
  removeDemoDataAction,
  resetScoringAction,
  setUserRoleAction,
  updateBusinessProfileAction,
  updateDefaultsAction,
  updateProfileAction,
  updateScoringAction,
} from "@/lib/actions/settings";
import {
  deleteLookupAction,
  deletePipelineStageAction,
  deleteQualificationQuestionAction,
  reorderPipelineStagesAction,
  saveLookupAction,
  savePipelineStageAction,
  saveQualificationQuestionAction,
} from "@/lib/actions/catalog";
import { CURRENCIES, STAGE_COLORS, STAGE_KINDS, type LookupKind, type StageColor, type StageKind } from "@/lib/domain/constants";
import { SCORE_FACTORS, type ScoringConfig } from "@/lib/domain/opportunity-score";
import { useAction } from "@/lib/client/use-action";
import type { PipelineStageRow } from "@/lib/data/workspace";

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

// ---------------------------------------------------------------------------
// Profile / business / defaults
// ---------------------------------------------------------------------------

export function ProfileForm(props: { full_name: string | null; phone: string | null; website: string | null; linkedin_url: string | null }) {
  const [form, setForm] = useState({ full_name: s(props.full_name), phone: s(props.phone), website: s(props.website), linkedin_url: s(props.linkedin_url) });
  const { pending, run, fieldErrors } = useAction();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateProfileAction(form), { success: "Profile saved" });
      }}
    >
      <Field label="Name" htmlFor="pf-name" hint="Used as {{my_name}} in templates and on handoffs." error={fieldErrors.full_name?.[0]} required>
        <Input id="pf-name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
      </Field>
      <Field label="Phone" htmlFor="pf-phone" error={fieldErrors.phone?.[0]}>
        <Input id="pf-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Website" htmlFor="pf-web" error={fieldErrors.website?.[0]}>
        <Input id="pf-web" value={form.website} onChange={(e) => set("website", e.target.value)} />
      </Field>
      <Field label="LinkedIn" htmlFor="pf-li" error={fieldErrors.linkedin_url?.[0]}>
        <Input id="pf-li" value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save profile
        </Button>
      </div>
    </form>
  );
}

export function BusinessForm(props: { business_name: string | null; business_description: string | null; business_website: string | null }) {
  const [form, setForm] = useState({
    business_name: s(props.business_name),
    business_description: s(props.business_description),
    business_website: s(props.business_website),
  });
  const { pending, run, fieldErrors } = useAction();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateBusinessProfileAction(form), { success: "Business profile saved" });
      }}
    >
      <Field label="Business name" htmlFor="bp-name" hint="Used as {{my_business}} in templates. Leave blank if you work under your own name.">
        <Input id="bp-name" value={form.business_name} onChange={(e) => set("business_name", e.target.value)} />
      </Field>
      <Field label="Business website" htmlFor="bp-web" error={fieldErrors.business_website?.[0]}>
        <Input id="bp-web" value={form.business_website} onChange={(e) => set("business_website", e.target.value)} />
      </Field>
      <Field label="What you do" htmlFor="bp-desc" className="sm:col-span-2" hint="Services you sell are managed in Services.">
        <Textarea id="bp-desc" rows={3} value={form.business_description} onChange={(e) => set("business_description", e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save business profile
        </Button>
      </div>
    </form>
  );
}

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

export function DefaultsForm(props: { currency: string; timezone: string; follow_up_1_days: number; follow_up_2_days: number }) {
  const [form, setForm] = useState({
    currency: props.currency,
    timezone: props.timezone,
    follow_up_1_days: String(props.follow_up_1_days),
    follow_up_2_days: String(props.follow_up_2_days),
  });
  const { pending, run, fieldErrors } = useAction();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const zones = TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES];
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateDefaultsAction(form), { success: "Defaults saved" });
      }}
    >
      <Field label="Currency" htmlFor="df-cur" hint="Display currency for all amounts">
        <NativeSelect id="df-cur" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Timezone" htmlFor="df-tz" hint="Decides what “today” means for follow-ups" error={fieldErrors.timezone?.[0]}>
        <NativeSelect id="df-tz" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Follow-up #1 after (days)" htmlFor="df-f1" error={fieldErrors.follow_up_1_days?.[0]}>
        <Input id="df-f1" inputMode="numeric" value={form.follow_up_1_days} onChange={(e) => set("follow_up_1_days", e.target.value)} />
      </Field>
      <Field label="Follow-up #2 after (days)" htmlFor="df-f2" error={fieldErrors.follow_up_2_days?.[0]}>
        <Input id="df-f2" inputMode="numeric" value={form.follow_up_2_days} onChange={(e) => set("follow_up_2_days", e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save defaults
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Lead scoring
// ---------------------------------------------------------------------------

export function ScoringForm({ config }: { config: ScoringConfig }) {
  const [weights, setWeights] = useState<Record<string, string>>(() => Object.fromEntries(SCORE_FACTORS.map((f) => [f.key, String(config.weights[f.key])])));
  const [hot, setHot] = useState(String(config.hot));
  const [warm, setWarm] = useState(String(config.warm));
  const { pending, run, fieldErrors } = useAction();
  const reset = useAction();
  const total = Object.values(weights).reduce((sum, w) => sum + (Number(w) || 0), 0);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {SCORE_FACTORS.map((f) => (
          <Field key={f.key} label={f.label} htmlFor={`sc-${f.key}`} hint={f.hint}>
            <Input id={`sc-${f.key}`} inputMode="numeric" value={weights[f.key]} onChange={(e) => setWeights((w) => ({ ...w, [f.key]: e.target.value }))} />
          </Field>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Weights are relative (total {total}); scores are always scaled to 0–100.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Hot from score" htmlFor="sc-hot" error={fieldErrors.hot?.[0]}>
          <Input id="sc-hot" inputMode="numeric" value={hot} onChange={(e) => setHot(e.target.value)} />
        </Field>
        <Field label="Warm from score" htmlFor="sc-warm" error={fieldErrors.warm?.[0]}>
          <Input id="sc-warm" inputMode="numeric" value={warm} onChange={(e) => setWarm(e.target.value)} />
        </Field>
      </div>
      {fieldErrors.weights?.[0] ? <p className="text-xs text-destructive">{fieldErrors.weights[0]}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() => run(() => updateScoringAction({ weights, hot, warm }), { success: (r) => `Scoring saved — ${r.changed} prospect score${r.changed === 1 ? "" : "s"} updated` })}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save &amp; rescore
        </Button>
        <Button
          variant="outline"
          disabled={reset.pending}
          onClick={() => reset.run(() => resetScoringAction(), { success: "Scoring reset to defaults", onSuccess: () => window.location.reload() })}
        >
          <RotateCcw /> Reset to defaults
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

function StageRow({ stage, first, last, onMove }: { stage: PipelineStageRow; first: boolean; last: boolean; onMove: (dir: -1 | 1) => void }) {
  const [form, setForm] = useState({ label: stage.label, color: stage.color, kind: stage.kind, probability: String(stage.probability) });
  const { pending, run, fieldErrors } = useAction();
  const del = useAction();
  const dirty = form.label !== stage.label || form.color !== stage.color || form.kind !== stage.kind || form.probability !== String(stage.probability);
  const required = stage.key === "new" || stage.key === "won" || stage.key === "lost";
  return (
    <li className="flex flex-wrap items-end gap-2 py-2">
      <div className="flex flex-col">
        <Button variant="ghost" size="icon-sm" aria-label={`Move ${stage.label} up`} disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Move ${stage.label} down`} disabled={last} onClick={() => onMove(1)}>
          <ArrowDown />
        </Button>
      </div>
      <Field label="Stage" htmlFor={`st-${stage.id}`} error={fieldErrors.label?.[0]} className="min-w-40 flex-1">
        <Input id={`st-${stage.id}`} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
      </Field>
      <Field label="Colour" htmlFor={`stc-${stage.id}`}>
        <NativeSelect id={`stc-${stage.id}`} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value as StageColor })}>
          {STAGE_COLORS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Type" htmlFor={`stk-${stage.id}`}>
        <NativeSelect
          id={`stk-${stage.id}`}
          value={form.kind}
          disabled={stage.key === "won" || stage.key === "lost"}
          onChange={(e) => setForm({ ...form, kind: e.target.value as StageKind })}
        >
          {STAGE_KINDS.list.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Prob. %" htmlFor={`stp-${stage.id}`} error={fieldErrors.probability?.[0]} className="w-20">
        <Input id={`stp-${stage.id}`} inputMode="numeric" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
      </Field>
      <Badge tone={form.color as BadgeTone} className="mb-2">
        {form.label || "—"}
      </Badge>
      <Button size="sm" disabled={!dirty || pending} onClick={() => run(() => savePipelineStageAction({ ...form, id: stage.id }), { success: "Stage saved" })}>
        Save
      </Button>
      {!required ? (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${stage.label}`} disabled={del.pending}>
              <Trash2 />
            </Button>
          }
          title={`Delete “${stage.label}”?`}
          description="Only possible when no opportunities are in this stage."
          confirmLabel="Delete"
          destructive
          onConfirm={() => del.run(() => deletePipelineStageAction({ id: stage.id }), { success: "Stage deleted" })}
        />
      ) : null}
    </li>
  );
}

export function PipelineStagesEditor({ stages }: { stages: PipelineStageRow[] }) {
  const reorder = useAction();
  const add = useAction();
  const [label, setLabel] = useState("");
  function move(index: number, dir: -1 | 1) {
    const ids = stages.map((st) => st.id);
    const j = index + dir;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorder.run(() => reorderPipelineStagesAction({ ids }), { success: "Order saved" });
  }
  return (
    <div className="space-y-3">
      <ul className="divide-y">
        {stages.map((st, i) => (
          <StageRow key={`${st.id}-${st.sort_order}`} stage={st} first={i === 0} last={i === stages.length - 1} onMove={(d) => move(i, d)} />
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.run(() => savePipelineStageAction({ label, color: "slate", kind: "open", probability: 50 }), {
            success: "Stage added",
            onSuccess: () => setLabel(""),
          });
        }}
      >
        <Field label="New stage" htmlFor="st-new" className="min-w-52 flex-1" error={add.fieldErrors.label?.[0]}>
          <Input id="st-new" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Contract sent" />
        </Field>
        <Button type="submit" variant="outline" disabled={add.pending || !label.trim()}>
          <Plus /> Add stage
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lookups (sources, industries, service categories)
// ---------------------------------------------------------------------------

type LookupOption = { value: string; label: string; builtIn: boolean; active: boolean; id?: string };

export function LookupEditor({ kind, options, title }: { kind: LookupKind; options: LookupOption[]; title: string }) {
  const [label, setLabel] = useState("");
  const add = useAction();
  const toggle = useAction();
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <span key={o.value} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
            <span className={o.active ? undefined : "text-muted-foreground line-through"}>{o.label}</span>
            {o.builtIn ? (
              o.value !== "other" ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={o.active ? `Hide ${o.label}` : `Show ${o.label}`}
                  disabled={toggle.pending}
                  onClick={() => toggle.run(() => saveLookupAction({ kind, value: o.value, label: o.label, active: !o.active }), { success: o.active ? "Hidden" : "Shown" })}
                >
                  {o.active ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </button>
              ) : null
            ) : o.id ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${o.label}`}
                disabled={toggle.pending}
                onClick={() => toggle.run(() => deleteLookupAction({ id: o.id }), { success: "Removed" })}
              >
                <Trash2 className="size-3" />
              </button>
            ) : null}
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.run(() => saveLookupAction({ kind, label }), { success: "Added", onSuccess: () => setLabel("") });
        }}
      >
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add your own…" aria-label={`Add to ${title}`} className="max-w-xs" />
        <Button type="submit" size="sm" variant="outline" disabled={add.pending || !label.trim()}>
          <Plus /> Add
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Qualification questions
// ---------------------------------------------------------------------------

export function QuestionsEditor({ questions }: { questions: { id: string; question: string; help_text: string | null; active: boolean }[] }) {
  const [text, setText] = useState("");
  const add = useAction();
  const row = useAction();
  return (
    <div className="space-y-3">
      {questions.length ? (
        <ul className="divide-y">
          {questions.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className={q.active ? undefined : "text-muted-foreground line-through"}>{q.question}</span>
              <span className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={q.active ? "Deactivate question" : "Activate question"}
                  disabled={row.pending}
                  onClick={() => row.run(() => saveQualificationQuestionAction({ id: q.id, question: q.question, help_text: q.help_text, active: !q.active }), { success: "Saved" })}
                >
                  {q.active ? <EyeOff /> : <Eye />}
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Delete question" disabled={row.pending} onClick={() => row.run(() => deleteQualificationQuestionAction({ id: q.id }), { success: "Deleted" })}>
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No custom questions yet. The built-in criteria (need, budget, timeline, decision maker, urgency, solution fit, delivery feasibility) always apply.</p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.run(() => saveQualificationQuestionAction({ question: text }), { success: "Question added", onSuccess: () => setText("") });
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Have they worked with an agency before?" aria-label="New qualification question" />
        <Button type="submit" variant="outline" disabled={add.pending || !text.trim()}>
          <Plus /> Add
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo data / users
// ---------------------------------------------------------------------------

export function DemoDataControls({ hasDemo }: { hasDemo: boolean }) {
  const { pending, run } = useAction();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={pending || hasDemo}
        onClick={() => run(() => loadDemoDataAction(), { success: (d) => `Loaded ${d.prospects} demo prospects, ${d.partners} partners and ${d.services} services` })}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Database />}
        Load demo data
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="outline" disabled={pending || !hasDemo}>
            <Trash2 /> Remove demo data
          </Button>
        }
        title="Remove all demo data?"
        description="Deletes every record marked Demo (prospects with their messages, follow-ups, opportunities, clients, projects and payments, plus demo partners and services). Your real data is not touched."
        confirmLabel="Remove demo data"
        destructive
        onConfirm={() => run(() => removeDemoDataAction(), { success: (d) => `Removed ${d.count} demo prospects` })}
      />
    </div>
  );
}

export function RoleSelect({ userId, role, disabled }: { userId: string; role: "admin" | "member" | "pending"; disabled?: boolean }) {
  const { pending, run } = useAction();
  return (
    <NativeSelect
      className="h-8 w-32 text-xs"
      value={role}
      disabled={disabled || pending}
      aria-label="Role"
      onChange={(e) => run(() => setUserRoleAction({ id: userId, role: e.target.value }), { success: "Role updated" })}
    >
      <option value="pending">Pending</option>
      <option value="member">Member</option>
      <option value="admin">Admin</option>
    </NativeSelect>
  );
}
