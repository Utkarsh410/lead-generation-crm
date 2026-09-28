"use client";

import { useMemo, useState } from "react";
import { Check, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { recommendServices, SERVICE_MAPPING_RULES } from "@/lib/domain/service-mapping";
import { PROJECT_TYPES } from "@/lib/domain/constants";
import { saveRecommendedServicesAction } from "@/lib/actions/prospects";
import { useAction } from "@/lib/client/use-action";
import { cn } from "@/lib/utils";

/**
 * Manual problem → service recommendation (rule-based, no AI). On a prospect page
 * it can save the chosen services to the prospect.
 */
export function ServiceMapper({
  initialProblem = "",
  prospectId,
  saved = [],
}: {
  initialProblem?: string;
  prospectId?: string;
  saved?: string[];
}) {
  const [problem, setProblem] = useState(initialProblem);
  const [chosen, setChosen] = useState<string[]>(saved);
  const { pending, run } = useAction();
  const recs = useMemo(() => recommendServices(problem), [problem]);

  const toggle = (s: string) => setChosen((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]));
  const dirty = chosen.join("|") !== saved.join("|");

  return (
    <div className="space-y-3">
      <Textarea
        rows={2}
        value={problem}
        onChange={(e) => setProblem(e.target.value)}
        placeholder='Describe the problem, e.g. "Students currently receive course material through WhatsApp."'
        aria-label="Problem description"
      />
      {problem.trim() && !recs.length ? (
        <p className="text-xs text-muted-foreground">No matching pattern. Browse the common problems below or pick services manually.</p>
      ) : null}
      {recs.map(({ rule, matched }) => (
        <div key={rule.id} className="rounded-md border p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Lightbulb className="size-4 text-amber-500" /> {rule.problem}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Matched: {matched.join(", ")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rule.solutions.map((s) => {
              const on = chosen.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
                    on ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent",
                  )}
                  aria-pressed={on}
                >
                  {on ? <Check className="size-3" /> : null}
                  {s}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Project types: {rule.projectTypes.map((p) => PROJECT_TYPES.label(p)).join(", ")}
          </p>
        </div>
      ))}
      {prospectId ? (
        <div className="flex flex-wrap items-center gap-2">
          {chosen.map((s) => (
            <Badge key={s} tone="indigo">
              {s}
              <button type="button" onClick={() => toggle(s)} aria-label={`Remove ${s}`}>
                <X />
              </button>
            </Badge>
          ))}
          <Button
            size="sm"
            className="ml-auto"
            disabled={!dirty || pending}
            onClick={() => run(() => saveRecommendedServicesAction({ prospect_id: prospectId, services: chosen }), { success: "Recommended services saved" })}
          >
            Save to prospect
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function CommonProblems() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {SERVICE_MAPPING_RULES.map((rule) => (
        <div key={rule.id} className="rounded-md border bg-card p-3">
          <p className="text-sm font-medium">{rule.problem}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {rule.solutions.map((s) => (
              <Badge key={s} tone="indigo">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
