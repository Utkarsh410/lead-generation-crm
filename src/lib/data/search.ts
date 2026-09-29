import { must, searchPattern } from "./errors";
import type { Db } from "./types";

export type SearchHit = { kind: "prospect" | "contact" | "opportunity" | "client" | "project" | "partner"; id: string; href: string; title: string; subtitle: string | null };

/** Searches prospects, contacts, opportunities, clients, projects and partners. */
export async function globalSearch(db: Db, raw: string, limit = 10): Promise<SearchHit[]> {
  const q = raw.trim();
  if (q.length < 2) return [];
  const p = searchPattern(q);
  const or = (cols: string[]) => cols.map((c) => `${c}.ilike.${p}`).join(",");
  const [prospects, contacts, opportunities, clients, projects, partners] = await Promise.all([
    db.from("prospects").select("id, business_name, contact_name, location, archived_at").or(or(["business_name", "contact_name", "email", "phone", "industry", "location"])).limit(limit).then((r) => must(r)),
    db.from("prospect_contacts").select("id, name, email, prospect_id, prospects(business_name)").or(or(["name", "email", "phone"])).limit(limit).then((r) => must(r)),
    db.from("opportunities").select("id, title, prospect_id, prospects(business_name)").or(or(["title", "description"])).limit(limit).then((r) => must(r)),
    db.from("clients").select("id, company, primary_contact").or(or(["company", "primary_contact", "email", "phone"])).limit(limit).then((r) => must(r)),
    db.from("projects").select("id, name, clients(company)").or(or(["name", "notes"])).limit(limit).then((r) => must(r)),
    db.from("partners").select("id, name, contact_name, partner_type").or(or(["name", "contact_name", "email", "location"])).limit(limit).then((r) => must(r)),
  ]);
  return [
    ...prospects.map((r) => ({ kind: "prospect" as const, id: r.id, href: `/prospects/${r.id}`, title: r.business_name, subtitle: [r.contact_name, r.location, r.archived_at ? "archived" : null].filter(Boolean).join(" · ") || null })),
    ...contacts.map((r) => ({ kind: "contact" as const, id: r.id, href: `/prospects/${r.prospect_id}`, title: r.name, subtitle: [r.prospects?.business_name, r.email].filter(Boolean).join(" · ") || null })),
    ...opportunities.map((r) => ({ kind: "opportunity" as const, id: r.id, href: `/opportunities/${r.id}`, title: r.title, subtitle: r.prospects?.business_name ?? null })),
    ...clients.map((r) => ({ kind: "client" as const, id: r.id, href: `/clients/${r.id}`, title: r.company, subtitle: r.primary_contact })),
    ...projects.map((r) => ({ kind: "project" as const, id: r.id, href: `/projects/${r.id}`, title: r.name, subtitle: r.clients?.company ?? null })),
    ...partners.map((r) => ({ kind: "partner" as const, id: r.id, href: `/partners/${r.id}`, title: r.name, subtitle: r.contact_name })),
  ];
}
