import { Sidebar } from "@/components/layout/sidebar";
import { displayName, requireMember } from "@/lib/auth/session";
import { todayInTimezone } from "@/lib/domain/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, profile, email } = await requireMember();
  const today = todayInTimezone();
  // badge: follow-ups due today or overdue
  const { count } = await db
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "snoozed"])
    .lte("due_date", today);

  return (
    <div className="min-h-dvh">
      <Sidebar name={displayName(profile)} email={email} badges={{ "/follow-ups": count ?? 0 }} />
      <main className="lg:pl-56">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:py-7">{children}</div>
      </main>
    </div>
  );
}
