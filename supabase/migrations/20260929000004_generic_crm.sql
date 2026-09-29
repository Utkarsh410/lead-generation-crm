-- LeadOS — repurpose into a vendor-neutral personal Lead Generation & Sales CRM.
--
-- Safe data migration (runs on databases created by migrations 0001–0003):
--   * demo prospects (is_demo = true) are removed — they were vendor-specific seed
--     data; generic demo data can be re-loaded from Settings
--   * every real prospect, message, task, activity, qualification and handoff is kept
--   * prospect pipeline stages become lead statuses; opportunities move to a
--     configurable per-user sales pipeline (one default pipeline, more later)
--   * previously agreed commission percentages are kept as explicit per-deal terms;
--     won deals with money recorded become client + project + payment records
--   * seeded reference data (vendor service sheet, project types, commission tiers,
--     unedited seeded templates) is replaced by generic, user-owned configuration

-- ===========================================================================
-- 0. Remove vendor-specific demo data (children cascade)
-- ===========================================================================
delete from public.prospects where is_demo;

-- ===========================================================================
-- 1. Profile: personal + business settings
-- ===========================================================================
alter table public.profiles
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists linkedin_url text,
  add column if not exists business_name text,
  add column if not exists business_description text,
  add column if not exists business_website text,
  add column if not exists currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists timezone text,
  add column if not exists follow_up_1_days smallint not null default 3 check (follow_up_1_days between 1 and 60),
  add column if not exists follow_up_2_days smallint not null default 5 check (follow_up_2_days between 1 and 60),
  add column if not exists score_weights jsonb;

-- ===========================================================================
-- 2. Configurable lookups (lead sources, industries, service categories)
-- ===========================================================================
create table if not exists public.lookup_values (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('lead_source', 'industry', 'service_category')),
  value text not null check (value ~ '^[a-z0-9_]{1,60}$'),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, kind, value)
);
create trigger lookup_values_updated_at before update on public.lookup_values
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 3. Services: replace the vendor service sheet with a user-owned catalog
-- ===========================================================================
drop table if exists public.project_types;
drop table if exists public.commission_settings;
drop table if exists public.services;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text,
  description text,
  target_customer text,
  typical_problem text,
  delivery_model text check (delivery_model in ('self_delivered', 'partner_delivered', 'referral', 'white_label', 'joint_delivery')),
  pricing_model text check (pricing_model in ('fixed_price', 'hourly', 'retainer', 'per_project', 'commission', 'custom')),
  default_price numeric(14, 2) check (default_price is null or default_price >= 0),
  discovery_questions text[] not null default '{}',
  notes text,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_owner_idx on public.services (owner_id, active);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 4. Partners
