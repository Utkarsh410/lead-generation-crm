import type { Metadata } from "next";
import Link from "next/link";
import { KanbanSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Kanban } from "@/components/pipeline/kanban";
import { requireMember } from "@/lib/auth/session";
import { must } from "@/lib/data/errors";
import { todayInTimezone } from "@/lib/domain/dates";
import { ACTIVE_OPPORTUNITY_STAGES } from "@/lib/domain/constants";
import { formatINRCompact, sumMoney } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const { db } = await requireMember();
  const cards = must(
    await db
      .from("prospects")
      .select(
        "id, business_name, contact_name, industry, stage, opportunity_score, lead_temperature, potential_project, estimated_value, next_follow_up_date, last_activity_at, is_demo",
      )
      .is("archived_at", null)
      .order("opportunity_score", { ascending: false })
      .limit(1000),
  );
  const active = cards.filter((c) => ACTIVE_OPPORTUNITY_STAGES.includes(c.stage));

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={`${cards.length} prospects · ${active.length} active opportunities · ${formatINRCompact(sumMoney(active.map((c) => c.estimated_value)))} estimated in active stages`}
        actions={
          <Button asChild>
            <Link href="/prospects/new">
              <Plus /> New prospect
            </Link>
          </Button>
        }
      />
      {cards.length ? (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Drag cards between stages (or use the ⋯ menu). Every move is recorded in the prospect&apos;s activity history. Values are your rough estimates.
          </p>
          <Kanban cards={cards} today={todayInTimezone()} />
        </>
      ) : (
        <Card>
          <EmptyState icon={<KanbanSquare />} title="Your pipeline is empty" description="Add prospects to see them move through the stages." />
        </Card>
      )}
    </>
  );
}
