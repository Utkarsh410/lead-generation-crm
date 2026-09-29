import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Contact, FolderKanban, Handshake, KanbanSquare, Search, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { UrlFilters } from "@/components/url-filters";
import { requireMember } from "@/lib/auth/session";
import { globalSearch, type SearchHit } from "@/lib/data/search";

export const metadata: Metadata = { title: "Search" };

const KINDS: Record<SearchHit["kind"], { label: string; icon: React.ReactNode }> = {
  prospect: { label: "Prospects", icon: <Users className="size-4" /> },
  contact: { label: "Contacts", icon: <Contact className="size-4" /> },
  opportunity: { label: "Opportunities", icon: <KanbanSquare className="size-4" /> },
  client: { label: "Clients", icon: <Building2 className="size-4" /> },
  project: { label: "Projects", icon: <FolderKanban className="size-4" /> },
  partner: { label: "Partners", icon: <Handshake className="size-4" /> },
};

export default async function SearchPage(props: PageProps<"/search">) {
  const { db } = await requireMember();
  const raw = (await props.searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const hits = q.length >= 2 ? await globalSearch(db, q, 15) : [];
  const groups = (Object.keys(KINDS) as SearchHit["kind"][]).map((k) => ({ kind: k, hits: hits.filter((h) => h.kind === k) })).filter((g) => g.hits.length);

  return (
    <>
      <PageHeader title="Search" description="Prospects, contacts, opportunities, clients, projects and partners." />
      <div className="mb-4">
        <UrlFilters key={q} searchPlaceholder="Search everything…" />
      </div>
      {q.length < 2 ? (
        <Card>
          <EmptyState icon={<Search />} title="Type at least 2 characters" description="Search by business, contact, email, phone, opportunity, client, project or partner name." />
        </Card>
      ) : groups.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.kind}>
              <CardContent className="pt-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  {KINDS[g.kind].icon} {KINDS[g.kind].label} ({g.hits.length})
                </p>
                <ul className="divide-y">
                  {g.hits.map((h) => (
                    <li key={`${h.kind}-${h.id}`} className="py-1.5">
                      <Link href={h.href} className="text-sm font-medium hover:underline">
                        {h.title}
                      </Link>
                      {h.subtitle ? <p className="text-xs text-muted-foreground">{h.subtitle}</p> : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<Search />} title={`Nothing found for “${q}”`} description="Try a shorter or different term." />
        </Card>
      )}
    </>
  );
}
