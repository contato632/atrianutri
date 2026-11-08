-- AtriaNutri — professional schedule, services and bounded recurrence.
-- Review-only migration. Do not apply remotely in Etapa 07.
begin;
create extension if not exists btree_gist;
create type public.appointment_category as enum('nutrition_consultation','follow_up','lunch_break','personal');
create type public.appointment_status as enum('scheduled','confirmed','completed','canceled','no_show');
create type public.recurrence_frequency as enum('none','weekly','biweekly','monthly');

create table public.professional_services(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 2 and 160),default_duration_minutes integer not null check(default_duration_minutes between 15 and 480),
 price_cents integer check(price_cents between 0 and 100000000),active boolean not null default true,created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,organization_id),unique(organization_id,name)
);
create table public.appointment_series(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 professional_user_id uuid not null,patient_id uuid,service_id uuid,category public.appointment_category not null,
 recurrence public.recurrence_frequency not null,timezone text not null,starts_local timestamp not null,recurrence_ends_on date,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 foreign key(organization_id,professional_user_id) references public.organization_members(organization_id,user_id),
 foreign key(patient_id,organization_id) references public.patients_administrative(id,organization_id),
 foreign key(service_id,organization_id) references public.professional_services(id,organization_id),unique(id,organization_id)
);
create table public.appointments(
 id uuid primary key default gen_random_uuid(),series_id uuid,organization_id uuid not null,professional_user_id uuid not null,patient_id uuid,service_id uuid,
 category public.appointment_category not null,status public.appointment_status not null default 'scheduled',title text not null check(char_length(title) between 2 and 200),
 administrative_note text not null default '' check(char_length(administrative_note)<=2000),starts_at timestamptz not null,ends_at timestamptz not null,
 created_by uuid not null references auth.users(id),updated_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 constraint appointment_positive_duration check(ends_at>starts_at and ends_at<=starts_at+interval '8 hours'),
 constraint appointment_patient_category check((category in('nutrition_consultation','follow_up') and patient_id is not null) or (category in('lunch_break','personal') and patient_id is null)),
 foreign key(series_id,organization_id) references public.appointment_series(id,organization_id),
 foreign key(organization_id,professional_user_id) references public.organization_members(organization_id,user_id),
 foreign key(patient_id,organization_id) references public.patients_administrative(id,organization_id),
 foreign key(service_id,organization_id) references public.professional_services(id,organization_id),unique(id,organization_id)
);
alter table public.appointments add constraint appointments_professional_no_overlap exclude using gist(
 organization_id with =,professional_user_id with =,tstzrange(starts_at,ends_at,'[)') with &&
) where(status<>'canceled' and archived_at is null);
create table public.appointment_private_details(
 id uuid primary key default gen_random_uuid(),appointment_id uuid not null unique,organization_id uuid not null,professional_user_id uuid not null,private_title text not null check(char_length(trim(private_title)) between 1 and 200),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(appointment_id,organization_id) references public.appointments(id,organization_id) on delete cascade,
 foreign key(organization_id,professional_user_id) references public.organization_members(organization_id,user_id)
);
create table public.appointment_changes(
 id bigint generated always as identity primary key,organization_id uuid not null references public.organizations(id) on delete cascade,appointment_id uuid not null,
 changed_by uuid references auth.users(id) on delete set null,change_type text not null check(change_type in('created','updated','rescheduled','status_changed','canceled')),
 occurred_at timestamptz not null default now(),foreign key(appointment_id,organization_id) references public.appointments(id,organization_id) on delete cascade
);
create index appointments_period_idx on public.appointments(organization_id,professional_user_id,starts_at,ends_at) where archived_at is null;
create index appointments_patient_future_idx on public.appointments(organization_id,patient_id,starts_at) where patient_id is not null and archived_at is null;
create index appointment_series_active_idx on public.appointment_series(organization_id,professional_user_id) where archived_at is null;
create index services_active_idx on public.professional_services(organization_id,active,name);

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check(entity_type in('patient_administrative','patient_assignment','patient_clinical_profile','nutrition_assessment','meal_plan','meal_plan_version','organization_member','food_diary_entry','habit_goal','habit_check_in','clinical_private_note','nutrition_evaluation','dietary_recall_24h','professional_service','appointment','appointment_series','appointment_private_detail'));
create trigger touch_professional_service before update on public.professional_services for each row execute function atrianutri_private.touch_updated_at();
create trigger touch_appointment_series before update on public.appointment_series for each row execute function atrianutri_private.touch_updated_at();
create trigger touch_appointment before update on public.appointments for each row execute function atrianutri_private.touch_updated_at();
create trigger touch_appointment_private before update on public.appointment_private_details for each row execute function atrianutri_private.touch_updated_at();
create trigger audit_professional_service after insert or update or delete on public.professional_services for each row execute function atrianutri_private.audit_sensitive_change('professional_service');
create trigger audit_appointment after insert or update or delete on public.appointments for each row execute function atrianutri_private.audit_sensitive_change('appointment');
create trigger audit_appointment_series after insert or update or delete on public.appointment_series for each row execute function atrianutri_private.audit_sensitive_change('appointment_series');
create trigger audit_appointment_private after insert or update or delete on public.appointment_private_details for each row execute function atrianutri_private.audit_sensitive_change('appointment_private_detail');

