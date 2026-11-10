-- AtriaNutri — patient invitation, revocable links and immutable plan publication.
-- Local review only. Do not apply remotely without explicit authorization and pgTAP approval.

begin;

create type public.patient_invitation_status as enum ('pending', 'accepted', 'expired', 'canceled');
create type public.patient_link_status as enum ('pending', 'active', 'ended');
create type public.meal_plan_publication_status as enum ('active', 'revoked');

create table public.patient_portal_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null,
  responsible_professional_user_id uuid not null,
  invited_email text not null check (char_length(invited_email) between 3 and 320),
  token_hash bytea not null unique,
  status public.patient_invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  canceled_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, organization_id) references public.patients_administrative(id, organization_id) on delete cascade,
  foreign key (organization_id, responsible_professional_user_id) references public.organization_members(organization_id, user_id),
  check (expires_at > created_at),
  check ((status = 'accepted') = (accepted_by is not null and accepted_at is not null)),
  check ((status = 'canceled') = (canceled_at is not null))
);

create table public.patient_portal_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  responsible_professional_user_id uuid not null,
  invitation_id uuid references public.patient_portal_invitations(id),
  status public.patient_link_status not null default 'pending',
  activated_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, organization_id) references public.patients_administrative(id, organization_id) on delete cascade,
  foreign key (organization_id, responsible_professional_user_id) references public.organization_members(organization_id, user_id),
  check ((status = 'active') = (activated_at is not null and ended_at is null)),
  check ((status = 'ended') = (ended_at is not null))
);

create unique index patient_portal_link_active_patient_idx on public.patient_portal_links(organization_id, patient_id) where status = 'active';
create unique index patient_portal_link_active_user_idx on public.patient_portal_links(organization_id, patient_user_id) where status = 'active';
create index patient_invitation_patient_idx on public.patient_portal_invitations(organization_id, patient_id, created_at desc);

create table public.meal_plan_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null,
  meal_plan_id uuid not null,
  version integer not null check (version > 0),
  status public.meal_plan_publication_status not null default 'active',
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  foreign key (patient_id, organization_id) references public.patients_administrative(id, organization_id) on delete cascade,
  foreign key (meal_plan_id, organization_id, patient_id) references public.meal_plans(id, organization_id, patient_id) on delete cascade,
  foreign key (meal_plan_id, version) references public.meal_plan_versions(meal_plan_id, version) on delete restrict,
  check ((status = 'revoked') = (revoked_by is not null and revoked_at is not null))
);

create unique index meal_plan_publication_active_patient_idx on public.meal_plan_publications(organization_id, patient_id) where status = 'active';
create index meal_plan_publication_history_idx on public.meal_plan_publications(meal_plan_id, published_at desc);

create trigger touch_patient_portal_invitation before update on public.patient_portal_invitations for each row execute function atrianutri_private.touch_updated_at();
create trigger touch_patient_portal_link before update on public.patient_portal_links for each row execute function atrianutri_private.touch_updated_at();

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
  'patient_administrative','patient_assignment','patient_clinical_profile','nutrition_assessment','meal_plan','meal_plan_version','organization_member',
  'food_diary_entry','habit_goal','habit_check_in','clinical_private_note','nutrition_evaluation','dietary_recall_24h',
  'professional_service','appointment_series','appointment','appointment_private_detail','financial_charge','financial_payment','expense_category','financial_expense',
  'patient_portal_invitation','patient_portal_link','meal_plan_publication'
));
create trigger audit_patient_portal_invitation after insert or update or delete on public.patient_portal_invitations for each row execute function atrianutri_private.audit_sensitive_change('patient_portal_invitation');
create trigger audit_patient_portal_link after insert or update or delete on public.patient_portal_links for each row execute function atrianutri_private.audit_sensitive_change('patient_portal_link');
create trigger audit_meal_plan_publication after insert or update or delete on public.meal_plan_publications for each row execute function atrianutri_private.audit_sensitive_change('meal_plan_publication');

create or replace function atrianutri_private.is_patient_self(p_organization_id uuid, p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.patient_portal_links link
    join public.patients_administrative patient
      on patient.id = link.patient_id and patient.organization_id = link.organization_id
    where link.organization_id = p_organization_id and link.patient_id = p_patient_id
      and link.patient_user_id = (select auth.uid()) and patient.auth_user_id = (select auth.uid())
      and link.status = 'active'
  );
