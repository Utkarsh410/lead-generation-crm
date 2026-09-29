import { Sidebar } from "@/components/layout/sidebar";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { displayName, requireMember, todayFor } from "@/lib/auth/session";
import { getLookupOptions } from "@/lib/data/workspace";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, profile, email, settings } = await requireMember();
  const today = todayFor(settings);
  const [{ count }, lookups] = await Promise.all([
    // badge: follow-ups due today or overdue
    db.from("tasks").select("id", { count: "exact", head: true }).in("status", ["pending", "snoozed"]).lte("due_date", today),
    getLookupOptions(db),
  ]);

  return (
    <WorkspaceProvider value={{ currency: settings.currency, ...lookups }}>
      <div className="min-h-dvh">
        <Sidebar name={displayName(profile)} email={email} badges={{ "/follow-ups": count ?? 0 }} />
        <main className="lg:pl-56">
          <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:py-7">{children}</div>
        </main>
      </div>
    </WorkspaceProvider>
  );
}
