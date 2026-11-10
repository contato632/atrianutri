-- AtriaNutri — hardening complementar da agenda profissional.
-- Depende de 20261108210000_professional_schedule.sql. Review-only: não aplicar remotamente nesta etapa.
begin;

create table public.appointment_series_exceptions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  series_id uuid not null,
  appointment_id uuid not null,
  exception_type text not null check (exception_type in ('updated', 'rescheduled', 'canceled')),
  original_starts_at timestamptz not null,
  resulting_starts_at timestamptz not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (series_id, organization_id) references public.appointment_series(id, organization_id) on delete cascade,
  foreign key (appointment_id, organization_id) references public.appointments(id, organization_id) on delete cascade
);

create index appointment_series_exceptions_lookup_idx
  on public.appointment_series_exceptions(organization_id, series_id, appointment_id, created_at desc);

alter table public.appointment_series_exceptions enable row level security;
revoke all on public.appointment_series_exceptions from public, anon, authenticated;
grant select on public.appointment_series_exceptions to authenticated;

create policy appointment_series_exceptions_select_operational
  on public.appointment_series_exceptions
  for select to authenticated
  using (
    exists (
      select 1
      from public.appointment_series s
      where s.id = series_id
        and s.organization_id = organization_id
        and atrianutri_private.can_manage_schedule(s.organization_id, s.professional_user_id)
    )
  );

create or replace function atrianutri_private.capture_appointment_series_exception()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if old.series_id is null or (
    old.starts_at = new.starts_at
    and old.ends_at = new.ends_at
    and old.status = new.status
    and old.patient_id is not distinct from new.patient_id
    and old.service_id is not distinct from new.service_id
    and old.category = new.category
  ) then
    return new;
  end if;

  v_type := case
    when old.status <> 'canceled' and new.status = 'canceled' then 'canceled'
    when old.starts_at <> new.starts_at or old.ends_at <> new.ends_at then 'rescheduled'
    else 'updated'
  end;

  insert into public.appointment_series_exceptions(
    organization_id, series_id, appointment_id, exception_type,
    original_starts_at, resulting_starts_at, changed_by
  ) values (
    new.organization_id, new.series_id, new.id, v_type,
    old.starts_at, new.starts_at, (select auth.uid())
  );
  return new;
end;
$$;

revoke all on function atrianutri_private.capture_appointment_series_exception() from public, anon, authenticated, service_role;

create trigger capture_appointment_series_exception
after update on public.appointments
for each row execute function atrianutri_private.capture_appointment_series_exception();

-- Mesmo RPC security-definer não pode revelar nem sobrescrever o título privado de outro profissional.
create or replace function atrianutri_private.protect_appointment_private_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professional uuid := coalesce(new.professional_user_id, old.professional_user_id);
  v_actor uuid := (select auth.uid());
begin
  if v_actor is not null and v_actor is distinct from v_professional then
    if tg_op = 'UPDATE' then
      new.private_title := old.private_title;
      return new;
    end if;
    raise exception 'Private appointment detail access denied' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function atrianutri_private.protect_appointment_private_details() from public, anon, authenticated, service_role;

create trigger protect_appointment_private_details
before insert or update or delete on public.appointment_private_details
for each row execute function atrianutri_private.protect_appointment_private_details();

-- Serviços vinculados devem pertencer à mesma organização e estar ativos para novos agendamentos.
create or replace function atrianutri_private.validate_appointment_service()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.service_id is not null and not exists (
    select 1 from public.professional_services s
    where s.id = new.service_id
      and s.organization_id = new.organization_id
      and (s.active or (tg_op = 'UPDATE' and old.service_id = new.service_id))
  ) then
    raise exception 'Service unavailable for appointment' using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function atrianutri_private.validate_appointment_service() from public, anon, authenticated, service_role;

create trigger validate_appointment_service
before insert or update of service_id on public.appointments
for each row execute function atrianutri_private.validate_appointment_service();

commit;
