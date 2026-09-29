"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, Check, Copy, ExternalLink, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Field } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { LeadStatusBadge } from "@/components/badges";
import {
  OUTREACH_CHANNELS,
  OUTREACH_STAGES,
  TEMPLATE_AUDIENCES,
  type OutreachChannel,
  type LeadStatus,
  type OutreachStage,
  type TemplateAudience,
} from "@/lib/domain/constants";
import {
  TEMPLATE_VARIABLES,
  audiencesForProspect,
  buildTemplateVariables,
  checkPersonalization,
  renderTemplate,
  type TemplateVariable,
  type TemplateVariables,
} from "@/lib/domain/templates";
import { recordOutreachAction } from "@/lib/actions/outreach";
import { useAction } from "@/lib/client/use-action";
import { formatDay } from "@/lib/client/format";
import { cn } from "@/lib/utils";

export type ComposerTemplate = {
  id: string;
  name: string;
  channel: OutreachChannel;
  audience: TemplateAudience;
  outreach_stage: OutreachStage;
  subject: string | null;
  body: string;
  is_generic: boolean;
};

export type ComposerProspect = {
  id: string;
  business_name: string;
  contact_name: string | null;
  job_title: string | null;
  industry: string | null;
  prospect_type: string;
  stage: LeadStatus;
  email: string | null;
  whatsapp: string | null;
  phone: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  observed_problem: string | null;
  suggested_solution: string | null;
  potential_project: string | null;
  archived_at: string | null;
};

const MANUAL_VARS: TemplateVariable[] = ["observation"];
const LONG_VARS: TemplateVariable[] = ["observation", "specific_problem", "solution"];

