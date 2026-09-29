import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireMember } from "@/lib/auth/session";
import { hasDemoData } from "@/lib/data/demo";
import { must } from "@/lib/data/errors";
import { listQualificationQuestions } from "@/lib/data/catalog";
import { getDefaultPipeline, listLookups, slugify } from "@/lib/data/workspace";
import { DEFAULT_INDUSTRIES, DEFAULT_SERVICE_CATEGORIES, LEAD_SOURCES, type LookupKind } from "@/lib/domain/constants";
import { EXPORT_KINDS } from "@/lib/data/exports";
import {
  BusinessForm,
  DefaultsForm,
  DemoDataControls,
  LookupEditor,
  PipelineStagesEditor,
  ProfileForm,
  QuestionsEditor,
  RoleSelect,
  ScoringForm,
} from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

const EXPORT_LABELS: Record<(typeof EXPORT_KINDS)[number], string> = {
  prospects: "Prospects",
  qualified: "Qualified leads",
  outreach: "Outreach history",
  "follow-ups": "Follow-ups",
  opportunities: "Opportunities",
  clients: "Clients",
  projects: "Projects",
  payments: "Payments",
  partners: "Partners",
};

const TABS = ["profile", "defaults", "pipeline", "lists", "qualification", "data", "users"] as const;

export default async function SettingsPage(props: PageProps<"/settings">) {
  const { db, profile, userId, settings } = await requireMember();
  const tab = z.enum(TABS).catch("profile").parse((await props.searchParams).tab);
  const [demo, pipeline, lookups, questions, users] = await Promise.all([
    hasDemoData(db),
    getDefaultPipeline(db),
    listLookups(db),
    listQualificationQuestions(db),
    profile.role === "admin" ? db.from("profiles").select("id, email, full_name, role, created_at").order("created_at").then((r) => must(r)) : Promise.resolve([]),
  ]);

  const lookupOptions = (kind: LookupKind, builtIn: { value: string; label: string }[]) => {
    const custom = lookups.filter((l) => l.kind === kind);
    const merged = builtIn.map((b) => {
      const override = custom.find((c) => c.value === b.value);
      return { value: b.value, label: override?.label ?? b.label, builtIn: true, active: override ? override.active : true, id: override?.id };
    });
    for (const c of custom) {
      if (!builtIn.some((b) => b.value === c.value)) merged.push({ value: c.value, label: c.label, builtIn: false, active: c.active, id: c.id });
    }
    return merged;
  };

  return (
    <>
      <PageHeader title="Settings" description={`Signed in as ${profile.email}`} />
      <Tabs defaultValue={tab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="defaults">Defaults &amp; scoring</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
          <TabsTrigger value="qualification">Qualification</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          {profile.role === "admin" ? <TabsTrigger value="users">Users</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="profile" className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>My profile</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm full_name={profile.full_name} phone={profile.phone} website={profile.website} linkedin_url={profile.linkedin_url} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Business profile</CardTitle>
              <CardDescription>
                What you sell lives in <Link href="/services" className="text-primary hover:underline">Services</Link>; who you work with in{" "}
                <Link href="/partners" className="text-primary hover:underline">Partners</Link>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessForm business_name={profile.business_name} business_description={profile.business_description} business_website={profile.business_website} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defaults" className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Defaults</CardTitle>
            </CardHeader>
            <CardContent>
              <DefaultsForm
                currency={settings.currency}
                timezone={settings.timezone}
                follow_up_1_days={settings.delays.followUp1}
                follow_up_2_days={settings.delays.followUp2}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lead scoring</CardTitle>
              <CardDescription>Internal prioritisation only — how much each research factor counts. Saving rescores every prospect.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScoringForm config={settings.scoring} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline">
          <Card>
            <CardHeader>
              <CardTitle>Sales pipeline stages</CardTitle>
              <CardDescription>
                Rename, recolour, reorder or add stages. Probability is the default for opportunities in that stage (used for expected revenue). New, Won and Lost are required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PipelineStagesEditor stages={pipeline.stages} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lists">
          <Card>
            <CardHeader>
              <CardTitle>Lists</CardTitle>
              <CardDescription>Add your own lead sources, industries and service categories, or hide built-in ones you don&apos;t use.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <LookupEditor kind="lead_source" title="Lead sources" options={lookupOptions("lead_source", LEAD_SOURCES.list)} />
              <LookupEditor kind="industry" title="Industries" options={lookupOptions("industry", DEFAULT_INDUSTRIES.map((i) => ({ value: slugify(i), label: i })))} />
              <LookupEditor kind="service_category" title="Service categories" options={lookupOptions("service_category", DEFAULT_SERVICE_CATEGORIES.list)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qualification">
          <Card>
            <CardHeader>
              <CardTitle>My qualification questions</CardTitle>
              <CardDescription>Asked on every qualification in addition to the built-in 1–5 criteria. Answers are saved with the assessment.</CardDescription>
            </CardHeader>
            <CardContent>
              <QuestionsEditor questions={questions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Export (CSV)</CardTitle>
              <CardDescription>Opens in Excel / Google Sheets.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {EXPORT_KINDS.map((k) => (
                <Button key={k} asChild variant="outline" size="sm">
                  <a href={`/api/export/${k}`}>
                    <Download /> {EXPORT_LABELS[k]}
                  </a>
                </Button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Import</CardTitle>
              <CardDescription>Bring prospects in from a spreadsheet, with a preview and duplicate check.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/prospects/import">Import prospects from CSV</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Demo data</CardTitle>
              <CardDescription>
                Example prospects across industries (marketing and SEO agencies, clinics, coaching, e-commerce, SaaS, real estate, consulting, local SMEs) with opportunities, partners,
                a client project and payments — all marked “Demo”.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {demo ? <Alert tone="info">Demo data is loaded. Remove it before you start using LeadOS for real.</Alert> : null}
              <DemoDataControls hasDemo={demo} />
            </CardContent>
          </Card>
        </TabsContent>

        {profile.role === "admin" ? (
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>New sign-ups stay “Pending” until you approve them. Each user only sees their own data.</CardDescription>
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
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}
