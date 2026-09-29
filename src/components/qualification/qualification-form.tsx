"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Field } from "@/components/ui/misc";
import { ClassificationBadge } from "@/components/badges";
import { COMPLEXITY, PROJECT_TYPES, QUALIFICATION_CLASSES, type QualificationClass } from "@/lib/domain/constants";
import {
  QUALIFICATION_CRITERIA,
  assessQualification,
  normalizeCustomAnswers,
  type QualificationCriterion,
} from "@/lib/domain/qualification";
import { useMoney } from "@/components/workspace/workspace-context";
import { saveQualificationAction } from "@/lib/actions/pipeline";
import { useAction } from "@/lib/client/use-action";
import { cn } from "@/lib/utils";

export type QualificationDefaults = {
  business_model?: string | null;
  current_technology?: string | null;
  problem_description?: string | null;
  current_solution?: string | null;
  whats_not_working?: string | null;
  cost_of_inaction?: string | null;
  project_type?: string | null;
  required_features?: string | null;
  integrations?: string | null;
  number_of_users?: string | null;
  estimated_complexity?: string | null;
  desired_launch_date?: string | null;
  timeline_notes?: string | null;
  budget_min?: string | number | null;
  budget_max?: string | number | null;
  budget_notes?: string | null;
  decision_maker_identified?: boolean;
  decision_maker_name?: string | null;
  decision_process?: string | null;
  other_stakeholders?: string | null;
  notes?: string | null;
  opportunity_id?: string | null;
  custom_answers?: unknown;
} & Partial<Record<QualificationCriterion, number | null>>;

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function QualificationForm({
  prospect,
  defaults,
  opportunities = [],
  questions = [],
}: {
  prospect: { id: string; business_name: string; industry: string | null; website: string | null; stage: string };
  defaults: QualificationDefaults;
  opportunities?: { id: string; title: string }[];
  /** The user's own qualification questions (Settings → Qualification). */
  questions?: string[];
}) {
  const router = useRouter();
  const { currency } = useMoney();
  const [opportunityId, setOpportunityId] = useState(defaults.opportunity_id ?? opportunities[0]?.id ?? "");
  const previousAnswers = normalizeCustomAnswers(defaults.custom_answers);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q, previousAnswers.find((a) => a.question === q)?.answer ?? ""])),
  );
  const { pending, run, fieldErrors } = useAction();
  const [f, setF] = useState(() => ({
    business_model: str(defaults.business_model),
    current_technology: str(defaults.current_technology),
    problem_description: str(defaults.problem_description),
    current_solution: str(defaults.current_solution),
    whats_not_working: str(defaults.whats_not_working),
    cost_of_inaction: str(defaults.cost_of_inaction),
    project_type: str(defaults.project_type),
    required_features: str(defaults.required_features),
    integrations: str(defaults.integrations),
    number_of_users: str(defaults.number_of_users),
    estimated_complexity: str(defaults.estimated_complexity),
    desired_launch_date: str(defaults.desired_launch_date),
    timeline_notes: str(defaults.timeline_notes),
    budget_min: str(defaults.budget_min),
    budget_max: str(defaults.budget_max),
    budget_notes: str(defaults.budget_notes),
    decision_maker_identified: Boolean(defaults.decision_maker_identified),
    decision_maker_name: str(defaults.decision_maker_name),
    decision_process: str(defaults.decision_process),
    other_stakeholders: str(defaults.other_stakeholders),
    notes: str(defaults.notes),
  }));
  const [ratings, setRatings] = useState<Record<QualificationCriterion, number>>(
    () => Object.fromEntries(QUALIFICATION_CRITERIA.map((c) => [c.key, defaults[c.key] ?? 3])) as Record<QualificationCriterion, number>,
  );
  const [classification, setClassification] = useState<QualificationClass | "">("");
  const [advance, setAdvance] = useState(true);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const assessment = assessQualification(ratings);
  const finalClass = classification || assessment.suggested;

  const text = (key: keyof typeof f, label: string, opts: { area?: boolean; placeholder?: string; rows?: number } = {}) => (
    <Field label={label} htmlFor={`q-${key}`} error={fieldErrors[key]?.[0]}>
      {opts.area ? (
        <Textarea id={`q-${key}`} rows={opts.rows ?? 2} placeholder={opts.placeholder} value={f[key] as string} onChange={(e) => set(key, e.target.value as never)} />
      ) : (
        <Input id={`q-${key}`} placeholder={opts.placeholder} value={f[key] as string} onChange={(e) => set(key, e.target.value as never)} />
      )}
    </Field>
  );

  function submit() {
    run(
      () =>
        saveQualificationAction({
          ...f,
          ...ratings,
          prospect_id: prospect.id,
          opportunity_id: opportunityId || null,
          custom_answers: questions.map((q) => ({ question: q, answer: answers[q] ?? "" })).filter((a) => a.answer.trim()),
          classification: classification || null,
          advance_stage: advance,
        }),
      {
        success: (r) => `Saved: ${QUALIFICATION_CLASSES.label(r.classification)} (${r.score}/100)${r.movedTo ? " — moved to Qualified" : ""}`,
        onSuccess: () => router.push(`/prospects/${prospect.id}`),
      },
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
            <CardDescription>
              {prospect.business_name}
              {prospect.industry ? ` · ${prospect.industry}` : ""}
              {prospect.website ? ` · ${prospect.website}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {text("business_model", "Business model", { placeholder: "How do they make money?" })}
            {text("current_technology", "Current tools / setup", { placeholder: "e.g. spreadsheets, an old website, an agency…" })}
            {opportunities.length ? (
              <Field label="Opportunity being qualified" htmlFor="q-opp" className="sm:col-span-2">
                <NativeSelect id="q-opp" value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
                  <option value="">The prospect in general</option>
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Problem</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {text("problem_description", "What problem are they trying to solve?", { area: true })}
            {text("current_solution", "What are they currently using?", { area: true })}
            {text("whats_not_working", "What is not working?", { area: true })}
            {text("cost_of_inaction", "What happens if the problem is not solved?", { area: true })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scope</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Work type" htmlFor="q-project_type">
              <NativeSelect id="q-project_type" value={f.project_type} onChange={(e) => set("project_type", e.target.value)}>
                <option value="">Not sure yet</option>
                {PROJECT_TYPES.list.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {text("number_of_users", "Number of users", { placeholder: "e.g. 5 staff, 1,000 customers" })}
            <Field label="Estimated complexity" htmlFor="q-complexity">
              <NativeSelect id="q-complexity" value={f.estimated_complexity} onChange={(e) => set("estimated_complexity", e.target.value)}>
                <option value="">Not assessed</option>
                {COMPLEXITY.list.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">{text("required_features", "Required features", { area: true })}</div>
            {text("integrations", "Integrations / dependencies", { placeholder: "Tools or systems it must work with" })}
            <Field label="Desired launch date" htmlFor="q-launch" error={fieldErrors.desired_launch_date?.[0]}>
              <Input id="q-launch" type="date" value={f.desired_launch_date} onChange={(e) => set("desired_launch_date", e.target.value)} />
            </Field>
            {text("timeline_notes", "Timeline notes", { placeholder: "e.g. 4–6 weeks" })}
            <Field label={`Budget min (${currency})`} htmlFor="q-bmin" error={fieldErrors.budget_min?.[0]} hint="e.g. 100000, 1.5L or 2k">
              <Input id="q-bmin" inputMode="decimal" value={f.budget_min} onChange={(e) => set("budget_min", e.target.value)} />
            </Field>
            <Field label={`Budget max (${currency})`} htmlFor="q-bmax" error={fieldErrors.budget_max?.[0]}>
              <Input id="q-bmax" inputMode="decimal" value={f.budget_max} onChange={(e) => set("budget_max", e.target.value)} />
            </Field>
            {text("budget_notes", "Budget notes")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Decision making</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={f.decision_maker_identified}
                onChange={(e) => set("decision_maker_identified", e.target.checked)}
              />
              Decision maker identified
            </label>
            {text("decision_maker_name", "Decision maker name / role")}
            {text("other_stakeholders", "Other stakeholders")}
            <div className="sm:col-span-2">{text("decision_process", "Decision-making process", { area: true })}</div>
          </CardContent>
        </Card>

        {questions.length ? (
          <Card>
            <CardHeader>
              <CardTitle>My questions</CardTitle>
              <CardDescription>Your own qualification questions (Settings → Qualification). Recorded with the assessment; they don&apos;t change the score.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {questions.map((q, i) => (
                <Field key={q} label={q} htmlFor={`q-custom-${i}`}>
                  <Textarea id={`q-custom-${i}`} rows={2} value={answers[q] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))} />
                </Field>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-5">
        <Card className="xl:sticky xl:top-5">
          <CardHeader>
            <CardTitle>Qualification</CardTitle>
            <CardDescription>Rate each 1–5. The score suggests a class — you decide.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {QUALIFICATION_CRITERIA.map((c) => (
              <div key={c.key}>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium">{c.label}</p>
                  <span className="text-xs tabular-nums text-muted-foreground">{ratings[c.key]}/5</span>
                </div>
                <div className="flex gap-1" role="radiogroup" aria-label={c.label}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={ratings[c.key] === n}
                      onClick={() => setRatings((r) => ({ ...r, [c.key]: n }))}
                      className={cn(
                        "h-8 flex-1 rounded-md border text-sm tabular-nums",
                        ratings[c.key] === n ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</p>
              </div>
            ))}

            <div className="rounded-md border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Score</span>
                <span className="text-2xl font-semibold tabular-nums">{assessment.score}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Suggested</span>
                <ClassificationBadge value={assessment.suggested} />
              </div>
            </div>
            {assessment.warnings.length ? (
              <Alert tone="warning" icon={<AlertTriangle />}>
                <ul className="list-disc space-y-0.5 pl-4">
                  {assessment.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
            <Field label="Final classification (your judgement)" htmlFor="q-class">
              <NativeSelect id="q-class" value={classification} onChange={(e) => setClassification(e.target.value as QualificationClass | "")}>
                <option value="">Use suggestion ({QUALIFICATION_CLASSES.label(assessment.suggested)})</option>
                {QUALIFICATION_CLASSES.list.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {text("notes", "Notes", { area: true, rows: 3 })}
            {finalClass === "qualified" || finalClass === "high_priority" ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={advance} onChange={(e) => setAdvance(e.target.checked)} />
                Set the lead status to <strong>Qualified</strong>
              </label>
            ) : null}
            <Button className="w-full" onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Save qualification
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
