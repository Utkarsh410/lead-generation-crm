# LeadOS

**Personal Lead Generation & Sales CRM** — a human-in-the-loop CRM for finding, contacting and qualifying prospects, running deals through a sales pipeline, and tracking clients, projects, payments and commission. It works for any business model:

- **Own service** — you sell and deliver (or deliver with help).
- **Partner delivery** — you sell, a partner (agency, freelancer…) delivers; you keep a margin or earn a commission.
- **Referral** — you pass the opportunity to a partner and earn a referral commission.

> LeadOS never sends messages, scrapes, or automates social platforms. Its "automation" only creates and cancels **reminders**. You personalise and send every message yourself.

## The daily workflow

1. **Dashboard** – what to do today: overdue/due follow-ups, prospects needing first outreach, discovery calls, proposals; lead-gen, sales and revenue numbers.
2. **Prospects** – add a lead (or **import a CSV** with preview, validation and duplicate check). Duplicates are detected by website domain, email, phone and name + location. Record research and the lead score.
3. **Outreach** – pick a template, fill the `{{variables}}`, personalise, send it from your own email/LinkedIn/Instagram/WhatsApp/phone, then click **"I sent this — record it"**. Follow-up reminders are created automatically (default +3 / +5 days, configurable).
4. **Record the response** – a reply cancels pending automated follow-ups and creates a qualification task; "Not now" asks when to follow up.
5. **Qualify** – rate need clarity, budget, timeline, decision-maker access, urgency, solution fit and delivery feasibility (1–5) plus your own questions. The score suggests a class; you decide.
6. **Opportunities** – a prospect can have several deals. Each has a service, value, probability, expected close, delivery model (self-delivered, partner-delivered, referral, white-label, joint), partner, next action and commercial terms. Move them on the **board** or the list.
7. **Partner handoff** – generate a copyable "Opportunity Handoff" for any partner, edit it, copy as text/Markdown, mark it sent.
8. **Won → client & project** – convert the prospect into a client; the project copies the service, partner, value and terms. Record **payments**; commission is calculated from the terms you chose.
9. **Analytics** – funnel rates, acquisition channels (prospects → replies → qualified → opportunities → won → revenue), services and weekly activity. Small samples show "n/a" instead of guesses.

Every prospect page shows a **Next step** banner so nothing is a passive record. **Search** (sidebar) covers prospects, contacts, opportunities, clients, projects and partners.

## Commission & revenue rules

- **No default commission.** Terms are set per opportunity/project: type (percentage, fixed, none), percentage or amount, and an explicitly chosen **basis** — Total Project Value, Amount Received, Net Revenue (received − partner cost) or a Custom amount.
- Money flow is explicit: *client pays me* (you pay the partner a cost → planned margin) or *client pays the partner* (the partner pays you commission).
- Example: ₹2,00,000 project, 10% on amount received, client has paid ₹1,00,000 → commission earned ₹10,000.
- All money maths uses integer minor units (paise/cents) — never floating point. Amounts are stored as `numeric(14,2)`.

## Tech stack

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 · Radix-based components · Supabase (Postgres + Auth + Row Level Security) · Zod · Lucide · dnd-kit · Vitest · Playwright.

See [`docs/PLAN.md`](docs/PLAN.md) for the architecture, data model and migration notes.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Apply the migrations in `supabase/migrations` **in order** — either:
   - Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`, or
   - Dashboard → SQL Editor: paste and run each file in filename order.
3. Authentication → Providers → Email: enabled. For a private tool, either turn **off** "Confirm email" or configure SMTP.
4. Authentication → URL Configuration: set the Site URL to where you deploy LeadOS.

**Upgrading an existing install:** migration `…0004_generic_crm.sql` converts the earlier single-vendor version in place — see *Migration notes* in `docs/PLAN.md`. Take a backup first (Dashboard → Database → Backups).

### 2. Environment

```bash
cp .env.example .env.local
```

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | The public **anon** key. Never use the service-role key — LeadOS doesn't need it. |
| `LEADOS_ALLOWED_EMAILS` | no | Comma-separated allowlist of emails that may sign in. |
| `LEADOS_TIMEZONE` | no | Fallback timezone when a user hasn't set one. Default `Asia/Kolkata`. |

### 3. Run

```bash
npm install
npm run dev          # http://localhost:3000
```

Open `/login` → **Create an account**. **The first account becomes admin.** Later sign-ups are *pending* until an admin approves them in **Settings → Users**.

Then, in **Settings**: set your name and business (used as `{{my_name}}` / `{{my_business}}` in templates), currency, timezone, follow-up delays and lead-scoring weights; adjust pipeline stages; add your own lead sources, industries and service categories. Add what you sell under **Services** and who you work with under **Partners**.

To explore first: **Settings → Data → Load demo data** creates example prospects (agencies, clinics, coaching, e-commerce, SaaS, real estate, consulting, a local SME) with opportunities, partners, services, a client project and payments — all marked **Demo**. **Remove demo data** deletes them; real records are untouched.

### Deploy

Any Next.js host works (e.g. Vercel). Set the same environment variables and add the deployed URL to Supabase's URL configuration.

## Security

- Every table has **Row Level Security**. Users only see their own prospects, opportunities, clients, projects, payments, partners and services; outreach templates are shared among approved members; pending users see nothing.
- Only admins can change roles (enforced by a database trigger).
- Routes are protected in `src/proxy.ts`; every Server Action re-checks the session and approval and re-validates input with Zod.
- CSV exports neutralise spreadsheet formulas; security headers are set in `next.config.ts`.

## Where the rules live

| What | Where |
| --- | --- |
| Lead score weights, Hot/Warm thresholds | **Settings → Defaults & scoring** (defaults in `src/lib/domain/opportunity-score.ts`) |
| Follow-up delays | **Settings → Defaults & scoring** (rules in `src/lib/domain/follow-ups.ts`) |
| Pipeline stages, colours, default probabilities | **Settings → Pipeline** |
| Lead sources, industries, service categories | **Settings → Lists** |
| Custom qualification questions | **Settings → Qualification** (scoring in `src/lib/domain/qualification.ts`) |
| Commission maths | `src/lib/domain/commercials.ts` |
| Templates | **Templates** (in the app) |
| Problem → solution hints | `src/lib/domain/service-mapping.ts` and each service's "typical problem" |

## Scripts & tests

```bash
npm run lint
npm run typecheck
npm test                  # unit tests (commission maths, scoring, templates, CSV import, validation…)
npm run build
```

**Integration tests** (RLS, triggers, the whole workflow against a real Supabase API) — point them at a local (`supabase start`) or throwaway **test** project, never production:

```bash
SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_ANON_KEY=… \
SUPABASE_TEST_ADMIN_EMAIL=… SUPABASE_TEST_ADMIN_PASSWORD=… \
npm run test:integration
```

**End-to-end acceptance test** (partner → prospect → outreach → qualify → opportunities → handoff → won → client → payments → search → CSV, through the UI) — with the app running against a test project:

```bash
E2E_BASE_URL=http://localhost:3000 E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e
```

After changing the schema, regenerate types: `DATABASE_URL=postgres://… node scripts/gen-db-types.mjs`.

## Deliberately not built

No automated LinkedIn/Instagram/WhatsApp/email sending, scraping (incl. Google Maps), AI lead generation, bulk messaging, payment gateways, client portal, accounting or full project management.
