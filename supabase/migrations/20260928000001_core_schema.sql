-- BharatCoder LeadOS — core schema
-- Enumerated values are TEXT + CHECK constraints (easy to extend) and are mirrored
-- in src/lib/domain/constants.ts. Money uses numeric(14,2), never floating point.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (application users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  role text not null default 'pending' check (role in ('admin', 'member', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- An approved user (admin or member). Used by every RLS policy.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'member')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- First user to sign up becomes admin; everyone after that waits for approval.
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change roles (including their own).
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change user roles';
  end if;
  if new.id is distinct from old.id then
    raise exception 'Profile id cannot change';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Reference data (shared workspace): services, project types, commission tiers
-- ---------------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  examples text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

create table public.project_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  service_id uuid references public.services (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  typical_client text,
  typical_problem text,
  potential_solution text,
  discovery_questions text[] not null default '{}',
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_types_service_idx on public.project_types (service_id);

create trigger project_types_updated_at before update on public.project_types
  for each row execute function public.set_updated_at();

create table public.commission_settings (
  id uuid primary key default gen_random_uuid(),
  tier_name text not null,
  min_amount numeric(14, 2) not null check (min_amount >= 0),
  max_amount numeric(14, 2) check (max_amount is null or max_amount > min_amount),
  percentage numeric(5, 2) not null check (percentage >= 0 and percentage <= 100),
  sort_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger commission_settings_updated_at before update on public.commission_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- prospects
-- ---------------------------------------------------------------------------

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- basic information
  business_name text not null check (char_length(btrim(business_name)) between 1 and 200),
  contact_name text,
  job_title text,
  email text,
  phone text,
  whatsapp text,
  website text,
  linkedin_url text,
  instagram_url text,
  location text,
  country text,
  industry text,
  company_size text check (company_size in ('1', '2-10', '11-50', '51-200', '201-500', '500+')),

  -- lead source
  lead_source text not null default 'other' check (lead_source in (
    'google_maps', 'linkedin', 'instagram', 'cold_email', 'whatsapp', 'referral',
    'upwork', 'contra', 'freelancer', 'networking', 'agency_prospecting', 'other')),
  source_url text,
  source_notes text,

  prospect_type text not null default 'direct_business' check (prospect_type in (
    'direct_business', 'startup', 'marketing_agency', 'seo_agency', 'branding_agency',
    'social_media_agency', 'web_design_agency', 'other')),

  -- pipeline
  stage text not null default 'prospect' check (stage in (
    'prospect', 'contacted', 'replied', 'qualified', 'discovery_call',
    'technical_discussion', 'proposal_sent', 'negotiation', 'won', 'lost')),
  stage_changed_at timestamptz not null default now(),
  -- furthest funnel stage ever reached (so Lost prospects still count in funnel rates)
  furthest_stage text not null default 'prospect' check (furthest_stage in (
    'prospect', 'contacted', 'replied', 'qualified', 'discovery_call',
    'technical_discussion', 'proposal_sent', 'negotiation', 'won')),
  lost_reason text,

  -- research
  business_description text,
  current_website_notes text,
  website_quality text check (website_quality in ('none', 'poor', 'average', 'good', 'excellent')),
  social_presence text,
  observed_problem text,
  potential_need text,
  suggested_solution text,
  research_notes text,

  -- indicators: NULL = unknown (never assumed), true/false = confirmed by the user
  has_website boolean,
  website_needs_improvement boolean,
  has_online_booking boolean,
  has_lead_form boolean,
  has_whatsapp boolean,
  has_customer_portal boolean,
  has_admin_panel boolean,
  has_ecommerce boolean,
  has_lms boolean,
  has_automation boolean,
  has_ai_features boolean,

  -- opportunity
  potential_project text,
  potential_project_notes text,
  estimated_value numeric(14, 2) check (estimated_value is null or estimated_value >= 0),
  recommended_services text[] not null default '{}',
  score_factors jsonb not null default '{}'::jsonb,
  opportunity_score smallint not null default 0 check (opportunity_score between 0 and 100),
  lead_temperature text not null default 'cold' check (lead_temperature in ('cold', 'warm', 'hot')),

  -- duplicate-detection keys (computed by the app from the fields above)
  website_domain text,
  email_normalized text,
  phone_normalized text,
  whatsapp_normalized text,
  name_location_key text,

  -- denormalised by triggers
  last_contacted_at timestamptz,
  last_activity_at timestamptz,
  next_follow_up_date date,

  is_demo boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prospects_owner_stage_idx on public.prospects (owner_id, stage) where archived_at is null;
create index prospects_owner_created_idx on public.prospects (owner_id, created_at desc);
create index prospects_next_follow_up_idx on public.prospects (owner_id, next_follow_up_date) where archived_at is null;
create index prospects_domain_idx on public.prospects (owner_id, website_domain) where website_domain is not null;
create index prospects_email_idx on public.prospects (owner_id, email_normalized) where email_normalized is not null;
create index prospects_phone_idx on public.prospects (owner_id, phone_normalized) where phone_normalized is not null;
create index prospects_whatsapp_idx on public.prospects (owner_id, whatsapp_normalized) where whatsapp_normalized is not null;
create index prospects_name_location_idx on public.prospects (owner_id, name_location_key) where name_location_key is not null;
create index prospects_demo_idx on public.prospects (owner_id) where is_demo;

create trigger prospects_updated_at before update on public.prospects
  for each row execute function public.set_updated_at();

create table public.prospect_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  job_title text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prospect_contacts_prospect_idx on public.prospect_contacts (prospect_id);

create trigger prospect_contacts_updated_at before update on public.prospect_contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- activities (timeline)
-- ---------------------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  activity_type text not null check (activity_type in (
    'prospect_created', 'prospect_updated', 'note', 'stage_change', 'outreach_sent',
    'response_recorded', 'task_created', 'task_completed', 'task_rescheduled',
    'task_cancelled', 'qualification', 'handoff', 'opportunity', 'archived', 'restored')),
  title text not null,
  details text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index activities_prospect_idx on public.activities (prospect_id, occurred_at desc);
create index activities_owner_occurred_idx on public.activities (owner_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- outreach
-- ---------------------------------------------------------------------------

create table public.outreach_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  channel text not null check (channel in ('email', 'linkedin', 'instagram', 'whatsapp')),
  audience text not null check (audience in (
    'direct_business', 'marketing_agency', 'seo_agency', 'branding_agency',
    'social_media_agency', 'startup', 'education', 'healthcare', 'ecommerce',
    'professional_services', 'general')),
  outreach_stage text not null check (outreach_stage in (
    'first_contact', 'follow_up_1', 'follow_up_2', 'interested_response',
    'discovery_call_invitation', 'post_call_follow_up', 'proposal_follow_up', 're_engagement')),
  subject text,
  body text not null check (char_length(btrim(body)) > 0),
  is_generic boolean not null default false,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outreach_templates_lookup_idx on public.outreach_templates (channel, audience, outreach_stage);

create trigger outreach_templates_updated_at before update on public.outreach_templates
  for each row execute function public.set_updated_at();

create table public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  template_id uuid references public.outreach_templates (id) on delete set null,
  channel text not null check (channel in ('email', 'linkedin', 'instagram', 'whatsapp', 'phone', 'other')),
  outreach_stage text not null check (outreach_stage in (
    'first_contact', 'follow_up_1', 'follow_up_2', 'interested_response',
    'discovery_call_invitation', 'post_call_follow_up', 'proposal_follow_up', 're_engagement')),
  subject text,
  customized_message text not null check (char_length(btrim(customized_message)) > 0),
  sent_at timestamptz not null default now(),
  response_status text not null default 'sent' check (response_status in (
    'sent', 'delivered', 'replied', 'no_response', 'interested', 'not_interested',
    'not_now', 'wrong_contact')),
  response_date timestamptz,
  response_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outreach_messages_prospect_idx on public.outreach_messages (prospect_id, sent_at desc);
create index outreach_messages_owner_sent_idx on public.outreach_messages (owner_id, sent_at desc);

create trigger outreach_messages_updated_at before update on public.outreach_messages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks (follow-ups). Automation only ever creates/cancels tasks — it never sends.
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid references public.prospects (id) on delete cascade,
  task_type text not null check (task_type in (
    'first_outreach', 'follow_up', 'discovery_call', 'proposal_follow_up',
    'qualification', 'internal_follow_up', 'handoff', 'other')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  due_date date not null,
  due_time time,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'snoozed', 'cancelled')),
  notes text,
  is_automated boolean not null default false,
  sequence_step text check (sequence_step in ('follow_up_1', 'follow_up_2')),
  outreach_message_id uuid references public.outreach_messages (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_owner_open_due_idx on public.tasks (owner_id, due_date) where status in ('pending', 'snoozed');
create index tasks_prospect_idx on public.tasks (prospect_id);

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- opportunities (deal / project + commission tracking)
-- ---------------------------------------------------------------------------

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  project_type text,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  estimated_value numeric(14, 2) check (estimated_value is null or estimated_value >= 0),
  -- final project amount eligible for commission (excludes GST, hosting, domains,
  -- paid APIs, licences, third-party services and other pass-through costs)
  eligible_project_amount numeric(14, 2) check (eligible_project_amount is null or eligible_project_amount >= 0),
  -- the percentage actually agreed for THIS project (never auto-filled)
  agreed_commission_pct numeric(5, 2) check (agreed_commission_pct is null or (agreed_commission_pct >= 0 and agreed_commission_pct <= 100)),
  eligible_amount_received numeric(14, 2) not null default 0 check (eligible_amount_received >= 0),
  commission_paid numeric(14, 2) not null default 0 check (commission_paid >= 0),
  pass_through_notes text,
  expected_close_date date,
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunities_prospect_idx on public.opportunities (prospect_id);
create index opportunities_owner_status_idx on public.opportunities (owner_id, status);

create trigger opportunities_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- qualification assessments
-- ---------------------------------------------------------------------------

create table public.qualification_assessments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,

  -- business
  business_model text,
  current_technology text,

  -- problem
  problem_description text,
  current_solution text,
  whats_not_working text,
  cost_of_inaction text,

  -- project
  project_type text check (project_type in (
    'website', 'ecommerce', 'web_application', 'saas', 'crm', 'erp', 'lms', 'dashboard',
    'ai_genai', 'api_backend', 'automation', 'mobile_application', 'custom_software', 'other')),
  required_features text,
  integrations text,
  number_of_users text,
  estimated_complexity text check (estimated_complexity in ('low', 'medium', 'high', 'unknown')),
  desired_launch_date date,
  timeline_notes text,
  budget_min numeric(14, 2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(14, 2) check (budget_max is null or budget_max >= 0),
  budget_notes text,

  -- decision making
  decision_maker_identified boolean not null default false,
  decision_maker_name text,
  decision_process text,
  other_stakeholders text,

  -- ratings 1–5
  need_clarity smallint not null check (need_clarity between 1 and 5),
  budget_fit smallint not null check (budget_fit between 1 and 5),
  timeline_fit smallint not null check (timeline_fit between 1 and 5),
  decision_maker_access smallint not null check (decision_maker_access between 1 and 5),
  urgency smallint not null check (urgency between 1 and 5),

  score smallint not null check (score between 0 and 100),
  suggested_classification text not null check (suggested_classification in ('unqualified', 'potential', 'qualified', 'high_priority')),
  classification text not null check (classification in ('unqualified', 'potential', 'qualified', 'high_priority')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint qualification_budget_range check (budget_min is null or budget_max is null or budget_max >= budget_min)
);

create index qualification_prospect_idx on public.qualification_assessments (prospect_id, created_at desc);

create trigger qualification_updated_at before update on public.qualification_assessments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- handoffs
-- ---------------------------------------------------------------------------

create table public.handoffs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  qualification_id uuid references public.qualification_assessments (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  summary_markdown text not null check (char_length(btrim(summary_markdown)) > 0),
  snapshot jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index handoffs_prospect_idx on public.handoffs (prospect_id, created_at desc);
create index handoffs_owner_idx on public.handoffs (owner_id, created_at desc);

create trigger handoffs_updated_at before update on public.handoffs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Denormalisation + audit triggers
-- ---------------------------------------------------------------------------

-- Every stage change is recorded in the timeline, whichever screen caused it.
-- BEFORE trigger stamps the row; AFTER trigger writes the activity (writing it from
-- the BEFORE trigger would re-update the same row mid-statement).
create or replace function public.funnel_position(stage text)
returns int
language sql
immutable
as $$
  select coalesce(array_position(array[
    'prospect', 'contacted', 'replied', 'qualified', 'discovery_call',
    'technical_discussion', 'proposal_sent', 'negotiation', 'won'], stage), 0);
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
  if new.stage <> 'lost'
     and public.funnel_position(new.stage) > public.funnel_position(new.furthest_stage) then
    new.furthest_stage = new.stage;
  end if;
  return new;
end;
$$;

create trigger prospects_stage_stamp before insert or update of stage on public.prospects
  for each row execute function public.stamp_prospect_stage_change();

create or replace function public.log_prospect_stage_change()
returns trigger
language plpgsql
as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.activities (owner_id, prospect_id, activity_type, title, metadata)
    values (
      new.owner_id,
      new.id,
      'stage_change',
      'Stage changed: ' || old.stage || ' → ' || new.stage,
      jsonb_build_object('from', old.stage, 'to', new.stage)
    );
  end if;
  return null;
end;
$$;

create trigger prospects_stage_change after update of stage on public.prospects
  for each row execute function public.log_prospect_stage_change();

create or replace function public.touch_prospect_last_activity()
returns trigger
language plpgsql
as $$
begin
  update public.prospects
     set last_activity_at = greatest(coalesce(last_activity_at, new.occurred_at), new.occurred_at)
   where id = new.prospect_id;
  return null;
end;
$$;

-- stage_change activities are already stamped by stamp_prospect_stage_change()
create trigger activities_touch_prospect after insert on public.activities
  for each row when (new.activity_type <> 'stage_change')
  execute function public.touch_prospect_last_activity();

create or replace function public.refresh_prospect_last_contacted()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.prospect_id, old.prospect_id);
begin
  update public.prospects p
     set last_contacted_at = (
       select max(m.sent_at) from public.outreach_messages m where m.prospect_id = target
     )
   where p.id = target;
  return null;
end;
$$;

create trigger outreach_messages_refresh_prospect
  after insert or update of sent_at or delete on public.outreach_messages
  for each row execute function public.refresh_prospect_last_contacted();

create or replace function public.refresh_prospect_next_follow_up()
returns trigger
language plpgsql
as $$
declare
  targets uuid[] := array_remove(array[
    case when tg_op <> 'INSERT' then old.prospect_id end,
    case when tg_op <> 'DELETE' then new.prospect_id end
  ], null);
begin
  update public.prospects p
     set next_follow_up_date = (
       select min(t.due_date) from public.tasks t
        where t.prospect_id = p.id and t.status in ('pending', 'snoozed')
     )
   where p.id = any (targets);
  return null;
end;
$$;

create trigger tasks_refresh_prospect
  after insert or update of due_date, status, prospect_id or delete on public.tasks
  for each row execute function public.refresh_prospect_next_follow_up();