create or replace function atrianutri_private.can_manage_schedule(p_organization_id uuid,p_professional_id uuid)
returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.active and (m.role in('owner','admin','reception') or m.user_id=p_professional_id))$$;
revoke all on function atrianutri_private.can_manage_schedule(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function atrianutri_private.can_manage_schedule(uuid,uuid) to authenticated;
create or replace function atrianutri_private.refresh_patient_next_appointment()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_patient uuid:=coalesce(new.patient_id,old.patient_id);v_org uuid:=coalesce(new.organization_id,old.organization_id);
begin if v_patient is not null then update public.patients_administrative p set next_appointment_at=(select min(a.starts_at) from public.appointments a where a.organization_id=v_org and a.patient_id=v_patient and a.status in('scheduled','confirmed') and a.archived_at is null and a.starts_at>=now()) where p.id=v_patient and p.organization_id=v_org;end if;if tg_op='UPDATE' and old.patient_id is distinct from new.patient_id and old.patient_id is not null then update public.patients_administrative p set next_appointment_at=(select min(a.starts_at) from public.appointments a where a.organization_id=old.organization_id and a.patient_id=old.patient_id and a.status in('scheduled','confirmed') and a.archived_at is null and a.starts_at>=now()) where p.id=old.patient_id and p.organization_id=old.organization_id;end if;return new;end;$$;
revoke all on function atrianutri_private.refresh_patient_next_appointment() from public,anon,authenticated,service_role;
create trigger refresh_patient_next_appointment after insert or update on public.appointments for each row execute function atrianutri_private.refresh_patient_next_appointment();

alter table public.professional_services enable row level security;alter table public.appointment_series enable row level security;alter table public.appointments enable row level security;alter table public.appointment_private_details enable row level security;alter table public.appointment_changes enable row level security;
revoke all on public.professional_services,public.appointment_series,public.appointments,public.appointment_private_details,public.appointment_changes from public,anon,authenticated;
grant select on public.professional_services,public.appointment_series,public.appointments,public.appointment_private_details,public.appointment_changes to authenticated;
create policy services_select_member on public.professional_services for select to authenticated using(atrianutri_private.is_active_member(organization_id));
create policy appointments_select_operational on public.appointments for select to authenticated using(atrianutri_private.can_manage_schedule(organization_id,professional_user_id));
create policy appointment_series_select_operational on public.appointment_series for select to authenticated using(atrianutri_private.can_manage_schedule(organization_id,professional_user_id));
create policy appointment_private_select_owner on public.appointment_private_details for select to authenticated using(professional_user_id=(select auth.uid()) and atrianutri_private.is_active_member(organization_id));
create policy appointment_changes_select_operational on public.appointment_changes for select to authenticated using(exists(select 1 from public.appointments a where a.id=appointment_id and atrianutri_private.can_manage_schedule(a.organization_id,a.professional_user_id)));

create or replace function public.save_professional_service(p_organization_id uuid,p_name text,p_duration integer,p_price_cents integer,p_active boolean,p_service_id uuid default null)
returns table(saved_id uuid,saved_updated_at timestamptz) language plpgsql security definer set search_path='' as $$declare v_actor uuid:=(select auth.uid());v_id uuid;v_at timestamptz;begin if not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.active and m.role in('owner','admin')) then raise exception 'Service management denied' using errcode='42501';end if;if char_length(trim(p_name)) not between 2 and 160 or p_duration not between 15 and 480 or p_price_cents<0 then raise exception 'Invalid service' using errcode='22023';end if;if p_service_id is null then insert into public.professional_services(organization_id,name,default_duration_minutes,price_cents,active,created_by) values(p_organization_id,trim(p_name),p_duration,p_price_cents,p_active,v_actor) returning id,updated_at into v_id,v_at;else update public.professional_services set name=trim(p_name),default_duration_minutes=p_duration,price_cents=p_price_cents,active=p_active where id=p_service_id and organization_id=p_organization_id returning id,updated_at into v_id,v_at;if not found then raise exception 'Service not found' using errcode='P0002';end if;end if;return query select v_id,v_at;end;$$;

