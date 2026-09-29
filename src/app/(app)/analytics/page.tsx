import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, StatCard } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WeeklyColumns } from "@/components/charts";
import { requireMember, todayFor } from "@/lib/auth/session";
import { getLookupOptions, labelFor } from "@/lib/data/workspace";
import { formatMoney } from "@/lib/domain/money";
import { getAnalytics } from "@/lib/data/dashboard";
import { formatRate } from "@/lib/domain/metrics";
import { formatDay } from "@/lib/client/format";

export const metadata: Metadata = { title: "Analytics" };

type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
const MIN_SAMPLE = 5;

function SourceTable({ rows, label, money }: { rows: Analytics["bySource"]; label: (k: string) => string; money: (v: number) => string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Channel</TableHead>
          <TableHead className="text-right">Prospects</TableHead>
          <TableHead className="text-right">Contacted</TableHead>
          <TableHead className="text-right">Replies</TableHead>
          <TableHead className="text-right">Qualified</TableHead>
          <TableHead className="text-right">Opportunities</TableHead>
          <TableHead className="text-right">Won</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Response rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key}>
            <TableCell className="font-medium">{label(r.key)}</TableCell>
            <TableCell className="text-right tabular-nums">{r.prospects}</TableCell>
            <TableCell className="text-right tabular-nums">{r.contacted}</TableCell>
            <TableCell className="text-right tabular-nums">{r.replied}</TableCell>
            <TableCell className="text-right tabular-nums">{r.qualified}</TableCell>
            <TableCell className="text-right tabular-nums">{r.opportunities}</TableCell>
            <TableCell className="text-right tabular-nums">{r.won}</TableCell>
            <TableCell className="text-right tabular-nums">{money(r.myRevenue)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {r.contacted >= MIN_SAMPLE ? (
                formatRate(r.responseRate)
              ) : (
                <span className="text-muted-foreground" title={`Fewer than ${MIN_SAMPLE} contacted — too little data`}>
                  n/a
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function AnalyticsPage() {
  const { db, settings } = await requireMember();
  const today = todayFor(settings);
  const a = await getAnalytics(db, today, settings.timezone);
  const c = a.counts;
  const money = (v: number) => formatMoney(v, settings.currency);
  const lookups = await getLookupOptions(db);
  const sourceLabel = (k: string) => labelFor(lookups.sources, k);

  return (
    <>
      <PageHeader title="Analytics" description="Acquisition, sales and revenue from your own records. Small numbers are shown as n/a rather than guessed." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Contact rate" value={formatRate(a.rates.contactRate)} hint={`${c.contacted} contacted / ${c.total} prospects`} />
        <StatCard label="Response rate" value={formatRate(a.rates.responseRate)} hint={`${c.replied} replied / ${c.contacted} contacted`} />
        <StatCard label="Qualification rate" value={formatRate(a.rates.qualificationRate)} hint={`${c.qualified} qualified / ${c.replied} replies`} />
        <StatCard label="Client rate" value={formatRate(a.rates.clientRate)} hint={`${c.clients} clients / ${c.qualified} qualified`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Payments received" value={money(a.revenue.paymentsToMe)} hint="Paid to you" />
        <StatCard label="Commission earned" value={money(a.revenue.commissionEarned)} hint={`${money(a.revenue.commissionOutstanding)} outstanding`} />
        <StatCard label="Partner costs" value={money(a.revenue.partnerCosts)} />
        <StatCard label="My revenue to date" value={money(a.revenue.myRevenue)} />
      </div>
      {c.contacted < 20 ? (
        <Alert tone="info" className="mt-4">
          Rates are based on {c.contacted} contacted prospect{c.contacted === 1 ? "" : "s"} — treat them as directional until you have more data.
        </Alert>
      ) : null}

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>By acquisition channel</CardTitle>
          <CardDescription>Lead source of each prospect, followed through to opportunities, wins and revenue.</CardDescription>
        </CardHeader>
        {a.bySource.length ? (
          <SourceTable rows={a.bySource} label={sourceLabel} money={money} />
        ) : (
          <CardContent>
            <p className="text-sm text-muted-foreground">No prospects yet.</p>
          </CardContent>
        )}
      </Card>

      <Card className="mt-5 overflow-hidden">
        <CardHeader>
          <CardTitle>By service</CardTitle>
          <CardDescription>Based on the service set on each opportunity and project.</CardDescription>
        </CardHeader>
        {a.byService.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Prospects</TableHead>
                <TableHead className="text-right">Qualified</TableHead>
                <TableHead className="text-right">Opportunities</TableHead>
                <TableHead className="text-right">Won</TableHead>
                <TableHead className="text-right">Won value</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.byService.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.prospects}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.qualified}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.opportunities}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.won}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.wonValue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.myRevenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <CardContent>
            <p className="text-sm text-muted-foreground">Set a service on your opportunities to see this breakdown.</p>
          </CardContent>
        )}
      </Card>

      <h2 className="mt-6 mb-3 text-sm font-semibold">Weekly activity (last 8 weeks)</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {a.series.map((s) => (
          <WeeklyColumns key={s.key} title={s.label} data={s.data} today={today} />
        ))}
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader>
          <CardTitle>Weekly table</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week of</TableHead>
                {a.series.map((s) => (
                  <TableHead key={s.key} className="text-right">
                    {s.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...a.series[0].data].reverse().map((w, i, arr) => {
                const idx = arr.length - 1 - i;
                return (
                  <TableRow key={w.weekStart}>
                    <TableCell>{formatDay(w.weekStart, true)}</TableCell>
                    {a.series.map((s) => (
                      <TableCell key={s.key} className="text-right tabular-nums">
                        {s.data[idx].count}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
