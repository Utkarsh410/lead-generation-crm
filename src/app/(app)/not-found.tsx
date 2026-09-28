import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <EmptyState
      icon={<SearchX />}
      title="Not found"
      description="This record doesn't exist or you don't have access to it."
      action={
        <Button asChild variant="outline">
          <Link href="/prospects">Back to prospects</Link>
        </Button>
      }
    />
  );
}
