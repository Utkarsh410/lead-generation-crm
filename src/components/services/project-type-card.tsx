"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { updateProjectTypeAction } from "@/lib/actions/settings";
import { useAction } from "@/lib/client/use-action";
import type { Tables } from "@/lib/supabase/database.types";

type ProjectType = Tables<"project_types">;

export function ProjectTypeCard({ pt, serviceName }: { pt: ProjectType; serviceName?: string }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{pt.name}</CardTitle>
            {serviceName ? <Badge tone="indigo" className="mt-1">{serviceName}</Badge> : null}
          </div>
          <EditProjectType pt={pt} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-sm">
        {pt.description ? <p>{pt.description}</p> : null}
        <dl className="space-y-1.5">
          {[
            ["Typical client", pt.typical_client],
            ["Typical problem", pt.typical_problem],
            ["Potential solution", pt.potential_solution],
          ].map(([label, value]) =>
            value ? (
              <div key={label}>
                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ) : null,
          )}
        </dl>
        {pt.discovery_questions.length ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Discovery questions</p>
            <ol className="mt-0.5 list-decimal space-y-0.5 pl-4">
              {pt.discovery_questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </div>
        ) : null}
        {pt.notes ? <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">{pt.notes}</p> : null}
      </CardContent>
    </Card>
  );
}

function EditProjectType({ pt }: { pt: ProjectType }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: pt.name,
    description: pt.description ?? "",
    typical_client: pt.typical_client ?? "",
    typical_problem: pt.typical_problem ?? "",
    potential_solution: pt.potential_solution ?? "",
    discovery_questions: pt.discovery_questions.join("\n"),
    notes: pt.notes ?? "",
  });
  const { pending, run, fieldErrors } = useAction();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${pt.name}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {pt.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Name" htmlFor="pt-name" error={fieldErrors.name?.[0]}>
            <Input id="pt-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="pt-desc">
            <Textarea id="pt-desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Typical client" htmlFor="pt-client">
              <Textarea id="pt-client" rows={3} value={form.typical_client} onChange={(e) => set("typical_client", e.target.value)} />
            </Field>
            <Field label="Typical problem" htmlFor="pt-problem">
              <Textarea id="pt-problem" rows={3} value={form.typical_problem} onChange={(e) => set("typical_problem", e.target.value)} />
            </Field>
            <Field label="Potential solution" htmlFor="pt-solution">
              <Textarea id="pt-solution" rows={3} value={form.potential_solution} onChange={(e) => set("potential_solution", e.target.value)} />
            </Field>
          </div>
          <Field label="Discovery questions (one per line)" htmlFor="pt-q">
            <Textarea id="pt-q" rows={5} value={form.discovery_questions} onChange={(e) => set("discovery_questions", e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="pt-notes" hint="Don't add prices unless BharatCoder has provided official pricing.">
            <Textarea id="pt-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
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
                  updateProjectTypeAction({
                    ...form,
                    id: pt.id,
                    discovery_questions: form.discovery_questions.split("\n").map((q) => q.trim()).filter(Boolean),
                  }),
                { success: "Project type saved", onSuccess: () => setOpen(false) },
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
