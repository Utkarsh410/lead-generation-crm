"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Info, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Field } from "@/components/ui/misc";
import { TemperatureBadge } from "@/components/badges";
import {
  COMPANY_SIZES,
  LEAD_SOURCES,
  PROJECT_TYPES,
  PROSPECT_TYPES,
  RESEARCH_INDICATORS,
  WEBSITE_QUALITY,
} from "@/lib/domain/constants";
import {
  RATING_LABELS,
  SCORE_FACTORS,
  calculateOpportunityScore,
  suggestScoreFactors,
  type FactorRating,
} from "@/lib/domain/opportunity-score";
import { DUPLICATE_REASON_LABELS, type DuplicateMatch } from "@/lib/domain/duplicates";
import { prospectSchema, type ProspectInput, type ProspectValues } from "@/lib/validation/schemas";
import { createProspectAction, updateProspectAction } from "@/lib/actions/prospects";
import { useAction } from "@/lib/client/use-action";
import { cn } from "@/lib/utils";
import { StageBadge } from "@/components/badges";
import type { PipelineStage } from "@/lib/domain/constants";

type Props =
  | { mode: "create"; defaults?: Partial<ProspectInput>; today: string }
  | { mode: "edit"; id: string; defaults: ProspectInput; today: string };

const EMPTY: ProspectInput = {
  business_name: "",
  lead_source: "google_maps",
  prospect_type: "direct_business",
  country: "India",
  score_factors: {},
};

function TextField({
  form,
  name,
  label,
  placeholder,
  type = "text",
  hint,
  required,
}: {
  form: ReturnType<typeof useForm<ProspectInput, unknown, ProspectValues>>;
  name: keyof ProspectInput;
  label: string;
  placeholder?: string;
  type?: string;
  hint?: string;
  required?: boolean;
}) {
  const error = form.formState.errors[name]?.message as string | undefined;
  return (
    <Field label={label} htmlFor={name} error={error} hint={hint} required={required}>
      <Input id={name} type={type} placeholder={placeholder} aria-invalid={Boolean(error)} {...form.register(name as never)} />
    </Field>
  );
}

function AreaField({
  form,
  name,
  label,
  placeholder,
  rows = 2,
}: {
  form: ReturnType<typeof useForm<ProspectInput, unknown, ProspectValues>>;
  name: keyof ProspectInput;
  label: string;
  placeholder?: string;
  rows?: number;
}) {
  const error = form.formState.errors[name]?.message as string | undefined;
  return (
    <Field label={label} htmlFor={name} error={error}>
      <Textarea id={name} rows={rows} placeholder={placeholder} aria-invalid={Boolean(error)} {...form.register(name as never)} />
    </Field>
  );
}