-- ===========================================================================
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  contact_name text,
  email text,
  phone text,
  website text,
  linkedin_url text,
  location text,
  partner_type text not null default 'other' check (partner_type in (
    'development_agency', 'marketing_agency', 'freelancer', 'designer', 'developer',
    'consultant', 'software_company', 'seo_agency', 'other')),
  services text[] not null default '{}',
  notes text,
  status text not null default 'prospect' check (status in ('prospect', 'contacted', 'interested', 'active', 'inactive')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partners_owner_idx on public.partners (owner_id, status);
create trigger partners_updated_at before update on public.partners
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 5. Pipelines and stages (one default pipeline per user; more can be added)
-- ===========================================================================
create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pipelines_one_default on public.pipelines (owner_id) where is_default;
create trigger pipelines_updated_at before update on public.pipelines
  for each row execute function public.set_updated_at();

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  -- system key for built-in behaviour (reminders on discovery/proposal, won/lost);
  -- null for custom stages
  key text check (key in ('new', 'contacted', 'replied', 'qualified', 'discovery', 'proposal', 'negotiation', 'won', 'lost', 'nurture')),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  color text not null default 'slate' check (color in ('slate', 'sky', 'blue', 'indigo', 'violet', 'amber', 'orange', 'green', 'red', 'teal')),
  kind text not null default 'open' check (kind in ('open', 'won', 'lost', 'parked')),
  probability smallint not null default 0 check (probability between 0 and 100),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pipeline_stages_key_unique on public.pipeline_stages (pipeline_id, key) where key is not null;
create index if not exists pipeline_stages_pipeline_idx on public.pipeline_stages (pipeline_id, sort_order);
create trigger pipeline_stages_updated_at before update on public.pipeline_stages
  for each row execute function public.set_updated_at();

create or replace function public.ensure_default_pipeline(p_owner uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
begin
  select id into pid from public.pipelines where owner_id = p_owner and is_default;
  if pid is not null then
    return pid;
  end if;
  insert into public.pipelines (owner_id, name, is_default) values (p_owner, 'Sales pipeline', true)
  returning id into pid;
  insert into public.pipeline_stages (owner_id, pipeline_id, key, label, color, kind, probability, sort_order) values
    (p_owner, pid, 'new',         'New',         'slate',  'open',    5,  1),
    (p_owner, pid, 'contacted',   'Contacted',   'sky',    'open',   10,  2),
    (p_owner, pid, 'replied',     'Replied',     'blue',   'open',   20,  3),
    (p_owner, pid, 'qualified',   'Qualified',   'indigo', 'open',   30,  4),
    (p_owner, pid, 'discovery',   'Discovery',   'violet', 'open',   40,  5),
    (p_owner, pid, 'proposal',    'Proposal',    'amber',  'open',   60,  6),
    (p_owner, pid, 'negotiation', 'Negotiation', 'orange', 'open',   75,  7),
    (p_owner, pid, 'won',         'Won',         'green',  'won',   100,  8),
    (p_owner, pid, 'lost',        'Lost',        'red',    'lost',    0,  9),
    (p_owner, pid, 'nurture',     'Nurture',     'teal',   'parked',  5, 10);
  return pid;
end;
$$;
revoke execute on function public.ensure_default_pipeline(uuid) from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    perform public.ensure_default_pipeline(r.id);
  end loop;
end;
$$;

-- new users get a profile (first user = admin) and a default pipeline
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when exists (select 1 from public.profiles where role = 'admin') then 'pending'
      else 'admin'
    end
  );
  perform public.ensure_default_pipeline(new.id);
  return new;
end;
$$;

-- ===========================================================================
-- 6. Opportunities: many per prospect, on a pipeline, with commercial terms
-- ===========================================================================
alter table public.opportunities
  add column if not exists pipeline_id uuid references public.pipelines (id) on delete restrict,
  add column if not exists stage_id uuid references public.pipeline_stages (id) on delete restrict,
  add column if not exists service_id uuid references public.services (id) on delete set null,
  add column if not exists partner_id uuid references public.partners (id) on delete set null,
  add column if not exists description text,
  add column if not exists probability smallint check (probability between 0 and 100),
  add column if not exists delivery_model text check (delivery_model in ('self_delivered', 'partner_delivered', 'referral', 'white_label', 'joint_delivery')),
  add column if not exists next_action text,
  add column if not exists next_action_date date,
  add column if not exists lost_reason text,
  add column if not exists stage_changed_at timestamptz not null default now(),
  add column if not exists revenue_model text check (revenue_model in ('direct_revenue', 'referral_commission', 'partner_commission', 'revenue_share', 'fixed_fee', 'other')),
  add column if not exists commission_type text check (commission_type in ('none', 'percentage', 'fixed')),
  add column if not exists commission_percentage numeric(5, 2) check (commission_percentage is null or (commission_percentage >= 0 and commission_percentage <= 100)),
  add column if not exists fixed_commission numeric(14, 2) check (fixed_commission is null or fixed_commission >= 0),
  add column if not exists commission_basis text check (commission_basis in ('total_project_value', 'amount_received', 'net_revenue', 'custom')),
  add column if not exists commission_notes text;

-- place every existing opportunity on its owner's default pipeline, at the stage its
-- prospect had reached under the old single pipeline
update public.opportunities o
   set pipeline_id = pl.id,
       stage_id = st.id,
       probability = st.probability,
       stage_changed_at = p.stage_changed_at
  from public.prospects p, public.pipelines pl, public.pipeline_stages st
 where p.id = o.prospect_id
   and pl.owner_id = o.owner_id and pl.is_default
   and st.pipeline_id = pl.id
   and st.key = case
         when o.status = 'won' then 'won'
         when o.status = 'lost' or p.stage = 'lost' then 'lost'
         else case p.stage
           when 'discovery_call' then 'discovery'
           when 'technical_discussion' then 'discovery'
           when 'proposal_sent' then 'proposal'
           when 'negotiation' then 'negotiation'
           when 'won' then 'won'
           else 'qualified'
         end
       end;

-- carry over explicitly agreed commission terms (the earlier agreement was a % of
-- the eligible amount actually received, excluding pass-through costs)
update public.opportunities
   set commission_type = 'percentage',
       commission_percentage = agreed_commission_pct,
       commission_basis = 'amount_received',
       delivery_model = 'partner_delivered',
       revenue_model = 'partner_commission',
       commission_notes = trim(both ' ' from 'Migrated agreement: % of the eligible amount actually received (excluding tax and pass-through costs). ' || coalesce(pass_through_notes, ''))
 where agreed_commission_pct is not null;

-- a generic "legacy" partner for real deals that recorded a delivery partner's commission
insert into public.partners (owner_id, name, partner_type, status, notes)
select distinct o.owner_id, 'Legacy delivery partner', 'development_agency', 'active',
       'Created automatically for deals recorded before LeadOS became vendor-neutral. Rename or merge as needed.'
  from public.opportunities o
 where o.agreed_commission_pct is not null
    or coalesce(o.eligible_amount_received, 0) > 0
    or coalesce(o.commission_paid, 0) > 0;

update public.opportunities o
   set partner_id = pa.id
  from public.partners pa
 where pa.owner_id = o.owner_id and pa.name = 'Legacy delivery partner'
   and (o.agreed_commission_pct is not null or coalesce(o.eligible_amount_received, 0) > 0 or coalesce(o.commission_paid, 0) > 0);

-- ===========================================================================
-- 7. Clients, projects, payments
-- ===========================================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid references public.prospects (id) on delete set null,
  company text not null check (char_length(btrim(company)) between 1 and 200),
  primary_contact text,
  email text,
  phone text,
  website text,
  industry text,
  location text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive', 'past_client', 'nurture')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clients_prospect_unique on public.clients (prospect_id) where prospect_id is not null;
create index if not exists clients_owner_idx on public.clients (owner_id, status);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  partner_id uuid references public.partners (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  delivery_model text check (delivery_model in ('self_delivered', 'partner_delivered', 'referral', 'white_label', 'joint_delivery')),
  total_project_value numeric(14, 2) check (total_project_value is null or total_project_value >= 0),
  start_date date,
  expected_end_date date,
  status text not null default 'not_started' check (status in ('not_started', 'active', 'on_hold', 'completed', 'cancelled')),
  notes text,
  -- commercial terms (chosen explicitly per project — no defaults are assumed)
  revenue_model text check (revenue_model in ('direct_revenue', 'referral_commission', 'partner_commission', 'revenue_share', 'fixed_fee', 'other')),
  payment_flow text not null default 'client_pays_me' check (payment_flow in ('client_pays_me', 'client_pays_partner')),
  partner_cost numeric(14, 2) check (partner_cost is null or partner_cost >= 0),
  commission_type text check (commission_type in ('none', 'percentage', 'fixed')),
  commission_percentage numeric(5, 2) check (commission_percentage is null or (commission_percentage >= 0 and commission_percentage <= 100)),
  fixed_commission numeric(14, 2) check (fixed_commission is null or fixed_commission >= 0),
  commission_basis text check (commission_basis in ('total_project_value', 'amount_received', 'net_revenue', 'custom')),
  commission_custom_base numeric(14, 2) check (commission_custom_base is null or commission_custom_base >= 0),
  commission_received numeric(14, 2) not null default 0 check (commission_received >= 0),
  commission_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_dates check (expected_end_date is null or start_date is null or expected_end_date >= start_date),
  constraint projects_pct_terms check (commission_type is distinct from 'percentage' or (commission_percentage is not null and commission_basis is not null)),
  constraint projects_fixed_terms check (commission_type is distinct from 'fixed' or fixed_commission is not null),
  constraint projects_custom_base check (commission_basis is distinct from 'custom' or commission_type is distinct from 'percentage' or commission_custom_base is not null)
);
create index if not exists projects_client_idx on public.projects (client_id);
create index if not exists projects_owner_status_idx on public.projects (owner_id, status);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  payment_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  payment_type text not null default 'other' check (payment_type in ('advance', 'milestone', 'final', 'retainer', 'other')),
  status text not null default 'expected' check (status in ('expected', 'received', 'failed', 'refunded')),
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_project_idx on public.payments (project_id, payment_date);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- won deals → client + project (+ payment when money was recorded)
insert into public.clients (owner_id, prospect_id, company, primary_contact, email, phone, website, industry, location, status)
select distinct on (p.id) p.owner_id, p.id, p.business_name, p.contact_name, p.email, p.phone, p.website, p.industry, p.location, 'active'
  from public.prospects p
  join public.opportunities o on o.prospect_id = p.id
 where (p.stage = 'won' or o.status = 'won')
   and not exists (select 1 from public.clients c where c.prospect_id = p.id);

insert into public.projects (
  owner_id, client_id, opportunity_id, partner_id, name, delivery_model, total_project_value, status,
  revenue_model, payment_flow, commission_type, commission_percentage, commission_basis, commission_received, commission_notes, notes)
select o.owner_id, c.id, o.id, o.partner_id, o.title, o.delivery_model,
       coalesce(o.eligible_project_amount, o.estimated_value), 'active',
       o.revenue_model,
       case when o.partner_id is not null then 'client_pays_partner' else 'client_pays_me' end,
       o.commission_type, o.commission_percentage, o.commission_basis, coalesce(o.commission_paid, 0), o.commission_notes, o.notes
  from public.opportunities o
  join public.clients c on c.prospect_id = o.prospect_id
 where o.status = 'won'
   and not exists (select 1 from public.projects pr where pr.opportunity_id = o.id);

insert into public.payments (owner_id, project_id, payment_date, amount, payment_type, status, notes)
select o.owner_id, pr.id, coalesce(o.closed_at::date, current_date), o.eligible_amount_received, 'other', 'received',
       'Migrated: eligible amount recorded as received before the upgrade.'
  from public.opportunities o
  join public.projects pr on pr.opportunity_id = o.id
 where coalesce(o.eligible_amount_received, 0) > 0;

-- the old per-deal money columns now live on projects/payments
alter table public.opportunities
  drop column if exists eligible_project_amount,
  drop column if exists agreed_commission_pct,
  drop column if exists eligible_amount_received,
  drop column if exists commission_paid,
  drop column if exists pass_through_notes;

-- ===========================================================================
-- 8. Prospects: stage → lead status, generic prospect types, custom sources
-- ===========================================================================
alter table public.prospects drop constraint if exists prospects_stage_check;
alter table public.prospects drop constraint if exists prospects_furthest_stage_check;
alter table public.prospects drop constraint if exists prospects_lead_source_check;
alter table public.prospects drop constraint if exists prospects_prospect_type_check;

-- keep the agency speciality in industry before collapsing the agency sub-types
update public.prospects
   set industry = case prospect_type
         when 'marketing_agency' then 'Marketing agency'
         when 'seo_agency' then 'SEO agency'
         when 'branding_agency' then 'Branding agency'
         when 'social_media_agency' then 'Social media agency'
         when 'web_design_agency' then 'Web design agency'
       end
 where industry is null
   and prospect_type in ('marketing_agency', 'seo_agency', 'branding_agency', 'social_media_agency', 'web_design_agency');

update public.prospects set prospect_type = 'agency'
 where prospect_type in ('marketing_agency', 'seo_agency', 'branding_agency', 'social_media_agency', 'web_design_agency');

-- the stage triggers would log every remap and reset stage timestamps; disable them
-- (and updated_at stamping) for this bulk remap
alter table public.prospects disable trigger prospects_stage_change;
alter table public.prospects disable trigger prospects_stage_stamp;
alter table public.prospects disable trigger prospects_updated_at;
update public.prospects
   set stage = case stage
         when 'prospect' then 'new'
         when 'discovery_call' then 'qualified'
         when 'technical_discussion' then 'qualified'
         when 'proposal_sent' then 'qualified'
         when 'negotiation' then 'qualified'
         when 'won' then 'client'
         else stage
       end,
       furthest_stage = case furthest_stage
         when 'prospect' then 'new'
         when 'discovery_call' then 'qualified'
         when 'technical_discussion' then 'qualified'
         when 'proposal_sent' then 'qualified'
         when 'negotiation' then 'qualified'
         when 'won' then 'client'
         else furthest_stage
       end;
alter table public.prospects enable trigger prospects_stage_change;
alter table public.prospects enable trigger prospects_stage_stamp;
alter table public.prospects enable trigger prospects_updated_at;

alter table public.prospects alter column stage set default 'new';
alter table public.prospects alter column furthest_stage set default 'new';
alter table public.prospects add constraint prospects_stage_check
  check (stage in ('new', 'contacted', 'replied', 'qualified', 'nurture', 'client', 'lost'));
alter table public.prospects add constraint prospects_furthest_stage_check
  check (furthest_stage in ('new', 'contacted', 'replied', 'qualified', 'client'));
alter table public.prospects add constraint prospects_prospect_type_check
  check (prospect_type in ('direct_business', 'startup', 'agency', 'freelancer', 'creator', 'consultant', 'professional', 'other'));
-- built-in sources plus the user's custom ones (validated by the app)
alter table public.prospects add constraint prospects_lead_source_check
  check (lead_source ~ '^[a-z0-9_]{1,60}$');

create or replace function public.funnel_position(stage text)
returns int
language sql
immutable
as $$
  select coalesce(array_position(array['new', 'contacted', 'replied', 'qualified', 'client'], stage), 0);
$$;

create or replace function public.stamp_prospect_stage_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.stage_changed_at = now();
    new.last_activity_at = now();
  end if;
  if new.stage not in ('lost', 'nurture')
     and public.funnel_position(new.stage) > public.funnel_position(new.furthest_stage) then
    new.furthest_stage = new.stage;
  end if;
  return new;
end;
$$;

create or replace function public.log_prospect_stage_change()
returns trigger
language plpgsql
as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.activities (owner_id, prospect_id, activity_type, title, metadata)
    values (new.owner_id, new.id, 'stage_change', 'Lead status: ' || old.stage || ' → ' || new.stage,
            jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  return null;
end;
$$;

-- ===========================================================================
-- 9. Opportunity stage integrity, status sync and audit trail
-- ===========================================================================
create or replace function public.sync_opportunity_stage()
returns trigger
language plpgsql
as $$
declare
  s record;
begin
  select pipeline_id, kind, probability into s from public.pipeline_stages where id = new.stage_id;
  if not found then
    raise exception 'Unknown pipeline stage';
  end if;
  if new.pipeline_id is null then
    new.pipeline_id = s.pipeline_id;
  elsif new.pipeline_id <> s.pipeline_id then
    raise exception 'Stage does not belong to the opportunity''s pipeline';
  end if;
  new.status = case s.kind when 'won' then 'won' when 'lost' then 'lost' else 'open' end;
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    new.stage_changed_at = now();
    if new.probability is null or (tg_op = 'UPDATE' and new.probability is not distinct from old.probability) then
      new.probability = s.probability;
    end if;
    new.closed_at = case when s.kind in ('won', 'lost') then now() else null end;
  end if;
  return new;
end;
$$;

create trigger opportunities_sync_stage before insert or update of stage_id, pipeline_id on public.opportunities
  for each row execute function public.sync_opportunity_stage();

create or replace function public.log_opportunity_stage_change()
returns trigger
language plpgsql
as $$
declare
  old_label text;
  new_label text;
  new_key text;
begin
  if new.stage_id is distinct from old.stage_id then
    select label into old_label from public.pipeline_stages where id = old.stage_id;
    select label, key into new_label, new_key from public.pipeline_stages where id = new.stage_id;
    insert into public.activities (owner_id, prospect_id, activity_type, title, metadata)
    values (new.owner_id, new.prospect_id, 'opportunity',
            'Opportunity “' || new.title || '”: ' || coalesce(old_label, '?') || ' → ' || coalesce(new_label, '?'),
            jsonb_build_object('opportunity_id', new.id, 'from_stage', old.stage_id, 'to_stage', new.stage_id, 'to_key', new_key));
  end if;
  return null;
end;
$$;

create trigger opportunities_stage_log after update of stage_id on public.opportunities
  for each row execute function public.log_opportunity_stage_change();

-- opportunities created before the upgrade but never placed (no prospect stage match)
update public.opportunities o
   set stage_id = st.id
  from public.pipeline_stages st, public.pipelines pl
 where o.stage_id is null
   and pl.owner_id = o.owner_id and pl.is_default
   and st.pipeline_id = pl.id and st.key = case o.status when 'won' then 'won' when 'lost' then 'lost' else 'qualified' end;

alter table public.opportunities alter column pipeline_id set not null;
alter table public.opportunities alter column stage_id set not null;
create index if not exists opportunities_stage_idx on public.opportunities (owner_id, pipeline_id, stage_id);

-- ===========================================================================
-- 10. Tasks, activities, qualification, handoffs, templates
-- ===========================================================================
alter table public.tasks
  add column if not exists opportunity_id uuid references public.opportunities (id) on delete cascade,
  add column if not exists client_id uuid references public.clients (id) on delete cascade,
  add column if not exists partner_id uuid references public.partners (id) on delete cascade;
alter table public.tasks drop constraint if exists tasks_task_type_check;
alter table public.tasks add constraint tasks_task_type_check check (task_type in (
  'first_outreach', 'follow_up', 'discovery_call', 'proposal_follow_up', 'qualification',
  'client_follow_up', 'partner_follow_up', 'internal_follow_up', 'handoff', 'other'));
create index if not exists tasks_partner_idx on public.tasks (partner_id) where partner_id is not null;
create index if not exists tasks_client_idx on public.tasks (client_id) where client_id is not null;

alter table public.activities drop constraint if exists activities_activity_type_check;
alter table public.activities add constraint activities_activity_type_check check (activity_type in (
  'prospect_created', 'prospect_updated', 'note', 'stage_change', 'outreach_sent',
  'response_recorded', 'task_created', 'task_completed', 'task_rescheduled',
  'task_cancelled', 'qualification', 'handoff', 'opportunity', 'client', 'project',
  'payment', 'archived', 'restored'));

alter table public.qualification_assessments
  add column if not exists opportunity_id uuid references public.opportunities (id) on delete set null,
  add column if not exists solution_fit smallint check (solution_fit between 1 and 5),
  add column if not exists delivery_feasibility smallint check (delivery_feasibility between 1 and 5),
  add column if not exists custom_answers jsonb not null default '[]'::jsonb;

create table if not exists public.qualification_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 300),
  help_text text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger qualification_questions_updated_at before update on public.qualification_questions
  for each row execute function public.set_updated_at();

alter table public.handoffs
  add column if not exists opportunity_id uuid references public.opportunities (id) on delete set null,
  add column if not exists partner_id uuid references public.partners (id) on delete set null;

-- templates: generic prospect types and purposes
-- seeded vendor templates: remove the unedited ones; keep (deactivated) any the user edited
delete from public.outreach_templates
 where created_by is null
   and updated_at <= created_at + interval '1 second';
update public.outreach_templates
   set is_active = false,
       name = '(Legacy) ' || name
 where created_by is null
   and name not like '(Legacy) %';

alter table public.outreach_templates drop constraint if exists outreach_templates_audience_check;
alter table public.outreach_templates drop constraint if exists outreach_templates_outreach_stage_check;
update public.outreach_templates set audience = case
    when audience in ('marketing_agency', 'seo_agency', 'branding_agency', 'social_media_agency') then 'agency'
    when audience in ('education', 'healthcare', 'ecommerce') then 'direct_business'
    when audience = 'professional_services' then 'professional'
    else audience
  end;
alter table public.outreach_templates add constraint outreach_templates_audience_check check (audience in (
  'direct_business', 'startup', 'agency', 'freelancer', 'creator', 'consultant', 'professional', 'other', 'general'));
alter table public.outreach_templates add constraint outreach_templates_outreach_stage_check check (outreach_stage in (
  'first_contact', 'follow_up_1', 'follow_up_2', 'interested_response', 'discovery_call_invitation',
  'post_call_follow_up', 'proposal_follow_up', 're_engagement', 'partner_outreach', 'client_check_in'));
-- phone scripts and "other" templates are allowed too
alter table public.outreach_templates drop constraint if exists outreach_templates_channel_check;
alter table public.outreach_templates add constraint outreach_templates_channel_check check (channel in (
  'email', 'linkedin', 'instagram', 'whatsapp', 'phone', 'other'));

alter table public.outreach_messages drop constraint if exists outreach_messages_outreach_stage_check;
alter table public.outreach_messages add constraint outreach_messages_outreach_stage_check check (outreach_stage in (
  'first_contact', 'follow_up_1', 'follow_up_2', 'interested_response', 'discovery_call_invitation',
  'post_call_follow_up', 'proposal_follow_up', 're_engagement', 'partner_outreach', 'client_check_in'));

insert into public.outreach_templates (name, channel, audience, outreach_stage, subject, body, is_generic, created_by) values
  ('Direct business — first contact', 'email', 'direct_business', 'first_contact',
   'Quick idea for {{company_name}}',
   E'Hi {{first_name}},\n\nI came across {{company_name}} and noticed {{observation}}.\n\nI noticed {{specific_problem}} and had an idea for how {{service}} could help.\n\nWould you be open to a quick conversation?\n\nBest,\n{{my_name}}',
   true, null),
  ('Agency — partnership first contact', 'email', 'agency', 'first_contact',
   'Supporting {{company_name}}''s clients',
   E'Hi {{first_name}},\n\nI came across {{company_name}} and noticed {{observation}}.\n\nI help agencies deliver {{service}} for their clients, so your team can keep the client relationship while the delivery is handled.\n\nWould you be open to a short call to see whether there''s a fit?\n\nBest,\n{{my_name}}',
   true, null),
  ('Startup — first contact', 'linkedin', 'startup', 'first_contact', null,
   E'Hi {{first_name}}, I saw {{observation}}. I work on {{service}} for early-stage teams and had a thought on {{specific_problem}}. Open to a quick chat?',
   true, null),
  ('Short WhatsApp intro', 'whatsapp', 'general', 'first_contact', null,
   E'Hi {{first_name}}, this is {{my_name}}. I came across {{company_name}} and noticed {{specific_problem}}. I help businesses with {{solution}}. Would you be open to a quick 10-minute call this week?',
   true, null),
  ('Instagram DM intro', 'instagram', 'general', 'first_contact', null,
   E'Hi {{first_name}}! Loved {{observation}}. I help businesses like {{company_name}} with {{service}} — happy to share a quick idea if useful.',
   true, null),
  ('Follow-up #1', 'email', 'general', 'follow_up_1',
   'Re: {{company_name}}',
   E'Hi {{first_name}},\n\nJust following up on my earlier note about {{specific_problem}}.\n\nHappy to share a couple of examples of how similar businesses solved this — no obligation.\n\nBest,\n{{my_name}}',
   false, null),
  ('Follow-up #2 — closing the loop', 'email', 'general', 'follow_up_2',
   'Re: {{company_name}}',
   E'Hi {{first_name}},\n\nClosing the loop on my previous messages. If now isn''t the right time, no problem at all.\n\nIf {{specific_problem}} becomes a priority later, I''d be glad to help.\n\nBest,\n{{my_name}}',
   false, null),
  ('Interested response', 'email', 'general', 'interested_response',
   'Re: next steps',
   E'Hi {{first_name}},\n\nThanks for getting back to me — great to hear this is relevant.\n\nTo make the most of a call, could you share what you''re currently using and what isn''t working?\n\nWhat time works for a 20-minute call this week?\n\nBest,\n{{my_name}}',
   false, null),
  ('Discovery call invitation', 'email', 'general', 'discovery_call_invitation',
   'Discovery call — {{company_name}}',
   E'Hi {{first_name}},\n\nWould you be available for a 20–30 minute call to understand your requirements for {{service}}?\n\nWe''ll cover what you''re trying to achieve, how things work today, and timeline and budget expectations.\n\nPlease share a couple of time slots that work for you.\n\nBest,\n{{my_name}}',
   false, null),
  ('Post-call follow-up', 'email', 'general', 'post_call_follow_up',
   'Thanks for the call — next steps',
   E'Hi {{first_name}},\n\nThanks for your time today. Summary of what we discussed:\n- Problem: {{specific_problem}}\n- Possible solution: {{solution}}\n\nNext step: I''ll put together a proposal and share it shortly.\n\nBest,\n{{my_name}}',
   false, null),
  ('Proposal follow-up', 'email', 'general', 'proposal_follow_up',
   'Re: Proposal for {{company_name}}',
   E'Hi {{first_name}},\n\nJust checking whether you had a chance to review the proposal for {{service}}.\n\nHappy to jump on a quick call to answer any questions.\n\nBest,\n{{my_name}}',
   false, null),
  ('Re-engagement', 'email', 'general', 're_engagement',
   'Checking in — {{company_name}}',
   E'Hi {{first_name}},\n\nWe spoke a while ago about {{specific_problem}}. Checking in to see whether this is back on your radar.\n\nIf it is, I''d be happy to reconnect.\n\nBest,\n{{my_name}}',
   false, null),
  ('Partner outreach', 'email', 'agency', 'partner_outreach',
   'Working together on {{service}} projects',
   E'Hi {{first_name}},\n\nI work with businesses that need {{service}} and I''m looking for a reliable partner for delivery and referrals.\n\nI came across {{company_name}} and noticed {{observation}}. Would you be open to a short call to explore working together?\n\nBest,\n{{my_name}}',
   true, null),
  ('Client check-in', 'email', 'general', 'client_check_in',
   'Checking in — {{company_name}}',
   E'Hi {{first_name}},\n\nHope things are going well with {{service}}. Is there anything you need, or anything else on your list I could help with?\n\nBest,\n{{my_name}}',
   false, null);

-- ===========================================================================
-- 11. Row Level Security for the new tables
-- ===========================================================================
do $$
declare
  t text;
begin
  foreach t in array array['lookup_values', 'services', 'partners', 'pipelines', 'qualification_questions', 'clients'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$
      create policy "%s: owner all" on public.%I
        for all to authenticated
        using (owner_id = (select auth.uid()) and (select public.is_member()))
        with check (owner_id = (select auth.uid()) and (select public.is_member()))
    $p$, t, t);
  end loop;
end;
$$;

alter table public.pipeline_stages enable row level security;
create policy "pipeline_stages: owner all" on public.pipeline_stages
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_member()))
  with check (owner_id = (select auth.uid()) and (select public.is_member())
              and exists (select 1 from public.pipelines p where p.id = pipeline_id));

