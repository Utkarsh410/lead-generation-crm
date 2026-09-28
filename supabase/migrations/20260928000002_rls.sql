-- Row Level Security for every table.
-- * Only approved users (public.is_member()) can read or write anything.
-- * Owned tables are further restricted to owner_id = auth.uid(), and child rows may
--   only point at prospects the user can see (the subquery is itself RLS-filtered).
-- * Reference tables (services, project types, commission tiers, templates) are a
--   shared workspace for approved users.
-- * The anon role gets nothing.

-- profiles ------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: read own or admin reads all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles: update own or admin updates all" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- reference tables -------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['services', 'project_types', 'commission_settings', 'outreach_templates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%s: members read" on public.%I for select to authenticated using ((select public.is_member()))',
      t, t);
    execute format(
      'create policy "%s: members insert" on public.%I for insert to authenticated with check ((select public.is_member()))',
      t, t);
    execute format(
      'create policy "%s: members update" on public.%I for update to authenticated using ((select public.is_member())) with check ((select public.is_member()))',
      t, t);
    execute format(
      'create policy "%s: admins delete" on public.%I for delete to authenticated using ((select public.is_admin()))',
      t, t);
  end loop;
end;
$$;

-- templates may be deleted by any member (they are the member's working library)
drop policy "outreach_templates: admins delete" on public.outreach_templates;
create policy "outreach_templates: members delete" on public.outreach_templates
  for delete to authenticated using ((select public.is_member()));

-- prospects ----------------------------------------------------------------------
alter table public.prospects enable row level security;

create policy "prospects: owner all" on public.prospects
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_member()))
  with check (owner_id = (select auth.uid()) and (select public.is_member()));

-- owned child tables --------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'prospect_contacts', 'activities', 'outreach_messages', 'opportunities',
    'qualification_assessments', 'handoffs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$
      create policy "%s: owner all" on public.%I
        for all to authenticated
        using (owner_id = (select auth.uid()) and (select public.is_member()))
        with check (
          owner_id = (select auth.uid())
          and (select public.is_member())
          and exists (select 1 from public.prospects p where p.id = prospect_id)
        )
    $p$, t, t);
  end loop;
end;
$$;

-- tasks may exist without a prospect (internal follow-ups)
alter table public.tasks enable row level security;

create policy "tasks: owner all" on public.tasks
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_member()))
  with check (
    owner_id = (select auth.uid())
    and (select public.is_member())
    and (prospect_id is null or exists (select 1 from public.prospects p where p.id = prospect_id))
  );

-- grants ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_member() to authenticated;
grant execute on function public.is_admin() to authenticated;
