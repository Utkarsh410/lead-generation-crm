import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { requireMember } from "@/lib/auth/session";
import { hasDemoData } from "@/lib/data/demo";
import { must } from "@/lib/data/errors";
import { appTimezone } from "@/lib/domain/dates";
import { DemoDataControls, ProfileForm, RoleSelect } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

const EXPORTS = [
  { kind: "prospects", label: "Prospects" },
  { kind: "qualified", label: "Qualified leads" },
  { kind: "outreach", label: "Outreach history" },
  { kind: "follow-ups", label: "Follow-ups" },
];

export default async function SettingsPage() {
  const { db, profile, userId } = await requireMember();
  const demo = await hasDemoData(db);
  const users =
    profile.role === "admin"
      ? must(await db.from("profiles").select("id, email, full_name, role, created_at").order("created_at"))
      : [];

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Signed in as {profile.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm fullName={profile.full_name ?? ""} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demo data</CardTitle>
            <CardDescription>15 realistic demo prospects with outreach, follow-ups and qualifications, marked “Demo”.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {demo ? <Alert tone="info">Demo data is loaded. Remove it before you start using LeadOS for real.</Alert> : null}
            <DemoDataControls hasDemo={demo} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export (CSV)</CardTitle>
            <CardDescription>Opens in Excel / Google Sheets.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {EXPORTS.map((e) => (
              <Button key={e.kind} asChild variant="outline" size="sm">
                <a href={`/api/export/${e.kind}`}>
                  <Download /> {e.label}
                </a>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Business timezone:</span> {appTimezone()}{" "}
              <span className="text-xs text-muted-foreground">(LEADOS_TIMEZONE)</span>
            </p>
            <p className="text-muted-foreground">
              Opportunity-score weights and qualification thresholds live in <code>src/lib/domain/opportunity-score.ts</code> and{" "}
              <code>src/lib/domain/qualification.ts</code>. Commission reference tiers are on the{" "}
              <Link className="text-primary hover:underline" href="/services?tab=commission">Services → Commission</Link> tab.
            </p>
          </CardContent>
        </Card>

        {profile.role === "admin" ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>New sign-ups stay “Pending” until you approve them. Each user only sees their own prospects.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {users.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-medium">
                        {u.full_name ?? "—"} {u.id === userId ? <Badge>You</Badge> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <RoleSelect userId={u.id} role={u.role} disabled={u.id === userId} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
