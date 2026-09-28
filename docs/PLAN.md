# BharatCoder LeadOS — Week 1 Architecture & Plan

_Client Acquisition & Sales Pipeline — an internal, human-in-the-loop CRM._

## 1. Repository inspection (Phase 1)

| Item | Finding |
| --- | --- |
| Existing code | None. The repository was empty (no commits), so there was no stack to preserve. |
| Framework | Greenfield → **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4**. |
| Database | **Supabase (PostgreSQL)**. Migrations live in `supabase/migrations` (Supabase CLI layout). |
| Auth | **Supabase Auth** (email + password) via `@supabase/ssr`, cookies-based sessions, route protection in `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`). |
| UI | shadcn/ui-style components written into `src/components/ui` (Radix primitives + `class-variance-authority`). The shadcn registry is not reachable from the build environment, so components were authored by hand following shadcn conventions. |
| Forms / validation | React Hook Form + Zod on the client; the **same Zod schemas re-validate every Server Action** on the server. |
| Icons | lucide-react. |
| Env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional `LEADOS_ALLOWED_EMAILS`, `LEADOS_TIMEZONE`. No service-role key is needed by the app. |

## 2. Architecture

```
src/
  app/
    (auth)/login            — sign in / first-time sign up
    (app)/…                 — protected app (sidebar layout)
      dashboard, prospects, pipeline, outreach, follow-ups,
      qualification, services, templates, handoffs, analytics, settings
    api/export/[kind]       — CSV exports (auth-checked route handlers)
  components/ui             — design-system primitives
  components/…              — feature components
  lib/
    domain/                 — PURE business logic (no I/O, fully unit-tested)
      constants.ts            enums/labels (mirrors DB CHECK constraints)
      opportunity-score.ts    0–100 prioritisation score + temperature
      qualification.ts        1–5 ratings → score + suggested classification
      duplicates.ts           normalisation + duplicate matching
      templates.ts            {{variable}} rendering + personalisation checks
      follow-ups.ts           follow-up sequence rules (creates tasks, never sends)
      pipeline.ts             stage-change side effects
      handoff.ts              handoff summary generation (Markdown)
      csv.ts                  CSV serialisation (with formula-injection guard)
      commission.ts           reference tiers (never auto-applied)
      service-mapping.ts      manual problem → service recommendation rules
      metrics.ts              funnel/acquisition rates
      dates.ts                timezone-aware "today" helpers
    validation/             — Zod schemas shared by forms and server actions
    data/                   — Supabase queries/mutations (take a client param)
    actions/                — "use server" actions: auth → validate → data → revalidate
    supabase/               — server/browser client factories
supabase/migrations         — schema, RLS, triggers, reference data
tests/unit                  — Vitest, pure domain + validation
tests/integration           — Vitest against a real Supabase-compatible API (RLS, triggers)
```

Key principles

- **Business rules are pure functions** in `lib/domain` (easy to test and to change — e.g. score weights live in one config object).
- **Server Actions are thin**: authenticate → Zod-validate → call `lib/data` → `revalidatePath`.
- **Database enforces integrity**: CHECK constraints, FKs, `numeric(14,2)` for money, RLS on every table, triggers for audit trail (stage changes) and denormalised "last contact / next follow-up" columns.
- **Nothing is ever sent automatically.** Automation only creates/cancels *tasks*.

## 3. Database schema (Phase 2)

All tables have `created_at`/`updated_at` and RLS enabled.

| Table | Purpose | Ownership |
| --- | --- | --- |
| `profiles` | App users (`users`). Role: `admin` / `member` / `pending`. First sign-up becomes admin; later sign-ups stay pending until approved in Settings. | self |
| `prospects` | Core lead record: basic info, source, prospect type, research, tri-state indicators, opportunity score factors, stage, estimated value, duplicate keys, denormalised `last_contacted_at` / `last_activity_at` / `next_follow_up_date`, `archived_at`, `is_demo`. | `owner_id` |
| `prospect_contacts` | Additional contacts for a prospect. | `owner_id` |
| `activities` | Timeline (notes, stage changes, outreach, responses, tasks, qualification, handoff). Stage changes are written by a DB trigger so they can never be missed. | `owner_id` |
| `outreach_templates` | Editable template library (channel × audience × stage). | shared workspace |
| `outreach_messages` | Every outreach attempt: channel, template, customised message, sent_at, response status/date, notes. | `owner_id` |
| `tasks` | Follow-ups / reminders (type, due date/time, priority, status, automated flag, sequence step). | `owner_id` |
| `opportunities` | Deal / project record: value, **agreed commission %** (entered manually), eligible amount, amount received. | `owner_id` |
| `qualification_assessments` | Structured qualification form + 1–5 ratings, computed score, suggested & final classification. | `owner_id` |
| `services`, `project_types` | BharatCoder service sheet & project catalog (no prices). | shared workspace |
| `handoffs` | Generated handoff summaries (Markdown + JSON snapshot), status draft/sent/accepted/declined. | `owner_id` |
| `commission_settings` | Reference commission tiers (display only). | shared workspace |

Authorization: every policy requires `public.is_member()` (approved user). Owned tables additionally require `owner_id = auth.uid()`, and child rows can only reference prospects the user owns.

## 4. Key rules

**Opportunity score (0–100, internal prioritisation only).** Eight manually-rated factors (0–3 each) with weights summing to 100: clear problem 20, development requirement 15, business active 10, decision maker identified 10, contact info available 10, website/software gap 15, urgency 10, potential project value 10. Temperature: Hot ≥ 70, Warm ≥ 40, else Cold. Weights/thresholds are in `lib/domain/opportunity-score.ts`.

**Qualification score.** Five ratings 1–5 → `(sum − 5) / 20 × 100`. Suggested: High Priority ≥ 80, Qualified ≥ 60, Potential ≥ 40, else Unqualified. The user always picks the final classification.

**Follow-up sequence (reminders only).**
- First contact recorded → task "Follow-up #1" due +3 days; pending First Outreach tasks completed; stage Prospect → Contacted.
- Follow-up #1 recorded → task "Follow-up #2" due +5 days.
- Response Replied / Interested → pending automated follow-ups cancelled, stage → Replied (if earlier), "Reply & qualify" task due today.
- Not Interested / Wrong Contact → sequence stopped (automated tasks cancelled).
- Not Now → sequence stopped + custom follow-up on the date the user chooses.

**Commission.** Tiers (12% / 10% / 7%) are shown as reference; each opportunity stores the actually agreed percentage. Commission = eligible amount received × agreed %.

## 5. Phases

1. Inspection + plan (this doc) · 2. Schema · 3. Prospects CRM · 4. Outreach templates + activity tracking · 5. Qualification · 6. Follow-ups · 7. Pipeline + handoffs · 8. Service sheet · 9. Dashboard + analytics · 10. Tests + polish.

## 6. Blockers / environment

- You need a Supabase project (free tier is fine): set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then apply `supabase/migrations`. See README.
- In Supabase Auth settings, you may disable public sign-ups after creating your account; LeadOS also keeps any later sign-ups in `pending` until an admin approves them.