create or replace function public.create_appointment_series(p_organization_id uuid,p_professional_user_id uuid,p_patient_id uuid,p_service_id uuid,p_category public.appointment_category,p_status public.appointment_status,p_title text,p_private_title text,p_administrative_note text,p_local_start timestamp,p_duration_minutes integer,p_timezone text,p_recurrence public.recurrence_frequency,p_recurrence_ends_on date)
returns table(saved_id uuid,saved_series_id uuid,saved_updated_at timestamptz,occurrence_count integer) language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_series uuid;v_id uuid;v_at timestamptz;v_count integer:=0;v_i integer;v_local timestamp;v_month date;v_last integer;
begin
 if not atrianutri_private.can_manage_schedule(p_organization_id,p_professional_user_id) then raise exception 'Schedule access denied' using errcode='42501';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) or p_duration_minutes not between 15 and 480 or char_length(coalesce(p_administrative_note,''))>2000 then raise exception 'Invalid appointment' using errcode='22023';end if;
 if (p_category in('nutrition_consultation','follow_up'))<>(p_patient_id is not null) then raise exception 'Patient/category mismatch' using errcode='22023';end if;
 if p_patient_id is not null and not exists(select 1 from public.patients_administrative where id=p_patient_id and organization_id=p_organization_id and archived_at is null) then raise exception 'Patient not found' using errcode='P0002';end if;
 if p_recurrence<>'none' and p_recurrence_ends_on is not null and (p_recurrence_ends_on<p_local_start::date or p_recurrence_ends_on>p_local_start::date+730) then raise exception 'Invalid recurrence boundary' using errcode='22023';end if;
 if p_recurrence<>'none' then insert into public.appointment_series(organization_id,professional_user_id,patient_id,service_id,category,recurrence,timezone,starts_local,recurrence_ends_on,created_by) values(p_organization_id,p_professional_user_id,p_patient_id,p_service_id,p_category,p_recurrence,p_timezone,p_local_start,p_recurrence_ends_on,v_actor) returning id into v_series;end if;
 for v_i in 0..103 loop
  if p_recurrence='none' then if v_i>0 then exit;end if;v_local:=p_local_start;
  elsif p_recurrence='weekly' then v_local:=p_local_start+(v_i*7||' days')::interval;
  elsif p_recurrence='biweekly' then v_local:=p_local_start+(v_i*14||' days')::interval;
  else v_month:=(date_trunc('month',p_local_start)+(v_i||' months')::interval)::date;v_last:=extract(day from (v_month+interval '1 month-1 day'));if extract(day from p_local_start)>v_last then continue;end if;v_local:=v_month+(extract(day from p_local_start)::integer-1)*interval '1 day'+p_local_start::time;end if;
  if p_recurrence<>'none' and v_local::date>coalesce(p_recurrence_ends_on,p_local_start::date+730) then exit;end if;
  insert into public.appointments(series_id,organization_id,professional_user_id,patient_id,service_id,category,status,title,administrative_note,starts_at,ends_at,created_by,updated_by) values(v_series,p_organization_id,p_professional_user_id,p_patient_id,p_service_id,p_category,p_status,case when p_category='personal' then 'Compromisso particular' else p_title end,coalesce(p_administrative_note,''),v_local at time zone p_timezone,(v_local+p_duration_minutes*interval '1 minute') at time zone p_timezone,v_actor,v_actor) returning id,updated_at into v_id,v_at;
  if p_category='personal' then insert into public.appointment_private_details(appointment_id,organization_id,professional_user_id,private_title) values(v_id,p_organization_id,p_professional_user_id,trim(p_private_title));end if;
  insert into public.appointment_changes(organization_id,appointment_id,changed_by,change_type) values(p_organization_id,v_id,v_actor,'created');v_count:=v_count+1;if v_count=1 then saved_id:=v_id;saved_updated_at:=v_at;end if;
 end loop;saved_series_id:=v_series;occurrence_count:=v_count;return next;
exception when exclusion_violation then raise exception 'Appointment time conflict' using errcode='23P01';end;$$;

