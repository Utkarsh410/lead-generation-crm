import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default async function PendingPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (ctx.approved) redirect("/dashboard");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-lg">
        <Clock className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="font-semibold">Waiting for approval</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You are signed in as {ctx.email}. An admin must approve your account in Settings before you can use LeadOS.
        </p>
        <form action={signOut} className="mt-5">
          <Button variant="outline" type="submit">Sign out</Button>
        </form>
      </div>
    </main>
  );
}
