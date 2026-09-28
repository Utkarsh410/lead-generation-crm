import type { Metadata } from "next";
import { Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ProjectTypeCard } from "@/components/services/project-type-card";
import { CommonProblems, ServiceMapper } from "@/components/services/service-mapper";
import { CommissionCalculator } from "@/components/services/commission-calculator";
import { requireMember } from "@/lib/auth/session";
import { must } from "@/lib/data/errors";
import { COMMISSION_EXCLUSIONS } from "@/lib/domain/commission";
import { formatINRCompact } from "@/lib/domain/money";
import { z } from "zod";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage(props: PageProps<"/services">) {
  const { db } = await requireMember();
  const tab = z.enum(["services", "projects", "mapper", "commission"]).catch("services").parse((await props.searchParams).tab);
  const [services, projectTypes, tiers] = await Promise.all([
    db.from("services").select("*").order("sort_order").then((r) => must(r)),
    db.from("project_types").select("*").order("sort_order").then((r) => must(r)),
    db.from("commission_settings").select("*").order("sort_order").then((r) => must(r)),
  ]);
  const serviceName = new Map(services.map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader title="BharatCoder services" description="Internal reference for deciding what to pitch. Not a public price list." />
      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="projects">Project catalog</TabsTrigger>
          <TabsTrigger value="mapper">Problem → service</TabsTrigger>
          <TabsTrigger value="commission">Commission</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {services.map((s, i) => (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle>
                    {i + 1}. {s.name}
                  </CardTitle>
                  {s.description ? <CardDescription>{s.description}</CardDescription> : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="list-disc space-y-0.5 pl-5 text-sm">
                    {s.examples.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-1">
                    {projectTypes
                      .filter((p) => p.service_id === s.id)
                      .map((p) => (
                        <Badge key={p.id} tone="slate">
                          {p.name}
                        </Badge>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="projects">
          <Alert tone="info" icon={<Info />} className="mb-4">
            No fixed prices are listed — BharatCoder scopes and estimates every project. Use the discovery questions on calls.
          </Alert>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projectTypes.map((p) => (
              <ProjectTypeCard key={p.id} pt={p} serviceName={p.service_id ? serviceName.get(p.service_id) : undefined} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="mapper">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Map a problem to services</CardTitle>
                <CardDescription>Rule-based suggestions (no AI). Use the prospect page to save them to a lead.</CardDescription>
              </CardHeader>
              <CardContent>
                <ServiceMapper />
              </CardContent>
            </Card>
            <div>
              <h2 className="mb-2 text-sm font-semibold">Common problems → what to pitch</h2>
              <CommonProblems />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="commission">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Default commission (reference)</CardTitle>
                <CardDescription>Each project stores the percentage actually agreed — these tiers are never applied automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {tiers.map((t) => (
                    <div key={t.id} className="rounded-md border p-3">
                      <p className="text-xs font-medium text-muted-foreground">{t.tier_name}</p>
                      <p className="text-2xl font-semibold tabular-nums">{Number(t.percentage)}%</p>
                      <p className="text-xs text-muted-foreground">
                        {t.max_amount === null
                          ? `${formatINRCompact(t.min_amount)}+`
                          : `${formatINRCompact(t.min_amount)}–${formatINRCompact(t.max_amount).replace("₹", "")}`}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Basis:</strong> eligible amount actually received by BharatCoder. Commission is paid proportionally as client payments
                    are received. Repeat-project commission is negotiated separately.
                  </p>
                  <div>
                    <p className="font-medium">Excluded from the eligible amount:</p>
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {COMMISSION_EXCLUSIONS.map((e) => (
                        <li key={e}>
                          <Badge>{e}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">Ranges include the lower bound: ₹1L exactly falls in Medium; below ₹25K has no default tier.</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Calculator</CardTitle>
                <CardDescription>For reference — record real numbers on the prospect&apos;s opportunity.</CardDescription>
              </CardHeader>
              <CardContent>
                <CommissionCalculator
                  tiers={tiers.map((t) => ({ tier_name: t.tier_name, min_amount: t.min_amount, max_amount: t.max_amount, percentage: t.percentage }))}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