create or replace function public.update_appointment(p_appointment_id uuid,p_expected_updated_at timestamptz,p_scope text,p_patient_id uuid,p_service_id uuid,p_category public.appointment_category,p_status public.appointment_status,p_title text,p_private_title text,p_administrative_note text,p_starts_at timestamptz,p_ends_at timestamptz)
returns table(saved_id uuid,saved_updated_at timestamptz) language plpgsql security definer set search_path='' as $$declare v_actor uuid:=(select auth.uid());v_old public.appointments;v_delta interval;v_at timestamptz;begin select * into v_old from public.appointments where id=p_appointment_id for update;if not found then raise exception 'Appointment not found' using errcode='P0002';end if;if not atrianutri_private.can_manage_schedule(v_old.organization_id,v_old.professional_user_id) then raise exception 'Schedule access denied' using errcode='42501';end if;if v_old.updated_at<>p_expected_updated_at then raise exception 'Appointment conflict' using errcode='40001';end if;if p_scope not in('occurrence','series') or p_ends_at<=p_starts_at or (p_category in('nutrition_consultation','follow_up'))<>(p_patient_id is not null) then raise exception 'Invalid appointment' using errcode='22023';end if;v_delta:=p_starts_at-v_old.starts_at;if p_scope='series' and v_old.series_id is not null then update public.appointments set patient_id=p_patient_id,service_id=p_service_id,category=p_category,status=p_status,title=case when p_category='personal' then 'Compromisso particular' else p_title end,administrative_note=coalesce(p_administrative_note,''),starts_at=starts_at+v_delta,ends_at=ends_at+v_delta,updated_by=v_actor where series_id=v_old.series_id and archived_at is null;else update public.appointments set patient_id=p_patient_id,service_id=p_service_id,category=p_category,status=p_status,title=case when p_category='personal' then 'Compromisso particular' else p_title end,administrative_note=coalesce(p_administrative_note,''),starts_at=p_starts_at,ends_at=p_ends_at,updated_by=v_actor where id=p_appointment_id;end if;select updated_at into v_at from public.appointments where id=p_appointment_id;if p_category='personal' then if p_scope='series' and v_old.series_id is not null then insert into public.appointment_private_details(appointment_id,organization_id,professional_user_id,private_title) select id,organization_id,professional_user_id,trim(p_private_title) from public.appointments where series_id=v_old.series_id and archived_at is null on conflict(appointment_id) do update set private_title=excluded.private_title;else insert into public.appointment_private_details(appointment_id,organization_id,professional_user_id,private_title) values(p_appointment_id,v_old.organization_id,v_old.professional_user_id,trim(p_private_title)) on conflict(appointment_id) do update set private_title=excluded.private_title;end if;elsif p_scope='series' and v_old.series_id is not null then delete from public.appointment_private_details where appointment_id in(select id from public.appointments where series_id=v_old.series_id);else delete from public.appointment_private_details where appointment_id=p_appointment_id;end if;insert into public.appointment_changes(organization_id,appointment_id,changed_by,change_type) values(v_old.organization_id,p_appointment_id,v_actor,case when v_delta<>interval '0' then 'rescheduled' else 'updated' end);return query select p_appointment_id,v_at;exception when exclusion_violation then raise exception 'Appointment time conflict' using errcode='23P01';end;$$;

create or replace function public.cancel_appointment(p_appointment_id uuid,p_expected_updated_at timestamptz,p_scope text)
returns void language plpgsql security definer set search_path='' as $$declare v_actor uuid:=(select auth.uid());v_old public.appointments;begin select * into v_old from public.appointments where id=p_appointment_id for update;if not found then raise exception 'Appointment not found' using errcode='P0002';end if;if not atrianutri_private.can_manage_schedule(v_old.organization_id,v_old.professional_user_id) then raise exception 'Schedule access denied' using errcode='42501';end if;if v_old.updated_at<>p_expected_updated_at then raise exception 'Appointment conflict' using errcode='40001';end if;if p_scope='series' and v_old.series_id is not null then update public.appointments set status='canceled',updated_by=v_actor where series_id=v_old.series_id and archived_at is null;else update public.appointments set status='canceled',updated_by=v_actor where id=p_appointment_id;end if;insert into public.appointment_changes(organization_id,appointment_id,changed_by,change_type) values(v_old.organization_id,p_appointment_id,v_actor,'canceled');end;$$;

revoke all on function public.save_professional_service(uuid,text,integer,integer,boolean,uuid) from public,anon,service_role;grant execute on function public.save_professional_service(uuid,text,integer,integer,boolean,uuid) to authenticated;
revoke all on function public.create_appointment_series(uuid,uuid,uuid,uuid,public.appointment_category,public.appointment_status,text,text,text,timestamp,integer,text,public.recurrence_frequency,date) from public,anon,service_role;grant execute on function public.create_appointment_series(uuid,uuid,uuid,uuid,public.appointment_category,public.appointment_status,text,text,text,timestamp,integer,text,public.recurrence_frequency,date) to authenticated;
revoke all on function public.update_appointment(uuid,timestamptz,text,uuid,uuid,public.appointment_category,public.appointment_status,text,text,text,timestamptz,timestamptz) from public,anon,service_role;grant execute on function public.update_appointment(uuid,timestamptz,text,uuid,uuid,public.appointment_category,public.appointment_status,text,text,text,timestamptz,timestamptz) to authenticated;
revoke all on function public.cancel_appointment(uuid,timestamptz,text) from public,anon,service_role;grant execute on function public.cancel_appointment(uuid,timestamptz,text) to authenticated;
commit;