$$;
revoke all on function atrianutri_private.is_patient_self(uuid, uuid) from public, anon, authenticated, service_role;

alter table public.patient_portal_invitations enable row level security;
alter table public.patient_portal_links enable row level security;
alter table public.meal_plan_publications enable row level security;
revoke all on public.patient_portal_invitations, public.patient_portal_links, public.meal_plan_publications from public, anon, authenticated;
grant select on public.patient_portal_invitations, public.patient_portal_links, public.meal_plan_publications to authenticated;

create policy patient_invitations_select_professional on public.patient_portal_invitations for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
);
create policy patient_links_select_authorized on public.patient_portal_links for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (patient_user_id = (select auth.uid()) and status = 'active')
);
create policy meal_plan_publications_select_authorized on public.meal_plan_publications for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (status = 'active' and atrianutri_private.is_patient_self(organization_id, patient_id))
);

drop policy meal_plans_select_authorized on public.meal_plans;
create policy meal_plans_select_authorized on public.meal_plans for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (atrianutri_private.is_patient_self(organization_id, patient_id) and exists (
    select 1 from public.meal_plan_publications publication
    where publication.meal_plan_id = public.meal_plans.id and publication.status = 'active'
  ))
);
drop policy meal_plan_versions_select_authorized on public.meal_plan_versions;
create policy meal_plan_versions_select_authorized on public.meal_plan_versions for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (atrianutri_private.is_patient_self(organization_id, patient_id) and exists (
    select 1 from public.meal_plan_publications publication
    where publication.meal_plan_id = public.meal_plan_versions.meal_plan_id and publication.version = public.meal_plan_versions.version and publication.status = 'active'
  ))
);

