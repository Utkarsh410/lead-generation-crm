"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { deleteOpportunityAction } from "@/lib/actions/pipeline";
import { useAction } from "@/lib/client/use-action";

export function DeleteOpportunityButton({ id, prospectId }: { id: string; prospectId: string }) {
  const router = useRouter();
  const { pending, run } = useAction();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" disabled={pending}>
          <Trash2 /> Delete
        </Button>
      }
      title="Delete this opportunity?"
      description="Its stage history stays in the prospect's timeline. Prefer marking it Lost if the deal just didn't happen."
      confirmLabel="Delete"
      destructive
      onConfirm={() => run(() => deleteOpportunityAction({ id }), { success: "Opportunity deleted", onSuccess: () => router.push(`/prospects/${prospectId}`) })}
    />
  );
}
