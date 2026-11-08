-- AtriaNutri — foundation schema for a NEW, dedicated Supabase project only.
-- Never run against AtriaClinic (project ref tbbaiowzduqriwdjeacd) or AtriaMind.
-- This migration is versioned but has NOT been applied remotely.

begin;

create extension if not exists pgcrypto;
create schema if not exists atrianutri_private;
revoke all on schema atrianutri_private from public, anon, authenticated;

create type public.organization_role as enum ('owner', 'admin', 'nutritionist', 'reception');
create type public.patient_status as enum ('active', 'follow_up', 'paused');
create type public.meal_plan_status as enum ('draft', 'active', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 3 and 160),
  professional_registration text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  timezone text not null default 'America/Sao_Paulo',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null,
  clinical_access boolean not null default false,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  constraint clinical_access_role check (not clinical_access or role in ('owner', 'nutritionist'))
);

-- Administrative identity/contact data. No anamnesis, measurements or clinical notes.
create table public.patients_administrative (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (char_length(full_name) between 3 and 160),
  birth_date date not null check (birth_date <= current_date),
  email text not null check (char_length(email) <= 320),
  phone text not null check (char_length(phone) between 8 and 32),
  status public.patient_status not null default 'active',
  next_appointment_at timestamptz,
  created_by uuid not null references auth.users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.patient_professional_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null,
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, patient_id, professional_user_id),
  foreign key (patient_id, organization_id)
    references public.patients_administrative(id, organization_id) on delete cascade,
  foreign key (organization_id, professional_user_id)
    references public.organization_members(organization_id, user_id) on delete cascade
);

-- Clinical data is deliberately separated from administrative identity/contact data.
create table public.patient_clinical_profiles (
  patient_id uuid primary key,
  organization_id uuid not null,
  goal text not null default '' check (char_length(goal) <= 4000),
  food_history text not null default '' check (char_length(food_history) <= 12000),
  habits text not null default '' check (char_length(habits) <= 12000),
  professional_notes text not null default '' check (char_length(professional_notes) <= 12000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, organization_id)
    references public.patients_administrative(id, organization_id) on delete cascade
);

create table public.nutrition_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  assessed_at date not null,
  weight_kg numeric(6,2) not null check (weight_kg > 0 and weight_kg <= 500),
  height_cm numeric(5,2) not null check (height_cm between 50 and 250),
  waist_cm numeric(5,2) check (waist_cm > 0 and waist_cm <= 300),
  hip_cm numeric(5,2) check (hip_cm > 0 and hip_cm <= 300),
  arm_cm numeric(5,2) check (arm_cm > 0 and arm_cm <= 100),
  body_fat_percentage numeric(5,2) check (body_fat_percentage between 1 and 80),
  bmi numeric(4,1) generated always as (round(weight_kg / power(height_cm / 100, 2), 1)) stored,
  notes text not null default '' check (char_length(notes) <= 12000),
  shared_with_patient_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, organization_id)
    references public.patients_administrative(id, organization_id) on delete cascade
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  title text not null check (char_length(title) between 2 and 200),
  status public.meal_plan_status not null default 'draft',
  current_version integer not null default 0 check (current_version >= 0),
  activated_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_plan_has_version check (
    status <> 'active' or (current_version > 0 and activated_at is not null)
  ),
  foreign key (patient_id, organization_id)
    references public.patients_administrative(id, organization_id) on delete cascade,
  unique (id, organization_id, patient_id)
);

-- Immutable snapshots preserve the history. The application creates each version in a transaction.
create table public.meal_plan_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  meal_plan_id uuid not null,
  patient_id uuid not null,
  version integer not null check (version > 0),
  meals jsonb not null default '[]'::jsonb check (jsonb_typeof(meals) = 'array'),
  change_summary text not null default '' check (char_length(change_summary) <= 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint meal_plan_versions_plan_patient_fk
    foreign key (meal_plan_id, organization_id, patient_id)
    references public.meal_plans(id, organization_id, patient_id) on delete cascade,
  unique (meal_plan_id, version)
);

-- Metadata only: no names, contact data, notes, measurements or meal content.
create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in (
    'patient_administrative', 'patient_assignment', 'patient_clinical_profile',
    'nutrition_assessment', 'meal_plan', 'meal_plan_version', 'organization_member'
  )),
  entity_id text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  changed_fields text[] not null default '{}',
  occurred_at timestamptz not null default now()
);