create or replace function public.create_patient_portal_invitation(p_organization_id uuid, p_patient_id uuid)
returns table (invitation_id uuid, invitation_token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_token text; v_id uuid; v_expires timestamptz := now() + interval '72 hours'; v_email text; v_professional uuid;
begin
  if v_actor is null or not atrianutri_private.can_access_patient_clinical(p_organization_id, p_patient_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.patient_portal_invitations set status='expired' where organization_id=p_organization_id and patient_id=p_patient_id and status='pending' and expires_at<=now();
  if exists (select 1 from public.patient_portal_invitations where organization_id=p_organization_id and patient_id=p_patient_id and status='pending' and expires_at>now()) then raise exception 'Pending invitation already exists' using errcode='23505'; end if;
  select lower(trim(email)) into v_email from public.patients_administrative where id=p_patient_id and organization_id=p_organization_id and archived_at is null;
  select a.professional_user_id into v_professional from public.patient_professional_assignments a where a.organization_id=p_organization_id and a.patient_id=p_patient_id and a.active order by (a.professional_user_id=v_actor) desc limit 1;
  if v_email is null or v_professional is null then raise exception 'Patient or responsible professional not found' using errcode='23503'; end if;
  v_token := rtrim(translate(encode(gen_random_bytes(32),'base64'), '+/', '-_'), '=');
  insert into public.patient_portal_invitations(organization_id,patient_id,responsible_professional_user_id,invited_email,token_hash,expires_at,created_by)
  values(p_organization_id,p_patient_id,v_professional,v_email,digest(v_token,'sha256'),v_expires,v_actor) returning id into v_id;
  return query select v_id,v_token,v_expires;
end;
$$;

create or replace function public.accept_patient_portal_invitation(p_token text)
returns table (link_id uuid, organization_id uuid, patient_id uuid, activated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_email text; v_inv public.patient_portal_invitations%rowtype; v_link uuid; v_now timestamptz := now();
begin
  if v_actor is null or char_length(coalesce(p_token,'')) < 40 then raise exception 'Invalid invitation' using errcode='42501'; end if;
  select lower(email) into v_email from auth.users where id=v_actor;
  select * into v_inv from public.patient_portal_invitations where token_hash=digest(p_token,'sha256') for update;
  if v_inv.id is null or v_inv.status <> 'pending' or v_inv.expires_at <= v_now or v_inv.invited_email <> v_email then raise exception 'Invalid or expired invitation' using errcode='42501'; end if;
  if exists (select 1 from public.patients_administrative where id=v_inv.patient_id and organization_id=v_inv.organization_id and auth_user_id is not null and auth_user_id<>v_actor) then raise exception 'Patient already linked to another identity' using errcode='23505'; end if;
  update public.patients_administrative set auth_user_id=v_actor where id=v_inv.patient_id and organization_id=v_inv.organization_id;
  insert into public.patient_portal_links(organization_id,patient_id,patient_user_id,responsible_professional_user_id,invitation_id,status,activated_at)
  values(v_inv.organization_id,v_inv.patient_id,v_actor,v_inv.responsible_professional_user_id,v_inv.id,'active',v_now) returning id into v_link;
  update public.patient_portal_invitations set status='accepted',accepted_by=v_actor,accepted_at=v_now where id=v_inv.id;
  return query select v_link,v_inv.organization_id,v_inv.patient_id,v_now;
end;
$$;

create or replace function public.cancel_patient_portal_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_inv public.patient_portal_invitations%rowtype;
begin
  select * into v_inv from public.patient_portal_invitations where id=p_invitation_id for update;
  if v_actor is null or v_inv.id is null or v_inv.status<>'pending' or not atrianutri_private.can_access_patient_clinical(v_inv.organization_id,v_inv.patient_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.patient_portal_invitations set status='canceled',canceled_at=now() where id=p_invitation_id;
end;
$$;

create or replace function public.publish_meal_plan_version(p_meal_plan_id uuid, p_version integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_plan public.meal_plans%rowtype; v_id uuid; v_now timestamptz:=now();
begin
  select * into v_plan from public.meal_plans where id=p_meal_plan_id for update;
  if v_actor is null or v_plan.id is null or not atrianutri_private.can_access_patient_clinical(v_plan.organization_id,v_plan.patient_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if not exists(select 1 from public.meal_plan_versions where meal_plan_id=p_meal_plan_id and version=p_version) then raise exception 'Version not found' using errcode='23503'; end if;
  if not exists(select 1 from public.patient_portal_links where organization_id=v_plan.organization_id and patient_id=v_plan.patient_id and status='active') then raise exception 'Active patient link required' using errcode='23503'; end if;
  update public.meal_plan_publications set status='revoked',revoked_by=v_actor,revoked_at=v_now where organization_id=v_plan.organization_id and patient_id=v_plan.patient_id and status='active';
  insert into public.meal_plan_publications(organization_id,patient_id,meal_plan_id,version,published_by,published_at) values(v_plan.organization_id,v_plan.patient_id,p_meal_plan_id,p_version,v_actor,v_now) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.revoke_meal_plan_publication(p_publication_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_publication public.meal_plan_publications%rowtype;
begin
  select * into v_publication from public.meal_plan_publications where id=p_publication_id for update;
  if v_actor is null or v_publication.id is null or v_publication.status<>'active' or not atrianutri_private.can_access_patient_clinical(v_publication.organization_id,v_publication.patient_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.meal_plan_publications set status='revoked',revoked_by=v_actor,revoked_at=now() where id=p_publication_id;
end;
$$;

create or replace function public.end_patient_portal_link(p_link_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_link public.patient_portal_links%rowtype; v_now timestamptz:=now();
begin
  select * into v_link from public.patient_portal_links where id=p_link_id for update;
  if v_actor is null or v_link.id is null or v_link.status<>'active' or not atrianutri_private.can_access_patient_clinical(v_link.organization_id,v_link.patient_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.patient_portal_links set status='ended',ended_at=v_now,ended_by=v_actor where id=p_link_id;
  update public.meal_plan_publications set status='revoked',revoked_at=v_now,revoked_by=v_actor where organization_id=v_link.organization_id and patient_id=v_link.patient_id and status='active';
end;
$$;

revoke all on function public.create_patient_portal_invitation(uuid,uuid), public.accept_patient_portal_invitation(text), public.cancel_patient_portal_invitation(uuid), public.publish_meal_plan_version(uuid,integer), public.revoke_meal_plan_publication(uuid), public.end_patient_portal_link(uuid) from public, anon, service_role;
grant execute on function public.create_patient_portal_invitation(uuid,uuid), public.accept_patient_portal_invitation(text), public.cancel_patient_portal_invitation(uuid), public.publish_meal_plan_version(uuid,integer), public.revoke_meal_plan_publication(uuid), public.end_patient_portal_link(uuid) to authenticated;

comment on table public.patient_portal_invitations is 'Invitation secrets are returned once; only SHA-256 hashes are stored.';
comment on table public.meal_plan_publications is 'Immutable history selecting an explicitly approved meal plan version for patient read access.';

commit;