alter table public.projects enable row level security;
create policy "projects: owner all" on public.projects
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_member()))
  with check (
    owner_id = (select auth.uid()) and (select public.is_member())
    and exists (select 1 from public.clients c where c.id = client_id)
    and (opportunity_id is null or exists (select 1 from public.opportunities o where o.id = opportunity_id))
    and (service_id is null or exists (select 1 from public.services s where s.id = service_id))
    and (partner_id is null or exists (select 1 from public.partners pa where pa.id = partner_id))
  );

alter table public.payments enable row level security;
create policy "payments: owner all" on public.payments
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_member()))
  with check (owner_id = (select auth.uid()) and (select public.is_member())
              and exists (select 1 from public.projects p where p.id = project_id));

-- clients may only point at the user's own prospects
drop policy if exists "clients: owner all" on public.clients;
create policy "clients: owner all" on public.clients
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_member()))
  with check (owner_id = (select auth.uid()) and (select public.is_member())
              and (prospect_id is null or exists (select 1 from public.prospects p where p.id = prospect_id)));

-- opportunities: related rows must be the user's own
drop policy if exists "opportunities: owner all" on public.opportunities;
create policy "opportunities: owner all" on public.opportunities
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_member()))
  with check (
    owner_id = (select auth.uid()) and (select public.is_member())
    and exists (select 1 from public.prospects p where p.id = prospect_id)
    and exists (select 1 from public.pipeline_stages s where s.id = stage_id)
    and (service_id is null or exists (select 1 from public.services s where s.id = service_id))
    and (partner_id is null or exists (select 1 from public.partners pa where pa.id = partner_id))
  );

