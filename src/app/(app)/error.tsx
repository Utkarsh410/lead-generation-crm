"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle />}
      title="Something went wrong loading this page"
      description={
        <>
          {error.message.includes("NEXT_PUBLIC_SUPABASE")
            ? error.message
            : "Please try again. If it keeps happening, check your connection to Supabase."}
          {error.digest ? <span className="mt-1 block text-xs">Ref: {error.digest}</span> : null}
        </>
      }
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
