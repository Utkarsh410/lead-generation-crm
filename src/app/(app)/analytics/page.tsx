import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, StatCard } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WeeklyColumns } from "@/components/charts";
import { requireMember } from "@/lib/auth/session";
import { getAnalytics } from "@/lib/data/dashboard";
import { todayInTimezone } from "@/lib/domain/dates";
import { formatRate } from "@/lib/domain/metrics";
import { LEAD_SOURCES, PROSPECT_TYPES, type LeadSource, type ProspectType } from "@/lib/domain/constants";
import { formatDay } from "@/lib/client/format";

export const metadata: Metadata = { title: "Analytics" };

function BreakdownTable({ rows, label }: { rows: Awaited<ReturnType<typeof getAnalytics>>["bySource"]; label: (k: string) => string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead />
          <TableHead className="text-right">Prospects</TableHead>
          <TableHead className="text-right">Contacted</TableHead>
          <TableHead className="text-right">Replied</TableHead>
          <TableHead className="text-right">Qualified</TableHead>
          <TableHead className="text-right">Response rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key}>
            <TableCell className="font-medium">{label(r.key)}</TableCell>
            <TableCell className="text-right tabular-nums">{r.total}</TableCell>
            <TableCell className="text-right tabular-nums">{r.contacted}</TableCell>
            <TableCell className="text-right tabular-nums">{r.replied}</TableCell>
            <TableCell className="text-right tabular-nums">{r.qualified}</TableCell>
            <TableCell className="text-right tabular-nums">{r.contacted >= 5 ? formatRate(r.responseRate) : <span className="text-muted-foreground" title="Fewer than 5 contacted — too little data">n/a</span>}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function AnalyticsPage() {
  const { db } = await requireMember();
  const today = todayInTimezone();
  const a = await getAnalytics(db, today);
  const c = a.counts;

  return (
    <>
      <PageHeader title="Analytics" description="Week 1 acquisition activity. Revenue metrics come later, once there's enough real data." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Contact rate" value={formatRate(a.rates.contactRate)} hint={`${c.contacted} contacted / ${c.total} prospects`} />
        <StatCard label="Response rate" value={formatRate(a.rates.responseRate)} hint={`${c.replied} replied / ${c.contacted} contacted`} />
        <StatCard label="Qualification rate" value={formatRate(a.rates.qualificationRate)} hint={`${c.qualified} qualified / ${c.replied} replies`} />
        <StatCard label="Opportunity rate" value={formatRate(a.rates.opportunityRate)} hint={`${c.opportunities} at discovery+ / ${c.qualified} qualified`} />
      </div>
      {c.contacted < 20 ? (
        <Alert tone="info" className="mt-4">
          Rates are based on {c.contacted} contacted prospect{c.contacted === 1 ? "" : "s"} — treat them as directional until you have more data.
        </Alert>
      ) : null}

      <h2 className="mt-6 mb-3 text-sm font-semibold">Weekly activity (last 8 weeks)</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {a.series.map((s) => (
          <WeeklyColumns key={s.key} title={s.label} data={s.data} today={today} />
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>By lead source</CardTitle>
            <CardDescription>Where your replies are coming from.</CardDescription>
          </CardHeader>
          <BreakdownTable rows={a.bySource} label={(k) => LEAD_SOURCES.label(k as LeadSource)} />
        </Card>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>By prospect type</CardTitle>
            <CardDescription>Agencies vs direct businesses.</CardDescription>
          </CardHeader>
          <BreakdownTable rows={a.byType} label={(k) => PROSPECT_TYPES.label(k as ProspectType)} />
        </Card>
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