create index organization_members_user_active_idx on public.organization_members(user_id, active, organization_id);
create index patients_organization_name_idx on public.patients_administrative(organization_id, full_name);
create index patients_auth_user_idx on public.patients_administrative(auth_user_id) where auth_user_id is not null;
create index assignments_professional_active_idx on public.patient_professional_assignments(professional_user_id, active, organization_id);
create index assessments_patient_date_idx on public.nutrition_assessments(organization_id, patient_id, assessed_at desc);
create index meal_plans_patient_idx on public.meal_plans(organization_id, patient_id, updated_at desc);
create index meal_plan_versions_plan_idx on public.meal_plan_versions(meal_plan_id, version desc);
create index audit_events_org_time_idx on public.audit_events(organization_id, occurred_at desc);

create or replace function atrianutri_private.is_active_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active
  );
$$;

create or replace function atrianutri_private.has_role(p_organization_id uuid, p_roles public.organization_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active
      and m.role = any(p_roles)
  );
$$;

create or replace function atrianutri_private.is_patient_self(p_organization_id uuid, p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patients_administrative p
    where p.id = p_patient_id
      and p.organization_id = p_organization_id
      and p.auth_user_id = (select auth.uid())
  );
$$;

create or replace function atrianutri_private.can_access_patient_admin(p_organization_id uuid, p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    atrianutri_private.is_patient_self(p_organization_id, p_patient_id)
    or atrianutri_private.has_role(p_organization_id, array['owner','admin','reception']::public.organization_role[])
    or exists (
      select 1
      from public.organization_members m
      join public.patient_professional_assignments a
        on a.organization_id = m.organization_id
       and a.professional_user_id = m.user_id
       and a.patient_id = p_patient_id
       and a.active
      where m.organization_id = p_organization_id
        and m.user_id = (select auth.uid())
        and m.active and m.clinical_access
        and m.role in ('owner','nutritionist')
    );
$$;

create or replace function atrianutri_private.can_access_patient_clinical(p_organization_id uuid, p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members m
    join public.patient_professional_assignments a
      on a.organization_id = m.organization_id
     and a.professional_user_id = m.user_id
     and a.patient_id = p_patient_id
     and a.active
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active and m.clinical_access
      and m.role in ('owner','nutritionist')
  );
$$;

revoke all on all functions in schema atrianutri_private from public, anon, authenticated, service_role;
grant execute on function atrianutri_private.is_active_member(uuid) to authenticated;
grant execute on function atrianutri_private.has_role(uuid, public.organization_role[]) to authenticated;
grant execute on function atrianutri_private.is_patient_self(uuid, uuid) to authenticated;
grant execute on function atrianutri_private.can_access_patient_admin(uuid, uuid) to authenticated;
grant execute on function atrianutri_private.can_access_patient_clinical(uuid, uuid) to authenticated;

create or replace function public.create_organization(p_name text, p_timezone text default 'America/Sao_Paulo')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if char_length(trim(p_name)) not between 2 and 160 then raise exception 'Invalid organization name' using errcode = '22023'; end if;
  insert into public.organizations(name, timezone, created_by)
  values (trim(p_name), coalesce(nullif(trim(p_timezone), ''), 'America/Sao_Paulo'), (select auth.uid()))
  returning id into v_org_id;
  insert into public.organization_members(organization_id, user_id, role, clinical_access, created_by)
  values (v_org_id, (select auth.uid()), 'owner', true, (select auth.uid()));
  return v_org_id;
end;
$$;
revoke all on function public.create_organization(text, text) from public, anon, service_role;
grant execute on function public.create_organization(text, text) to authenticated;

-- Centralizes authorship and assigns a newly created patient only to the clinical
-- professional who created it. Administrative roles keep administrative access.
create or replace function public.create_patient_administrative(
  p_organization_id uuid,
  p_full_name text,
  p_birth_date date,
  p_email text,
  p_phone text,
  p_status public.patient_status default 'active',
  p_next_appointment_at timestamptz default null
)
returns public.patients_administrative
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_patient public.patients_administrative;
  v_has_clinical_access boolean;
begin
  if v_actor is null or not atrianutri_private.is_active_member(p_organization_id) then
    raise exception 'Active organization membership required' using errcode = '42501';
  end if;

  insert into public.patients_administrative (
    organization_id, full_name, birth_date, email, phone,
    status, next_appointment_at, created_by
  ) values (
    p_organization_id, trim(p_full_name), p_birth_date, lower(trim(p_email)), trim(p_phone),
    p_status, p_next_appointment_at, v_actor
  ) returning * into v_patient;

  select exists (
    select 1 from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = v_actor
      and member.active
      and member.clinical_access
      and member.role in ('owner', 'nutritionist')
  ) into v_has_clinical_access;

  if v_has_clinical_access then
    insert into public.patient_professional_assignments (
      organization_id, patient_id, professional_user_id, assigned_by
    ) values (p_organization_id, v_patient.id, v_actor, v_actor);
  end if;

  return v_patient;
end;
$$;
revoke all on function public.create_patient_administrative(
  uuid, text, date, text, text, public.patient_status, timestamptz
) from public, anon, service_role;
grant execute on function public.create_patient_administrative(
  uuid, text, date, text, text, public.patient_status, timestamptz
) to authenticated;

-- The only client path for a new version. Row locking makes version allocation atomic,
-- and the composite FK guarantees the snapshot belongs to the plan's patient.
create or replace function public.save_meal_plan_version(
  p_meal_plan_id uuid,
  p_expected_version integer,
  p_title text,
  p_meals jsonb,
  p_change_summary text default ''
)
returns table (saved_plan_id uuid, saved_version integer, saved_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_patient_id uuid;
  v_current_version integer;
  v_next_version integer;
  v_saved_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'Invalid expected version' using errcode = '22023';
  end if;
  if p_meals is null or jsonb_typeof(p_meals) <> 'array' then
    raise exception 'Meals must be a JSON array' using errcode = '22023';
  end if;
  if char_length(trim(p_title)) not between 2 and 200 then
    raise exception 'Invalid meal plan title' using errcode = '22023';
  end if;
  if char_length(coalesce(p_change_summary, '')) > 500 then
    raise exception 'Change summary is too long' using errcode = '22023';
  end if;

  select plan.organization_id, plan.patient_id, plan.current_version
    into v_organization_id, v_patient_id, v_current_version
  from public.meal_plans plan
  where plan.id = p_meal_plan_id
  for update;

  if not found then
    raise exception 'Meal plan not found' using errcode = 'P0002';
  end if;
  if not atrianutri_private.can_access_patient_clinical(v_organization_id, v_patient_id) then
    raise exception 'Clinical access denied' using errcode = '42501';
  end if;
  if v_current_version <> p_expected_version then
    raise exception 'Meal plan version conflict' using errcode = '40001';
  end if;

  v_next_version := v_current_version + 1;
  v_saved_at := now();

  insert into public.meal_plan_versions (
    organization_id, meal_plan_id, patient_id, version, meals,
    change_summary, created_by, created_at
  ) values (
    v_organization_id, p_meal_plan_id, v_patient_id, v_next_version, p_meals,
    coalesce(p_change_summary, ''), (select auth.uid()), v_saved_at
  );

  update public.meal_plans
  set title = trim(p_title),
      current_version = v_next_version,
      updated_by = (select auth.uid()),
      updated_at = v_saved_at
  where id = p_meal_plan_id;

  return query select p_meal_plan_id, v_next_version, v_saved_at;
end;
$$;
revoke all on function public.save_meal_plan_version(uuid, integer, text, jsonb, text)
  from public, anon, service_role;
grant execute on function public.save_meal_plan_version(uuid, integer, text, jsonb, text)
  to authenticated;

-- Creates the header and first immutable snapshot in the same transaction.
create or replace function public.create_meal_plan_draft(
  p_organization_id uuid,
  p_patient_id uuid,
  p_title text,
  p_meals jsonb,
  p_change_summary text default ''
)
returns table (saved_plan_id uuid, saved_version integer, saved_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_plan_id uuid;
  v_saved_at timestamptz := now();
begin
  if v_actor is null
     or not atrianutri_private.can_access_patient_clinical(p_organization_id, p_patient_id) then
    raise exception 'Clinical access denied' using errcode = '42501';
  end if;
  if char_length(trim(p_title)) not between 2 and 200 then
    raise exception 'Invalid meal plan title' using errcode = '22023';
  end if;
  if p_meals is null or jsonb_typeof(p_meals) <> 'array' then
    raise exception 'Meals must be a JSON array' using errcode = '22023';
  end if;
  if char_length(coalesce(p_change_summary, '')) > 500 then
    raise exception 'Change summary is too long' using errcode = '22023';
  end if;

  insert into public.meal_plans (
    organization_id, patient_id, title, status, current_version,
    created_by, updated_by, created_at, updated_at
  ) values (
    p_organization_id, p_patient_id, trim(p_title), 'draft', 1,
    v_actor, v_actor, v_saved_at, v_saved_at
  ) returning id into v_plan_id;

  insert into public.meal_plan_versions (
    organization_id, meal_plan_id, patient_id, version, meals,
    change_summary, created_by, created_at
  ) values (
    p_organization_id, v_plan_id, p_patient_id, 1, p_meals,
    coalesce(p_change_summary, ''), v_actor, v_saved_at
  );

  return query select v_plan_id, 1, v_saved_at;
end;
$$;
revoke all on function public.create_meal_plan_draft(uuid, uuid, text, jsonb, text)
  from public, anon, service_role;
grant execute on function public.create_meal_plan_draft(uuid, uuid, text, jsonb, text)
  to authenticated;

create or replace function atrianutri_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function atrianutri_private.audit_sensitive_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_org uuid := coalesce((v_new ->> 'organization_id')::uuid, (v_old ->> 'organization_id')::uuid);
  v_id text := coalesce(v_new ->> 'id', v_new ->> 'patient_id', v_new ->> 'user_id', v_old ->> 'id', v_old ->> 'patient_id', v_old ->> 'user_id');
  v_entity text := tg_argv[0];
  v_changed text[];
begin
  select coalesce(array_agg(field_name order by field_name), '{}') into v_changed
  from (
    select field_name
    from jsonb_object_keys(v_old || v_new) as fields(field_name)
    where v_old -> field_name is distinct from v_new -> field_name
  ) changed;
  -- Explicitly remove sensitive and noisy field names from metadata.
  v_changed := array(select value from unnest(v_changed) value where value not in (
    'full_name','birth_date','email','phone','goal','food_history','habits','professional_notes',
    'weight_kg','height_cm','waist_cm','hip_cm','arm_cm','body_fat_percentage','bmi','notes','meals'
  ));
  insert into public.audit_events(organization_id, actor_user_id, entity_type, entity_id, operation, changed_fields)
  values (v_org, (select auth.uid()), v_entity, v_id, tg_op, v_changed);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function atrianutri_private.touch_updated_at() from public, anon, authenticated, service_role;
revoke all on function atrianutri_private.audit_sensitive_change() from public, anon, authenticated, service_role;

do $triggers$
declare t text;
begin
  foreach t in array array['profiles','organizations','organization_members','patients_administrative','patient_professional_assignments','patient_clinical_profiles','nutrition_assessments','meal_plans']
  loop
    execute format('create trigger touch_%I before update on public.%I for each row execute function atrianutri_private.touch_updated_at()', t, t);
  end loop;
end;
$triggers$;

create trigger audit_organization_members after insert or update or delete on public.organization_members for each row execute function atrianutri_private.audit_sensitive_change('organization_member');
create trigger audit_patient_admin after insert or update or delete on public.patients_administrative for each row execute function atrianutri_private.audit_sensitive_change('patient_administrative');
create trigger audit_patient_assignment after insert or update or delete on public.patient_professional_assignments for each row execute function atrianutri_private.audit_sensitive_change('patient_assignment');
create trigger audit_patient_clinical after insert or update or delete on public.patient_clinical_profiles for each row execute function atrianutri_private.audit_sensitive_change('patient_clinical_profile');
create trigger audit_assessment after insert or update or delete on public.nutrition_assessments for each row execute function atrianutri_private.audit_sensitive_change('nutrition_assessment');
create trigger audit_meal_plan after insert or update or delete on public.meal_plans for each row execute function atrianutri_private.audit_sensitive_change('meal_plan');
create trigger audit_meal_plan_version after insert or update or delete on public.meal_plan_versions for each row execute function atrianutri_private.audit_sensitive_change('meal_plan_version');

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.patients_administrative enable row level security;
alter table public.patient_professional_assignments enable row level security;
alter table public.patient_clinical_profiles enable row level security;
alter table public.nutrition_assessments enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_versions enable row level security;
alter table public.audit_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, full_name, professional_registration) on public.profiles to authenticated;
grant update (full_name, professional_registration) on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant update (name, timezone) on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant insert (organization_id, user_id, role, clinical_access, active, created_by) on public.organization_members to authenticated;
grant update (role, clinical_access, active) on public.organization_members to authenticated;
grant select on public.patients_administrative to authenticated;
grant update (full_name, birth_date, email, phone, status, next_appointment_at, archived_at) on public.patients_administrative to authenticated;
grant select on public.patient_professional_assignments to authenticated;
grant insert (organization_id, patient_id, professional_user_id, assigned_by, active) on public.patient_professional_assignments to authenticated;
grant update (active) on public.patient_professional_assignments to authenticated;
grant select on public.patient_clinical_profiles to authenticated;
grant insert (patient_id, organization_id, goal, food_history, habits, professional_notes, created_by) on public.patient_clinical_profiles to authenticated;
grant update (goal, food_history, habits, professional_notes) on public.patient_clinical_profiles to authenticated;
grant select on public.nutrition_assessments to authenticated;
grant insert (organization_id, patient_id, assessed_at, weight_kg, height_cm, waist_cm, hip_cm, arm_cm, body_fat_percentage, notes, shared_with_patient_at, created_by) on public.nutrition_assessments to authenticated;
grant update (assessed_at, weight_kg, height_cm, waist_cm, hip_cm, arm_cm, body_fat_percentage, notes, shared_with_patient_at) on public.nutrition_assessments to authenticated;
grant select on public.meal_plans to authenticated;
grant update (title, status, activated_at, updated_by) on public.meal_plans to authenticated;
grant select on public.meal_plan_versions to authenticated;
grant select on public.audit_events to authenticated;

create policy profiles_select_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy organizations_select_member on public.organizations for select to authenticated using (atrianutri_private.is_active_member(id));
create policy organizations_update_admin on public.organizations for update to authenticated using (atrianutri_private.has_role(id, array['owner','admin']::public.organization_role[])) with check (atrianutri_private.has_role(id, array['owner','admin']::public.organization_role[]));

create policy members_select_same_org on public.organization_members for select to authenticated using (atrianutri_private.is_active_member(organization_id));
create policy members_insert_admin on public.organization_members for insert to authenticated with check (
  atrianutri_private.has_role(organization_id, array['owner']::public.organization_role[])
  and created_by = (select auth.uid())
  and role <> 'owner'
);
create policy members_update_admin on public.organization_members for update to authenticated using (
  atrianutri_private.has_role(organization_id, array['owner']::public.organization_role[])
  and user_id <> (select auth.uid())
  and role <> 'owner'
) with check (
  atrianutri_private.has_role(organization_id, array['owner']::public.organization_role[])
  and user_id <> (select auth.uid())
  and role <> 'owner'
);

create policy patients_select_authorized on public.patients_administrative for select to authenticated using (atrianutri_private.can_access_patient_admin(organization_id, id));
create policy patients_update_authorized on public.patients_administrative for update to authenticated using (
  atrianutri_private.can_access_patient_admin(organization_id, id) and not atrianutri_private.is_patient_self(organization_id, id)
) with check (atrianutri_private.can_access_patient_admin(organization_id, id));

create policy assignments_select_authorized on public.patient_professional_assignments for select to authenticated using (
  atrianutri_private.can_access_patient_admin(organization_id, patient_id)
);
create policy assignments_insert_admin on public.patient_professional_assignments for insert to authenticated with check (
  atrianutri_private.has_role(organization_id, array['owner','admin']::public.organization_role[]) and assigned_by = (select auth.uid())
);
create policy assignments_update_admin on public.patient_professional_assignments for update to authenticated using (
  atrianutri_private.has_role(organization_id, array['owner','admin']::public.organization_role[])
) with check (atrianutri_private.has_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy clinical_profiles_select_professional on public.patient_clinical_profiles for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
);
create policy clinical_profiles_insert_professional on public.patient_clinical_profiles for insert to authenticated with check (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id) and created_by = (select auth.uid())
);
create policy clinical_profiles_update_professional on public.patient_clinical_profiles for update to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
) with check (atrianutri_private.can_access_patient_clinical(organization_id, patient_id));

create policy assessments_select_authorized on public.nutrition_assessments for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (shared_with_patient_at is not null and atrianutri_private.is_patient_self(organization_id, patient_id))
);
create policy assessments_insert_professional on public.nutrition_assessments for insert to authenticated with check (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id) and created_by = (select auth.uid())
);
create policy assessments_update_professional on public.nutrition_assessments for update to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
) with check (atrianutri_private.can_access_patient_clinical(organization_id, patient_id));

create policy meal_plans_select_authorized on public.meal_plans for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (status = 'active' and atrianutri_private.is_patient_self(organization_id, patient_id))
);
create policy meal_plans_update_professional on public.meal_plans for update to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
) with check (atrianutri_private.can_access_patient_clinical(organization_id, patient_id) and updated_by = (select auth.uid()));

create policy meal_plan_versions_select_authorized on public.meal_plan_versions for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (
    atrianutri_private.is_patient_self(organization_id, patient_id)
    and exists (select 1 from public.meal_plans p where p.id = meal_plan_id and p.status = 'active' and p.current_version = version)
  )
);
create policy audit_select_admin on public.audit_events for select to authenticated using (
  atrianutri_private.has_role(organization_id, array['owner','admin']::public.organization_role[])
);

commit;