drop policy if exists "tasks: owner all" on public.tasks;
create policy "tasks: owner all" on public.tasks
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_member()))
  with check (
    owner_id = (select auth.uid()) and (select public.is_member())
    and (prospect_id is null or exists (select 1 from public.prospects p where p.id = prospect_id))
    and (opportunity_id is null or exists (select 1 from public.opportunities o where o.id = opportunity_id))
    and (client_id is null or exists (select 1 from public.clients c where c.id = client_id))
    and (partner_id is null or exists (select 1 from public.partners pa where pa.id = partner_id))
  );

drop policy if exists "handoffs: owner all" on public.handoffs;
create policy "handoffs: owner all" on public.handoffs
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_member()))
  with check (
    owner_id = (select auth.uid()) and (select public.is_member())
    and exists (select 1 from public.prospects p where p.id = prospect_id)
    and (opportunity_id is null or exists (select 1 from public.opportunities o where o.id = opportunity_id))
    and (partner_id is null or exists (select 1 from public.partners pa where pa.id = partner_id))
  );

revoke all on public.lookup_values, public.services, public.partners, public.pipelines, public.pipeline_stages,
  public.clients, public.projects, public.payments, public.qualification_questions from anon;
grant select, insert, update, delete on public.lookup_values, public.services, public.partners, public.pipelines,
  public.pipeline_stages, public.clients, public.projects, public.payments, public.qualification_questions to authenticated;