export function OutreachComposer({
  prospect,
  prospectOptions,
  templates,
  today,
  initialStage,
  lastChannel,
  me,
  serviceSuggestions = [],
  delays,
}: {
  prospect: ComposerProspect | null;
  prospectOptions: { id: string; business_name: string }[];
  templates: ComposerTemplate[];
  today: string;
  initialStage: OutreachStage;
  lastChannel: OutreachChannel | null;
  me: { name: string; business: string };
  /** Services from the prospect's open opportunities (first one pre-fills {{service}}). */
  serviceSuggestions?: string[];
  delays: { followUp1: number; followUp2: number };
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<OutreachChannel>(lastChannel ?? (prospect?.email ? "email" : prospect?.instagram_url ? "instagram" : "email"));
  const [stage, setStage] = useState<OutreachStage>(initialStage);
  const [showAll, setShowAll] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [overrides, setOverrides] = useState<TemplateVariables>({});
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState(false);
  const [sentDate, setSentDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const { pending, run } = useAction();

  const audiences = useMemo(() => (prospect ? audiencesForProspect(prospect) : (["general"] as TemplateAudience[])), [prospect]);
  const candidates = templates
    .filter((t) => t.outreach_stage === stage && (showAll || t.channel === channel))
    .filter((t) => showAll || audiences.includes(t.audience))
    .sort((a, b) => audiences.indexOf(a.audience) - audiences.indexOf(b.audience));
  const template = templates.find((t) => t.id === templateId) ?? null;

  const meVars = { name: me.name, business: me.business, service: serviceSuggestions[0] ?? null };
  const vars = prospect ? buildTemplateVariables(prospect, overrides, meVars) : overrides;
  const rendered = template ? renderTemplate(template.body, vars) : null;
  const renderedSubject = template?.subject ? renderTemplate(template.subject, vars).text : "";

  function applyTemplate(t: ComposerTemplate | null, nextVars: TemplateVariables = vars) {
    setTemplateId(t?.id ?? "");
    if (!t) return;
    setMessage(renderTemplate(t.body, nextVars).text);
    setSubject(t.subject ? renderTemplate(t.subject, nextVars).text : "");
    setEdited(false);
  }

  function setVar(key: TemplateVariable, value: string) {
    const next = { ...overrides, [key]: value };
    setOverrides(next);
    // keep the draft in sync until the user starts editing it by hand
    if (template && !edited) {
      const v = prospect ? buildTemplateVariables(prospect, next, meVars) : next;
      setMessage(renderTemplate(template.body, v).text);
      setSubject(template.subject ? renderTemplate(template.subject, v).text : "");
    }
  }

  const check = checkPersonalization({
    isGenericTemplate: Boolean(template?.is_generic),
    renderedTemplate: rendered?.text ?? "",
    finalMessage: message,
  });

  const encoded = encodeURIComponent(message);
  const openLinks: { label: string; href: string }[] = [];
  if (prospect?.email && channel === "email") {
    openLinks.push({ label: "Open in email app", href: `mailto:${prospect.email}?subject=${encodeURIComponent(subject)}&body=${encoded}` });
  }
  const wa = (prospect?.whatsapp ?? prospect?.phone ?? "").replace(/\D/g, "");
  if (wa && channel === "whatsapp") openLinks.push({ label: "Open WhatsApp", href: `https://wa.me/${wa}?text=${encoded}` });
  if (prospect?.linkedin_url && channel === "linkedin") openLinks.push({ label: "Open LinkedIn profile", href: prospect.linkedin_url });
  if (prospect?.instagram_url && channel === "instagram") openLinks.push({ label: "Open Instagram profile", href: prospect.instagram_url });

  async function copy() {
    try {
      await navigator.clipboard.writeText(channel === "email" && subject ? `Subject: ${subject}\n\n${message}` : message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the text and copy manually.");
    }
  }

  function submit() {
    if (!prospect) return;
    run(
      () =>
        recordOutreachAction({
          prospect_id: prospect.id,
          template_id: template?.id ?? null,
          channel,
          outreach_stage: stage,
          subject: channel === "email" ? subject : null,
          customized_message: message,
          sent_date: sentDate,
          notes,
        }),
      {
        success: (r) =>
          r.followUp ? `Recorded. ${r.followUp.title} scheduled for ${formatDay(r.followUp.due_date)}.` : "Outreach recorded.",
        onSuccess: () => router.push(`/prospects/${prospect.id}`),
      },
    );
  }

  if (!prospect) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Who are you contacting?</CardTitle>
        </CardHeader>
        <CardContent>
          <NativeSelect
            defaultValue=""
            onChange={(e) => e.target.value && router.push(`/outreach/new?prospect=${e.target.value}&stage=${stage}`)}
            aria-label="Choose prospect"
          >
            <option value="">Choose a prospect…</option>
            {prospectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.business_name}
              </option>
            ))}
          </NativeSelect>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <div className="space-y-5 xl:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>
                  <Link className="hover:underline" href={`/prospects/${prospect.id}`}>
                    {prospect.business_name}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {[prospect.contact_name, prospect.job_title].filter(Boolean).join(" · ") || "No contact name"}
                </CardDescription>
              </div>
              <LeadStatusBadge status={prospect.stage} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {prospect.archived_at ? <Alert tone="danger">This prospect is archived — restore it before recording outreach.</Alert> : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Channel" htmlFor="channel">
                <NativeSelect id="channel" value={channel} onChange={(e) => setChannel(e.target.value as OutreachChannel)}>
                  {OUTREACH_CHANNELS.list.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Outreach stage" htmlFor="ostage">
                <NativeSelect
                  id="ostage"
                  value={stage}
                  onChange={(e) => {
                    setStage(e.target.value as OutreachStage);
                    setTemplateId("");
                  }}
                >
                  {OUTREACH_STAGES.list.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-medium">Template</p>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" className="accent-primary" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                  Show all channels &amp; audiences
                </label>
              </div>
              {candidates.length ? (
                <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                  {candidates.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className={cn(
                          "w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent",
                          templateId === t.id && "border-primary bg-accent",
                        )}
                      >
                        <span className="font-medium">{t.name}</span>
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          <Badge>{OUTREACH_CHANNELS.label(t.channel)}</Badge>
                          <Badge tone="slate">{TEMPLATE_AUDIENCES.label(t.audience)}</Badge>
                          {t.is_generic ? <Badge tone="amber">Needs personalising</Badge> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No {OUTREACH_STAGES.label(stage)} template for this channel/audience.{" "}
                  <button type="button" className="text-primary hover:underline" onClick={() => setShowAll(true)}>
                    Show all
                  </button>{" "}
                  or write the message yourself.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variables</CardTitle>
            <CardDescription>Filled from the prospect record — edit or add anything missing.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {TEMPLATE_VARIABLES.map((v) => {
              const missing = rendered?.missing.includes(v.key);
              const isManual = MANUAL_VARS.includes(v.key);
              const long = LONG_VARS.includes(v.key);
              return (
                <Field
                  key={v.key}
                  label={
                    <span className="flex items-center gap-1.5">
                      <code className="text-xs">{`{{${v.key}}}`}</code>
                      {missing ? <Badge tone="amber">missing</Badge> : null}
                    </span>
                  }
                  htmlFor={`var-${v.key}`}
                  hint={v.source}
                >
                  {v.key === "service" && serviceSuggestions.length > 1 ? (
                    <NativeSelect id={`var-${v.key}`} value={vars.service ?? ""} onChange={(e) => setVar("service", e.target.value)}>
                      {serviceSuggestions.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : long ? (
                    <Textarea
                      id={`var-${v.key}`}
                      rows={2}
                      value={vars[v.key] ?? ""}
                      onChange={(e) => setVar(v.key, e.target.value)}
                      className={cn(missing && "border-amber-400", isManual && !vars[v.key] && "bg-amber-50/40")}
                    />
                  ) : (
                    <Input
                      id={`var-${v.key}`}
                      value={vars[v.key] ?? ""}
                      onChange={(e) => setVar(v.key, e.target.value)}
                      className={cn(missing && "border-amber-400")}
                    />
                  )}
                </Field>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5 xl:col-span-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Message</CardTitle>
              {template && edited ? (
                <Button variant="ghost" size="sm" onClick={() => applyTemplate(template)}>
                  <RefreshCw /> Reset to template
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {check.warnings.length ? (
              <Alert tone="warning" icon={<AlertTriangle />} title={check.warnings[0]}>
                {check.warnings.length > 1 ? (
                  <ul className="list-disc pl-4">
                    {check.warnings.slice(1).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </Alert>
            ) : null}
            {channel === "email" ? (
              <Field label="Subject" htmlFor="subject">
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={renderedSubject} />
              </Field>
            ) : null}
            <Textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setEdited(true);
              }}
              rows={14}
              className="font-[inherit] leading-relaxed"
              placeholder="Pick a template or write your message…"
              aria-label="Message"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copy} disabled={!message.trim()}>
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy message"}
              </Button>
              {openLinks.map((l) => (
                <Button key={l.href} asChild variant="outline" size="sm">
                  <a href={l.href} target="_blank" rel="noreferrer">
                    <ExternalLink /> {l.label}
                  </a>
                </Button>
              ))}
              <span className="self-center text-xs text-muted-foreground">You send it yourself — LeadOS never sends messages.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Record as sent</CardTitle>
            <CardDescription>
              {stage === "first_contact"
                ? `A Follow-up #1 reminder will be created for ${delays.followUp1} days later.`
                : stage === "follow_up_1"
                  ? `A Follow-up #2 reminder will be created for ${delays.followUp2} days later.`
                  : "The message is logged in the prospect's timeline."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Sent on" htmlFor="sent-date">
                <Input id="sent-date" type="date" max={today} value={sentDate} onChange={(e) => setSentDate(e.target.value)} />
              </Field>
              <Field label="Notes (optional)" htmlFor="out-notes" className="sm:col-span-2">
                <Input id="out-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            {check.hasUnfilledPlaceholders ? (
              <Alert tone="danger">Fill in or remove every {"{{placeholder}}"} before recording the message as sent.</Alert>
            ) : null}
            <div className="flex justify-end">
              <Button onClick={submit} disabled={pending || !message.trim() || check.hasUnfilledPlaceholders || Boolean(prospect.archived_at)}>
                {pending ? <Loader2 className="animate-spin" /> : <Send />}
                I sent this — record it
              </Button>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarPlus className="size-3.5" /> Follow-up reminders are cancelled automatically when you record a reply.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
