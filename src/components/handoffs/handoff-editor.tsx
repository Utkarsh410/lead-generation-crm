"use client";

import { useState } from "react";
import { Check, Copy, Download, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Field } from "@/components/ui/misc";
import { HANDOFF_STATUSES, type HandoffStatus } from "@/lib/domain/constants";
import { updateHandoffAction } from "@/lib/actions/pipeline";
import { useAction } from "@/lib/client/use-action";

/** Markdown → plain text for pasting into WhatsApp/email clients that don't render Markdown. */
function toPlainText(md: string): string {
  return md
    .replace(/^## (.*)$/gm, (_, t: string) => t.toUpperCase())
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^ {2}/gm, "");
}

export function HandoffEditor({
  id,
  businessName,
  partner,
  initialMarkdown,
  initialStatus,
  initialNotes,
  gaps,
}: {
  id: string;
  businessName: string;
  partner: { name: string; email: string | null } | null;
  initialMarkdown: string;
  initialStatus: HandoffStatus;
  initialNotes: string;
  gaps: string[];
}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [status, setStatus] = useState<HandoffStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [copied, setCopied] = useState<"md" | "text" | null>(null);
  const { pending, run } = useAction();
  const dirty = markdown !== initialMarkdown || status !== initialStatus || notes !== initialNotes;

  async function copy(kind: "md" | "text") {
    try {
      await navigator.clipboard.writeText(kind === "md" ? markdown : toPlainText(markdown));
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Couldn't copy — select the text and copy manually.");
    }
  }

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `handoff-${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const mailto = `mailto:${partner?.email ?? ""}?subject=${encodeURIComponent(`Opportunity Handoff — ${businessName}`)}&body=${encodeURIComponent(toPlainText(markdown))}`;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => copy("text")}>
            {copied === "text" ? <Check /> : <Copy />} Copy as text
          </Button>
          <Button variant="outline" onClick={() => copy("md")}>
            {copied === "md" ? <Check /> : <Copy />} Copy Markdown
          </Button>
          <Button variant="outline" onClick={download}>
            <Download /> Download .md
          </Button>
          <Button asChild variant="outline">
            <a href={mailto}>
              <Mail /> Email draft
            </a>
          </Button>
        </div>
        <Textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          rows={30}
          className="font-mono text-[13px] leading-relaxed"
          aria-label="Handoff summary"
        />
      </div>
      <div className="space-y-4">
        {gaps.length ? (
          <Alert tone="warning" title="Still to confirm">
            <ul className="list-disc pl-4">
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <p className="mt-1">Update the prospect or qualification, then prepare a new handoff — or edit the text directly.</p>
          </Alert>
        ) : (
          <Alert tone="success">All key handoff fields are filled in.</Alert>
        )}
        <Field label="Status" htmlFor="h-status" hint={`Mark “Sent” once you've shared it${partner ? ` with ${partner.name}` : " with the partner"}. LeadOS never sends it for you.`}>
          <NativeSelect id="h-status" value={status} onChange={(e) => setStatus(e.target.value as HandoffStatus)}>
            {HANDOFF_STATUSES.list.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Internal notes" htmlFor="h-notes">
          <Textarea id="h-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who you sent it to, their feedback…" />
        </Field>
        <Button
          className="w-full"
          disabled={!dirty || pending}
          onClick={() => run(() => updateHandoffAction({ id, summary_markdown: markdown, status, notes }), { success: "Handoff saved" })}
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}
