import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CommonProblems, ServiceMapper } from "@/components/services/service-mapper";
import { CommissionCalculator } from "@/components/commercial/commission-calculator";
import { DeleteServiceButton, ServiceDialog, StarterServicesButton } from "@/components/catalog/catalog-dialogs";
import { requireMember } from "@/lib/auth/session";
import { listServices } from "@/lib/data/catalog";
import { getLookupOptions, labelFor } from "@/lib/data/workspace";
import { must } from "@/lib/data/errors";
import { DELIVERY_MODELS, PRICING_MODELS } from "@/lib/domain/constants";
import { formatMoney } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage(props: PageProps<"/services">) {
  const { db, settings } = await requireMember();
  const tab = z.enum(["catalog", "mapper", "calculator"]).catch("catalog").parse((await props.searchParams).tab);
  const [services, lookups, usage] = await Promise.all([
    listServices(db),
    getLookupOptions(db),
    db.from("opportunities").select("service_id, status").not("service_id", "is", null).then((r) => must(r)),
  ]);
  const counts = new Map<string, { open: number; won: number }>();
  for (const u of usage) {
    const c = counts.get(u.service_id!) ?? { open: 0, won: 0 };
    if (u.status === "open") c.open += 1;
    if (u.status === "won") c.won += 1;
    counts.set(u.service_id!, c);
  }

  return (
    <>
      <PageHeader
        title="Services"
        description="What you sell — your own services, partner-delivered work and referrals."
        actions={
          <>
            <StarterServicesButton />
            <ServiceDialog />
          </>
        }
      />
      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="mapper">Problem → service</TabsTrigger>
          <TabsTrigger value="calculator">Commission calculator</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          {services.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {services.map((s) => {
                const c = counts.get(s.id);
                return (
                  <Card key={s.id} className={s.active ? undefined : "opacity-60"}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle>{s.name}</CardTitle>
                        <div className="flex shrink-0">
                          <ServiceDialog service={s} />
                          <DeleteServiceButton id={s.id} name={s.name} />
                        </div>
                      </div>
                      {s.description ? <CardDescription>{s.description}</CardDescription> : null}
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {s.category ? <Badge tone="indigo">{labelFor(lookups.serviceCategories, s.category)}</Badge> : null}
                        {s.delivery_model ? <Badge tone="slate">{DELIVERY_MODELS.label(s.delivery_model)}</Badge> : null}
                        {s.pricing_model ? <Badge>{PRICING_MODELS.label(s.pricing_model)}</Badge> : null}
                        {!s.active ? <Badge tone="neutral">Inactive</Badge> : null}
                      </div>
                      {s.default_price !== null ? (
                        <p>
                          <span className="text-muted-foreground">Default price:</span> {formatMoney(s.default_price, settings.currency)}
                        </p>
                      ) : null}
                      {s.target_customer ? (
                        <p>
                          <span className="text-muted-foreground">For:</span> {s.target_customer}
                        </p>
                      ) : null}
                      {s.typical_problem ? (
                        <p>
                          <span className="text-muted-foreground">Solves:</span> {s.typical_problem}
                        </p>
                      ) : null}
                      {s.discovery_questions.length ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-muted-foreground">Discovery questions ({s.discovery_questions.length})</summary>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                            {s.discovery_questions.map((q) => (
                              <li key={q}>{q}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {c ? `${c.open} open · ${c.won} won opportunit${c.open + c.won === 1 ? "y" : "ies"}` : "Not used on opportunities yet"}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={<Layers />}
                title="No services yet"
                description="Add what you sell (or start from a few starter services and edit them). Services are used on opportunities, projects and analytics."
              />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mapper" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Problem → service</CardTitle>
              <CardDescription>Describe a prospect&apos;s problem to see which kinds of solution usually fit (simple keyword rules, no AI).</CardDescription>
            </CardHeader>
            <CardContent>
              <ServiceMapper />
            </CardContent>
          </Card>
          {services.some((s) => s.typical_problem) ? (
            <Card>
              <CardHeader>
                <CardTitle>Problems your services solve</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {services
                  .filter((s) => s.active && s.typical_problem)
                  .map((s) => (
                    <div key={s.id} className="rounded-md border p-3">
                      <p className="text-sm font-medium">{s.typical_problem}</p>
                      <Badge tone="indigo" className="mt-2">
                        {s.name}
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Common problems</CardTitle>
            </CardHeader>
            <CardContent>
              <CommonProblems />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator">
          <Card>
            <CardHeader>
              <CardTitle>Commission calculator</CardTitle>
              <CardDescription>Try out terms before agreeing them. Nothing is saved — set the real terms on the opportunity or project.</CardDescription>
            </CardHeader>
            <CardContent>
              <CommissionCalculator />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
