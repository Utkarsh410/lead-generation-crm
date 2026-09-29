import Link from "next/link";
import type { Metadata } from "next";
import { z } from "zod";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/export-button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponseBadge } from "@/components/badges";
import { RecordResponseDialog } from "@/components/outreach/record-response-dialog";
import { requireMember, todayFor } from "@/lib/auth/session";
import { listMessages } from "@/lib/data/outreach";
import { OUTREACH_CHANNELS, OUTREACH_STAGES, RESPONSE_STATUSES } from "@/lib/domain/constants";
import { addDays, dateInTimezone } from "@/lib/domain/dates";
import { formatDateTime } from "@/lib/client/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Outreach" };

const FILTERS = [
  { key: "", label: "All" },
  { key: "awaiting", label: "Awaiting reply" },
  { key: "positive", label: "Replied / interested" },
  { key: "closed", label: "Not interested / wrong contact" },
] as const;

export default async function OutreachPage(props: PageProps<"/outreach">) {
  const { db, settings } = await requireMember();
  const sp = await props.searchParams;
  const filter = z.enum(["awaiting", "positive", "closed"]).optional().catch(undefined).parse(sp.filter);
  const channel = z.enum(OUTREACH_CHANNELS.values).optional().catch(undefined).parse(sp.channel);
  const today = todayFor(settings);

  const all = (await listMessages(db, { channel, limit: 500 })).filter((m) => !m.prospects?.archived_at);
  const weekAgo = addDays(today, -6);
  const sentThisWeek = all.filter((m) => dateInTimezone(m.sent_at, settings.timezone) >= weekAgo).length;
  const awaiting = all.filter((m) => ["sent", "delivered", "no_response"].includes(m.response_status));
  const positive = all.filter((m) => ["replied", "interested"].includes(m.response_status));

  const rows = all.filter((m) => {
    if (filter === "awaiting") return ["sent", "delivered", "no_response"].includes(m.response_status);
    if (filter === "positive") return ["replied", "interested", "not_now"].includes(m.response_status);
    if (filter === "closed") return ["not_interested", "wrong_contact"].includes(m.response_status);
    return true;
  });

  return (
    <>
      <PageHeader
        title="Outreach"
        description="Every message you've sent and how prospects responded."
        actions={
          <>
            <ExportButton kind="outreach" label="Export CSV" />
            <Button asChild>
              <Link href="/outreach/new">
                <Send /> Compose
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sent (last 7 days)" value={sentThisWeek} />
        <StatCard label="Awaiting reply" value={awaiting.length} />
        <StatCard label="Replied / interested" value={positive.length} />
        <StatCard
          label="Response rate"
          value={all.length ? `${Math.round((all.filter((m) => !["sent", "delivered", "no_response"].includes(m.response_status)).length / all.length) * 100)}%` : "—"}
          hint="Messages with any response"
        />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = (filter ?? "") === f.key;
          const params = new URLSearchParams();
          if (f.key) params.set("filter", f.key);
          if (channel) params.set("channel", channel);
          return (
            <Link
              key={f.key}
              href={`/outreach?${params.toString()}`}
              className={cn("rounded-md border px-2.5 py-1 text-sm", active ? "border-primary bg-accent font-medium text-accent-foreground" : "bg-card hover:bg-accent")}
            >
              {f.label}
            </Link>
          );
        })}
        <span className="mx-1 h-5 w-px bg-border" />
        {OUTREACH_CHANNELS.list.map((c) => {
          const params = new URLSearchParams();
          if (filter) params.set("filter", filter);
          if (channel !== c.value) params.set("channel", c.value);
          return (
            <Link
              key={c.value}
              href={`/outreach?${params.toString()}`}
              className={cn("rounded-md border px-2 py-1 text-xs", channel === c.value ? "border-primary bg-accent font-medium" : "bg-card hover:bg-accent")}
            >
              {c.label}
            </Link>
          );
        })}
      </div>
      <Card className="overflow-hidden">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sent</TableHead>
                <TableHead>Prospect</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Response</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(m.sent_at)}</TableCell>
                  <TableCell className="min-w-40">
                    <Link href={`/prospects/${m.prospect_id}`} className="font-medium hover:underline">
                      {m.prospects?.business_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{m.prospects?.contact_name}</div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-xs font-medium">
                      {OUTREACH_STAGES.label(m.outreach_stage)} · {OUTREACH_CHANNELS.label(m.channel)}
                    </p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{m.customized_message}</p>
                  </TableCell>
                  <TableCell>
                    <ResponseBadge status={m.response_status} />
                    {m.response_notes ? <p className="mt-0.5 line-clamp-1 max-w-48 text-xs text-muted-foreground">{m.response_notes}</p> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <RecordResponseDialog
                      messageId={m.id}
                      today={today}
                      current={m.response_status}
                      trigger={<Button size="sm" variant="outline">{m.response_status === "sent" ? "Record response" : "Update"}</Button>}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<Send />}
            title={filter || channel ? "No messages match this filter" : "No outreach recorded yet"}
            description="Compose a message from a template, send it from your own email/LinkedIn/Instagram/WhatsApp, then record it here."
            action={
              <Button asChild>
                <Link href="/outreach/new">Compose outreach</Link>
              </Button>
            }
          />
        )}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Statuses: {RESPONSE_STATUSES.list.map((s) => s.label).join(" · ")}
      </p>
    </>
  );
}