export function ProspectForm(props: Props) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [addFirstOutreach, setAddFirstOutreach] = useState(true);
  const [firstOutreachDue, setFirstOutreachDue] = useState(props.today);

  const form = useForm<ProspectInput, unknown, ProspectValues>({
    resolver: zodResolver(prospectSchema) as Resolver<ProspectInput, unknown, ProspectValues>,
    defaultValues: { ...EMPTY, ...props.defaults },
    mode: "onBlur",
  });
  const values = useWatch({ control: form.control });
  const factors = (values.score_factors ?? {}) as Record<string, number | string | undefined>;
  // cheap to compute — recalculated on every change for a live score
  const score = calculateOpportunityScore(Object.fromEntries(Object.entries(factors).map(([k, v]) => [k, Number(v ?? 0)])));
  const suggestions = suggestScoreFactors(values);
  const noContact = !values.email && !values.phone && !values.whatsapp && !values.linkedin_url && !values.instagram_url;

  function submit(confirmDuplicate: boolean) {
    // send the raw form values — the server re-validates with the same schema
    const raw = form.getValues();
    if (props.mode === "create") {
      run(
        () =>
          createProspectAction({
            ...raw,
            confirm_duplicate: confirmDuplicate,
            first_outreach_due: addFirstOutreach ? firstOutreachDue : null,
          }),
        {
          onSuccess: (result) => {
            if (result.status === "duplicates") {
              setDuplicates(result.duplicates);
              window.scrollTo({ top: 0, behavior: "smooth" });
              return;
            }
            router.push(`/prospects/${result.id}?created=1`);
          },
          success: (r) => (r.status === "saved" ? "Prospect created" : null),
        },
      );
    } else {
      run(() => updateProspectAction({ ...raw, id: props.id, confirm_duplicate: confirmDuplicate }), {
        onSuccess: (result) => {
          if (result.status === "duplicates") {
            setDuplicates(result.duplicates);
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
          router.push(`/prospects/${props.id}`);
        },
        success: (r) => (r.status === "saved" ? "Prospect saved" : null),
      });
    }
  }

  const onValid = () => submit(false);
  const err = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onValid)} className="space-y-5" noValidate>
      {duplicates ? (
        <Alert tone="warning" icon={<AlertTriangle />} title="Potential duplicate prospect found.">
          <p className="mb-2">Review before {props.mode === "create" ? "creating" : "saving"}:</p>
          <ul className="mb-3 space-y-1.5">
            {duplicates.map((d) => (
              <li key={d.prospect.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/prospects/${d.prospect.id}`} target="_blank" className="font-medium underline">
                  {d.prospect.business_name}
                </Link>
                {d.prospect.location ? <span className="opacity-80">· {d.prospect.location}</span> : null}
                <StageBadge stage={d.prospect.stage as PipelineStage} />
                {d.prospect.archived_at ? <span className="text-xs">(archived)</span> : null}
                <span className="text-xs opacity-80">— {d.reasons.map((r) => DUPLICATE_REASON_LABELS[r]).join(", ")}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setDuplicates(null)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => submit(true)} disabled={pending}>
              {props.mode === "create" ? "Not a duplicate — create anyway" : "Not a duplicate — save anyway"}
            </Button>
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField form={form} name="business_name" label="Business name" required />
          <Field label="Prospect type" htmlFor="prospect_type" required hint="Agencies are a key partner channel.">
            <NativeSelect id="prospect_type" {...form.register("prospect_type")}>
              {PROSPECT_TYPES.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <TextField form={form} name="industry" label="Industry" placeholder="e.g. Healthcare, Coaching" />
          <TextField form={form} name="contact_name" label="Contact name" />
          <TextField form={form} name="job_title" label="Job title" placeholder="Founder, Director…" />
          <Field label="Company size" htmlFor="company_size">
            <NativeSelect id="company_size" {...form.register("company_size")}>
              <option value="">Unknown</option>
              {COMPANY_SIZES.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <TextField form={form} name="email" label="Email" type="email" />
          <TextField form={form} name="phone" label="Phone" type="tel" placeholder="+91 98765 43210" />
          <TextField form={form} name="whatsapp" label="WhatsApp" type="tel" />
          <TextField form={form} name="website" label="Website" placeholder="example.com" />
          <TextField form={form} name="linkedin_url" label="LinkedIn URL" />
          <TextField form={form} name="instagram_url" label="Instagram URL" />
          <TextField form={form} name="location" label="City / location" />
          <TextField form={form} name="country" label="Country" />
          {noContact ? (
            <Alert tone="info" icon={<Info />} className="sm:col-span-2 lg:col-span-3">
              No contact details yet. You can save the prospect and add them after research.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead source</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Source" htmlFor="lead_source" required>
            <NativeSelect id="lead_source" {...form.register("lead_source")}>
              {LEAD_SOURCES.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <TextField form={form} name="source_url" label="Source URL" placeholder="Maps listing, post, profile…" />
          <TextField form={form} name="source_notes" label="Source notes" placeholder="Where/how you found them" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Research</CardTitle>
          <CardDescription>Why might they need development? Record what you actually observed.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <AreaField form={form} name="business_description" label="Business description" />
          <AreaField form={form} name="current_website_notes" label="Current website" placeholder="Platform, pages, what works / doesn't" />
          <Field label="Website quality" htmlFor="website_quality">
            <NativeSelect id="website_quality" {...form.register("website_quality")}>
              <option value="">Not assessed</option>
              {WEBSITE_QUALITY.list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <AreaField form={form} name="social_presence" label="Social presence" rows={1} />
          <AreaField form={form} name="observed_problem" label="Observed problem" placeholder="Specific, factual: what did you notice?" />
          <AreaField form={form} name="potential_need" label="Potential need" />
          <AreaField form={form} name="suggested_solution" label="Suggested solution" />
          <AreaField form={form} name="research_notes" label="Research notes" />

          <div className="md:col-span-2">
            <p className="mb-2 text-[13px] font-medium">
              Indicators <span className="font-normal text-muted-foreground">— leave “Unknown” unless you checked</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {RESEARCH_INDICATORS.list.map((ind) => (
                <label key={ind.value} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                  <span>{ind.label}</span>
                  <NativeSelect className="h-7 w-24 text-xs" aria-label={ind.label} {...form.register(ind.value)}>
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </NativeSelect>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Opportunity &amp; score</CardTitle>
              <CardDescription>Internal prioritisation only — it does not predict whether they will buy.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold tabular-nums">{score.score}</span>
              <span className="text-sm text-muted-foreground">/100</span>
              <TemperatureBadge temperature={score.temperature} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Potential project" htmlFor="potential_project">
              <NativeSelect id="potential_project" {...form.register("potential_project")}>
                <option value="">Not sure yet</option>
                {PROJECT_TYPES.list.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Estimated value (₹)"
              htmlFor="estimated_value"
              error={err.estimated_value?.message}
              hint="Rough guess, e.g. 1.5L or 150000"
            >
              <Input id="estimated_value" inputMode="decimal" aria-invalid={Boolean(err.estimated_value)} {...form.register("estimated_value")} />
            </Field>
            <TextField form={form} name="potential_project_notes" label="Project notes" placeholder="One line summary" />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {SCORE_FACTORS.map((f) => {
              const suggestion = suggestions[f.key];
              const current = Number(factors[f.key] ?? 0);
              const item = score.breakdown.find((b) => b.key === f.key);
              return (
                <div key={f.key} className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {f.label} <span className="text-xs font-normal text-muted-foreground">· {f.weight} pts</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{f.hint}</p>
                    {suggestion && suggestion.rating !== current ? (
                      <button
                        type="button"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={() =>
                          form.setValue(`score_factors.${f.key}` as never, suggestion.rating as never, { shouldDirty: true })
                        }
                      >
                        <Sparkles className="size-3" /> Suggest {RATING_LABELS[suggestion.rating]} ({suggestion.reason})
                      </button>
                    ) : null}
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">+{item?.points ?? 0}</span>
                  <NativeSelect
                    className={cn("h-8 w-32 text-xs")}
                    aria-label={f.label}
                    {...form.register(`score_factors.${f.key}` as never, { valueAsNumber: true })}
                  >
                    {([0, 1, 2, 3] as FactorRating[]).map((r) => (
                      <option key={r} value={r}>
                        {RATING_LABELS[r]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {props.mode === "create" ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={addFirstOutreach}
                onChange={(e) => setAddFirstOutreach(e.target.checked)}
              />
              Add a “First outreach” reminder for
            </label>
            <Input
              type="date"
              className="w-40"
              min={props.today}
              value={firstOutreachDue}
              disabled={!addFirstOutreach}
              onChange={(e) => setFirstOutreachDue(e.target.value)}
              aria-label="First outreach due date"
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {props.mode === "create" ? "Create prospect" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
