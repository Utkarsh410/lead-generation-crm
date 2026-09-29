# LeadOS — Architecture & Plan

_Personal Lead Generation & Sales CRM — human-in-the-loop, vendor-agnostic._

LeadOS began as a single-vendor client-acquisition tool (Week 1). It was then **repurposed in place** — same stack, same core CRM — into a general CRM that supports three business models: selling your own service, selling work a partner delivers, and referring work for a commission.

## 1. Stack

| Item | Choice |
| --- | --- |
| Framework | **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4**. Route protection in `src/proxy.ts`. |
| Database | **Supabase (PostgreSQL)**; migrations in `supabase/migrations`. |
| Auth | Supabase Auth (email + password) via `@supabase/ssr`. First sign-up is admin; later sign-ups are pending until approved. |
| UI | Radix-based components in `src/components/ui`, lucide icons, dnd-kit board. |
| Validation | Zod schemas shared by forms and Server Actions (every action re-validates). |
| Env | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional `LEADOS_ALLOWED_EMAILS`, `LEADOS_TIMEZONE`. No service-role key. |

## 2. Architecture

```
src/
  app/(auth)/login                 sign in / first-time sign up
  app/(app)/…                      protected app (sidebar layout)
    dashboard, follow-ups, search
    prospects (+ import), outreach, qualification, templates        ← acquisition
    opportunities (board + list), handoffs                          ← sales
    clients, projects, partners, services                           ← delivery & revenue
    analytics, settings
  app/api/export/[kind]            CSV exports (auth-checked)
  components/…                     feature components; components/ui primitives
  lib/
    domain/        PURE business logic (no I/O, unit-tested)
      commercials.ts     commission terms, bases, project financials (integer minor units)
      opportunity-score  configurable lead score + temperature
      qualification.ts   7 criteria → score + suggested class; custom answers
      follow-ups.ts      reminder rules (never sends)
      pipeline.ts        lead-status and opportunity-stage side effects
      next-step.ts       "what to do next" rule table
      handoff.ts         "Opportunity Handoff" generator (Markdown + snapshot)
      prospect-import.ts CSV column guessing, validation, in-file duplicates
      templates.ts, duplicates.ts, csv.ts, metrics.ts, money.ts, dates.ts
    validation/    Zod schemas
    data/          Supabase queries/mutations (take a client param)
    actions/       "use server": auth → Zod → data → revalidate (runAction)
    auth/session   member context + per-user settings (currency, timezone, delays, scoring)
supabase/migrations   schema, RLS, triggers, generic seed templates, 0004 repurpose migration
tests/unit            pure domain + validation
tests/integration     real Supabase API: RLS, triggers, full workflow, demo data
e2e                   Playwright acceptance flow through the UI
```

Principles: business rules are pure functions; Server Actions are thin; the database enforces integrity (CHECK constraints, FKs, `numeric(14,2)` money, RLS everywhere, triggers for the audit trail); nothing is ever sent automatically.

## 3. Data model

| Table | Purpose |
| --- | --- |
| `profiles` | User + settings: name, phone, website, LinkedIn, business name/description/website, currency, timezone, follow-up delays, lead-score weights. |
| `lookup_values` | User's own lead sources, industries, service categories (also relabel/hide built-ins). |
| `prospects` | Lead record: contact, source, prospect type, research + indicators, lead score, **lead status** (New, Contacted, Replied, Qualified, Nurture, Client, Lost), duplicate keys. |
| `prospect_contacts`, `activities` | Extra contacts; timeline (stage changes logged by triggers). |
| `outreach_templates`, `outreach_messages` | Generic template library (channel × prospect type × purpose) and every recorded message. |
| `tasks` | Reminders, linkable to a prospect, opportunity, client or partner. |
| `qualification_assessments`, `qualification_questions` | 7 rated criteria + custom answers; the user's own questions. |
| `pipelines`, `pipeline_stages` | Configurable sales pipeline (default: New, Contacted, Replied, Qualified, Discovery, Proposal, Negotiation, Won, Lost, Nurture) with colour, kind (open/won/lost/parked) and default probability. Multiple pipelines are supported by the schema. |
| `opportunities` | Many per prospect: stage, service, value, probability, expected close, delivery model, partner, next action, revenue model and commission terms. Status/probability/closed_at are kept in sync by a trigger. |
| `services` | User's catalog: category, description, target customer, typical problem, delivery model, pricing model, default price, discovery questions. |
| `partners` | Agencies/freelancers/…: contact details, type, services, status. |
| `handoffs` | Generated handoffs for an opportunity + partner (editable Markdown, status). |
| `clients`, `projects`, `payments` | Clients (many projects each); projects with money flow, partner cost, commission terms and commission received; payments (Advance/Milestone/Final/Retainer/Other × Expected/Received/Failed/Refunded). |

Every table has RLS: approved members only; owned rows require `owner_id = auth.uid()` and child rows may only reference parents the user owns. Templates are shared among members.

## 4. Key rules

**Lead score (0–100, prioritisation only).** Eight manually rated factors (0–3). Weights and Hot/Warm thresholds are configurable per user; saving rescores all prospects.

**Qualification.** Seven criteria rated 1–5 → `(sum − n) / 4n × 100` over the rated criteria. Suggested: High Priority ≥ 80, Qualified ≥ 60, Potential ≥ 40. The user picks the final class. Qualifying a lead with no opportunity creates one at the Qualified stage.

**Follow-ups (reminders only).** First contact → Follow-up #1 after N days; #1 → #2 after M days (N/M per user, default 3/5). A reply cancels automated follow-ups and creates a qualification task; "Not now" requires a future date. Discovery stage schedules a call task; Proposal schedules a proposal follow-up; Won/Lost cancel automated reminders; Won suggests converting to a client.

**Commission.** No default. Type: percentage / fixed / none. Basis (explicit): total project value, amount received, net revenue (received − partner cost, ≥ 0) or a custom amount. Fixed + amount-received accrues pro rata. Only *received* payments count. All arithmetic in integer paise/cents with half-up rounding.

## 5. Migration notes (upgrading the single-vendor version)

`supabase/migrations/20260929000004_generic_crm.sql` upgrades an existing database in place:

- **Kept:** all real prospects, contacts, messages, tasks, qualifications, activities and handoffs. Historical handoff text is left unchanged.
- **Removed:** demo data (`is_demo`), the vendor project catalog, commission tier table and vendor-specific services.
- **Lead statuses:** old pipeline stages map to the new lead statuses; each existing deal becomes an opportunity on the matching pipeline stage.
- **Commission:** an existing agreed percentage becomes explicit terms (percentage, basis = amount received). Deals with commercial data get a project (and a payment for the amount already received) under a placeholder partner named **"Legacy delivery partner"** — rename it in Partners.
- **Templates:** unedited vendor seed templates are replaced by generic ones; templates you had edited are kept, renamed "(Legacy) …" and deactivated so you can review them.
- **Prospect types:** agency sub-types become "Agency" (the sub-type is copied into Industry when that was empty).
- Research indicators (has website, booking, LMS…) remain as built-in fields; they are not user-configurable yet.
