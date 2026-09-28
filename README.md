# BharatCoder LeadOS

**Client Acquisition & Sales Pipeline** — an internal, human-in-the-loop CRM for finding, contacting, qualifying and handing off clients to [BharatCoder.com](https://bharatcoder.com).

> LeadOS never sends messages, scrapes, or automates social platforms. Its "automation" only creates and cancels **reminders**. You personalise and send every message yourself.

## The daily workflow

1. **Dashboard** – what to do today: overdue/due follow-ups, prospects needing first outreach, discovery calls, proposals.
2. **Prospects** – add a lead (duplicate check by domain, email, phone and business name + location), record research and the internal opportunity score.
3. **Outreach** – pick a template, fill the `{{variables}}`, personalise, send it from your own email/LinkedIn/Instagram/WhatsApp, then click **"I sent this — record it"**. A Follow-up #1 reminder is created for +3 days (Follow-up #2 for +5 days after that).
4. **Record the response** – a reply cancels pending automated follow-ups and creates a "Reply & qualify" task; "Not now" asks when to follow up; "Not interested" stops the sequence.
5. **Qualify** – 1–5 ratings suggest a classification; you choose the final one. Qualified leads get an opportunity record and a handoff reminder.
6. **Pipeline** – drag cards between stages; every move is logged in the activity history.
7. **Handoff** – generate the BharatCoder summary, edit it, copy as text/Markdown or download, mark it sent.
8. **Track to Won/Lost**, record the **agreed** commission % and payments received, and review **Analytics**.

Every prospect page shows a **Next step** banner so nothing is a passive record.

## Tech stack

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 · shadcn-style components (Radix) · Supabase (Postgres + Auth + Row Level Security) · Zod · React Hook Form · Lucide · dnd-kit · Vitest · Playwright.

See [`docs/PLAN.md`](docs/PLAN.md) for the architecture, data model and rules.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Apply the migrations in `supabase/migrations` **in order** — either:
   - Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`, or
   - Dashboard → SQL Editor: paste and run each file (`…0001_core_schema.sql`, `…0002_rls.sql`, `…0003_reference_data.sql`).
3. Authentication → Providers → Email: enabled. For a private tool, either turn **off** "Confirm email" or configure SMTP so the confirmation mail arrives.
4. Authentication → URL Configuration: set the Site URL to where you deploy LeadOS (e.g. `http://localhost:3000`).

### 2. Environment

```bash
cp .env.example .env.local
```

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | The public **anon** key. Never use the service-role key — LeadOS doesn't need it. |
| `LEADOS_ALLOWED_EMAILS` | no | Comma-separated allowlist of emails that may sign in. |
| `LEADOS_TIMEZONE` | no | Business timezone for "today" and due dates. Default `Asia/Kolkata`. |

### 3. Run

```bash
npm install
npm run dev          # http://localhost:3000
```

Open `/login` → **Create an account**. **The first account becomes admin.** Anyone who signs up later is *pending* until an admin approves them in **Settings → Users** (you can also disable sign-ups in Supabase once your account exists).

To explore: **Settings → Load demo data** creates 15 realistic demo prospects (marked **Demo**) with outreach, follow-ups, qualifications, an opportunity and a handoff. **Remove demo data** deletes them and everything attached — real prospects are untouched.

### Deploy

Any Next.js host works (e.g. Vercel). Set the same environment variables and add the deployed URL to Supabase's URL configuration.

## Security

- Every table has **Row Level Security**. Users only see their own prospects and related records; reference data (services, project types, templates, commission tiers) is shared among approved members; pending users see nothing.
- Only admins can change roles (enforced by a database trigger).
- Routes are protected in `src/proxy.ts`; every Server Action re-checks the session and approval, and re-validates input with Zod.
- CSV exports neutralise spreadsheet formulas; security headers are set in `next.config.ts`.

## Adjusting the rules

| What | Where |
| --- | --- |
| Opportunity score factors, weights, Hot/Warm thresholds | `src/lib/domain/opportunity-score.ts` |
| Qualification thresholds and warnings | `src/lib/domain/qualification.ts` |
| Follow-up delays (+3 / +5 days) and response rules | `src/lib/domain/follow-ups.ts` |
| Problem → service mapping rules | `src/lib/domain/service-mapping.ts` |
| Default templates | Editable in the app (**Templates**); seeds in `supabase/migrations/…0003_reference_data.sql` |
| Project catalog | Editable in the app (**Services → Project catalog**) |
| Commission reference tiers | `commission_settings` table (reference only — each opportunity stores the agreed %) |

## Scripts & tests

```bash
npm run lint
npm run typecheck
npm test                  # unit tests (domain logic, validation, CSV, scoring…)
npm run build
```

**Integration tests** (RLS, triggers, the whole workflow against a real Supabase API) — point them at a local (`supabase start`) or throwaway **test** project, never production:

```bash
SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_ANON_KEY=… \
SUPABASE_TEST_ADMIN_EMAIL=… SUPABASE_TEST_ADMIN_PASSWORD=… \
npm run test:integration
```

(The admin variables are needed once the project already has an admin; email auto-confirm must be on.)

**End-to-end acceptance test** (the 16-step workflow through the UI) — with the app running against a test project:

```bash
E2E_BASE_URL=http://localhost:3000 E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e
```

## Regenerating database types

After changing the schema: `DATABASE_URL=postgres://… node scripts/gen-db-types.mjs` (writes `src/lib/supabase/database.types.ts`).

## Out of scope for Week 1

No automated LinkedIn/Instagram/WhatsApp messaging, scraping, bulk messaging, AI-generated outreach, automatic sending, payments or client portals.
