-- AtriaNutri — financeiro administrativo do consultório.
-- Depende das migrations 05–07. Review-only: não aplicar remotamente nesta etapa.
begin;

create type public.finance_access_level as enum ('view','operational','manage');
create type public.financial_payment_method as enum ('pix','cash','credit_card','debit_card','bank_transfer','other');
create type public.financial_payment_kind as enum ('receipt','reversal');
create type public.financial_expense_status as enum ('planned','paid','canceled');

create table public.organization_finance_permissions(
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 access_level public.finance_access_level not null,
 granted_by uuid not null references auth.users(id),created_at timestamptz not null default now(),revoked_at timestamptz,
 primary key(organization_id,user_id),foreign key(organization_id,user_id) references public.organization_members(organization_id,user_id)
);
create table public.financial_charges(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 patient_id uuid not null,professional_user_id uuid not null,appointment_id uuid,service_id uuid,description text not null check(char_length(trim(description)) between 2 and 200),
 amount_cents bigint not null check(amount_cents>0 and amount_cents<=1000000000),due_date date not null,administrative_note text not null default '' check(char_length(administrative_note)<=2000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),canceled_at timestamptz,canceled_by uuid references auth.users(id),
 unique(id,organization_id),foreign key(patient_id,organization_id) references public.patients_administrative(id,organization_id),foreign key(appointment_id,organization_id) references public.appointments(id,organization_id),
 foreign key(service_id,organization_id) references public.professional_services(id,organization_id),foreign key(organization_id,professional_user_id) references public.organization_members(organization_id,user_id)
);
create unique index financial_charge_active_appointment_uniq on public.financial_charges(organization_id,appointment_id) where appointment_id is not null and canceled_at is null;
create index financial_charges_due_idx on public.financial_charges(organization_id,due_date) where canceled_at is null;
create index financial_charges_patient_idx on public.financial_charges(organization_id,patient_id,created_at desc);

create table public.financial_payments(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,charge_id uuid not null,kind public.financial_payment_kind not null,amount_cents bigint not null check(amount_cents>0 and amount_cents<=1000000000),
 method public.financial_payment_method not null,received_at date not null,administrative_note text not null default '' check(char_length(administrative_note)<=2000),idempotency_key uuid not null,
 reverses_payment_id uuid,installment_number integer check(installment_number>0),installment_count integer check(installment_count>0 and installment_count<=120),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(organization_id,idempotency_key),unique(id,organization_id),
 foreign key(charge_id,organization_id) references public.financial_charges(id,organization_id),foreign key(reverses_payment_id,organization_id) references public.financial_payments(id,organization_id),check(installment_number is null or installment_count is null or installment_number<=installment_count),
 check((kind='receipt' and reverses_payment_id is null) or (kind='reversal' and reverses_payment_id is not null))
);
create index financial_payments_charge_idx on public.financial_payments(organization_id,charge_id,created_at);
create index financial_payments_received_idx on public.financial_payments(organization_id,received_at);

create table public.expense_categories(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null check(char_length(trim(name)) between 2 and 120),active boolean not null default true,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(id,organization_id),unique(organization_id,name)
);
create table public.financial_expenses(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,category_id uuid not null,description text not null check(char_length(trim(description)) between 2 and 200),
 amount_cents bigint not null check(amount_cents>0 and amount_cents<=1000000000),competence_date date not null,due_date date not null,paid_at date,status public.financial_expense_status not null,
 administrative_note text not null default '' check(char_length(administrative_note)<=2000),created_by uuid not null references auth.users(id),updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,organization_id),foreign key(category_id,organization_id) references public.expense_categories(id,organization_id),
 check((status='paid' and paid_at is not null) or status<>'paid')
);
create index financial_expenses_period_idx on public.financial_expenses(organization_id,competence_date,due_date,status);
insert into public.expense_categories(organization_id,name,created_by)
select o.id,v.name,o.created_by from public.organizations o cross join (values('Aluguel'),('Softwares'),('Materiais'),('Serviços'),('Equipe'),('Outras despesas operacionais')) as v(name)
on conflict(organization_id,name) do nothing;
create table public.financial_audit_events(
 id bigint generated always as identity primary key,organization_id uuid not null references public.organizations(id) on delete cascade,entity_type text not null check(entity_type in('charge','payment','expense','finance_permission')),
 entity_id text not null,action text not null check(action in('created','updated','canceled','received','reversed','permission_changed')),actor_user_id uuid references auth.users(id) on delete set null,occurred_at timestamptz not null default now()
);

create or replace function atrianutri_private.has_finance_access(p_org uuid,p_levels public.finance_access_level[])
returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organization_members m where m.organization_id=p_org and m.user_id=(select auth.uid()) and m.active and (m.role='owner' or exists(select 1 from public.organization_finance_permissions f where f.organization_id=p_org and f.user_id=m.user_id and f.revoked_at is null and f.access_level=any(p_levels))))$$;
revoke all on function atrianutri_private.has_finance_access(uuid,public.finance_access_level[]) from public,anon,authenticated,service_role;grant execute on function atrianutri_private.has_finance_access(uuid,public.finance_access_level[]) to authenticated;

alter table public.organization_finance_permissions enable row level security;alter table public.financial_charges enable row level security;alter table public.financial_payments enable row level security;alter table public.expense_categories enable row level security;alter table public.financial_expenses enable row level security;alter table public.financial_audit_events enable row level security;
revoke all on public.organization_finance_permissions,public.financial_charges,public.financial_payments,public.expense_categories,public.financial_expenses,public.financial_audit_events from public,anon,authenticated;
grant select on public.organization_finance_permissions,public.financial_charges,public.financial_payments,public.expense_categories,public.financial_expenses,public.financial_audit_events to authenticated;
create policy finance_permissions_owner_select on public.organization_finance_permissions for select to authenticated using(atrianutri_private.has_finance_access(organization_id,array['manage']::public.finance_access_level[]));
create policy finance_charges_authorized_select on public.financial_charges for select to authenticated using(atrianutri_private.has_finance_access(organization_id,array['view','operational','manage']::public.finance_access_level[]));
create policy finance_payments_authorized_select on public.financial_payments for select to authenticated using(atrianutri_private.has_finance_access(organization_id,array['view','operational','manage']::public.finance_access_level[]));
create policy expense_categories_finance_select on public.expense_categories for select to authenticated using(atrianutri_private.has_finance_access(organization_id,array['view','manage']::public.finance_access_level[]));
create policy finance_expenses_authorized_select on public.financial_expenses for select to authenticated using(atrianutri_private.has_finance_access(organization_id,array['view','manage']::public.finance_access_level[]));
create policy finance_audit_manage_select on public.financial_audit_events for select to authenticated using(atrianutri_private.has_finance_access(organization_id,array['manage']::public.finance_access_level[]));

create trigger touch_financial_charge before update on public.financial_charges for each row execute function atrianutri_private.touch_updated_at();
create trigger touch_financial_expense before update on public.financial_expenses for each row execute function atrianutri_private.touch_updated_at();

create or replace function public.set_finance_permission(p_organization_id uuid,p_user_id uuid,p_access_level public.finance_access_level,p_revoke boolean default false)
returns void language plpgsql security definer set search_path='' as $$declare v_actor uuid:=(select auth.uid());begin
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=v_actor and active and role='owner') then raise exception 'Only the owner can manage finance permissions' using errcode='42501';end if;
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=p_user_id and active) then raise exception 'Organization member not found' using errcode='P0002';end if;
 insert into public.organization_finance_permissions(organization_id,user_id,access_level,granted_by,revoked_at) values(p_organization_id,p_user_id,p_access_level,v_actor,case when p_revoke then now() else null end)
 on conflict(organization_id,user_id) do update set access_level=excluded.access_level,granted_by=v_actor,created_at=now(),revoked_at=excluded.revoked_at;
 insert into public.financial_audit_events(organization_id,entity_type,entity_id,action,actor_user_id) values(p_organization_id,'finance_permission',p_user_id::text,'permission_changed',v_actor);
end;$$;

create or replace function public.create_financial_charge(p_organization_id uuid,p_patient_id uuid,p_professional_user_id uuid,p_appointment_id uuid,p_service_id uuid,p_description text,p_amount_cents bigint,p_due_date date,p_administrative_note text)
returns table(saved_id uuid,saved_updated_at timestamptz) language plpgsql security definer set search_path='' as $$declare v_actor uuid:=(select auth.uid());v_id uuid;v_at timestamptz;begin
 if not atrianutri_private.has_finance_access(p_organization_id,array['operational','manage']::public.finance_access_level[]) then raise exception 'Finance access denied' using errcode='42501';end if;
 if p_amount_cents<=0 or p_amount_cents>1000000000 then raise exception 'Invalid amount' using errcode='22023';end if;
 if p_appointment_id is not null and not exists(select 1 from public.appointments a where a.id=p_appointment_id and a.organization_id=p_organization_id and a.patient_id=p_patient_id and a.professional_user_id=p_professional_user_id and a.status<>'canceled' and a.archived_at is null) then raise exception 'Invalid appointment' using errcode='23503';end if;
 insert into public.financial_charges(organization_id,patient_id,professional_user_id,appointment_id,service_id,description,amount_cents,due_date,administrative_note,created_by) values(p_organization_id,p_patient_id,p_professional_user_id,p_appointment_id,p_service_id,trim(p_description),p_amount_cents,p_due_date,coalesce(p_administrative_note,''),v_actor) returning id,updated_at into v_id,v_at;
 insert into public.financial_audit_events(organization_id,entity_type,entity_id,action,actor_user_id) values(p_organization_id,'charge',v_id::text,'created',v_actor);return query select v_id,v_at;
exception when unique_violation then raise exception 'Appointment already has an active charge' using errcode='23505';end;$$;

create or replace function public.record_financial_payment(p_charge_id uuid,p_amount_cents bigint,p_method public.financial_payment_method,p_received_at date,p_administrative_note text,p_idempotency_key uuid,p_installment_number integer,p_installment_count integer)
returns table(saved_id uuid,saved_at timestamptz) language plpgsql security definer set search_path='' as $$declare v_actor uuid:=(select auth.uid());v_charge public.financial_charges;v_net bigint;v_id uuid;v_at timestamptz;begin
 select * into v_charge from public.financial_charges where id=p_charge_id for update;if not found or v_charge.canceled_at is not null then raise exception 'Charge unavailable' using errcode='P0002';end if;
 if not atrianutri_private.has_finance_access(v_charge.organization_id,array['operational','manage']::public.finance_access_level[]) then raise exception 'Finance access denied' using errcode='42501';end if;
 if exists(select 1 from public.financial_payments where organization_id=v_charge.organization_id and idempotency_key=p_idempotency_key) then raise exception 'Duplicate payment request' using errcode='23505';end if;
 select coalesce(sum(case when kind='receipt' then amount_cents else -amount_cents end),0) into v_net from public.financial_payments where charge_id=p_charge_id;
 if p_amount_cents<=0 or p_amount_cents>v_charge.amount_cents-v_net then raise exception 'Payment exceeds outstanding balance' using errcode='22023';end if;
 insert into public.financial_payments(organization_id,charge_id,kind,amount_cents,method,received_at,administrative_note,idempotency_key,installment_number,installment_count,created_by) values(v_charge.organization_id,p_charge_id,'receipt',p_amount_cents,p_method,p_received_at,coalesce(p_administrative_note,''),p_idempotency_key,p_installment_number,p_installment_count,v_actor) returning id,created_at into v_id,v_at;
 insert into public.financial_audit_events(organization_id,entity_type,entity_id,action,actor_user_id) values(v_charge.organization_id,'payment',v_id::text,'received',v_actor);return query select v_id,v_at;end;$$;

create or replace function public.reverse_financial_payment(p_payment_id uuid,p_idempotency_key uuid,p_administrative_note text)
returns table(saved_id uuid,charge_id uuid,amount_cents bigint,method public.financial_payment_method,received_at date,saved_at timestamptz) language plpgsql security definer set search_path='' as $$declare v_actor uuid:=(select auth.uid());v_original public.financial_payments;v_reversed bigint;v_id uuid;v_at timestamptz;begin
 select * into v_original from public.financial_payments where id=p_payment_id and kind='receipt' for update;if not found then raise exception 'Payment not found' using errcode='P0002';end if;
 if not atrianutri_private.has_finance_access(v_original.organization_id,array['manage']::public.finance_access_level[]) then raise exception 'Finance reversal denied' using errcode='42501';end if;
 select coalesce(sum(amount_cents),0) into v_reversed from public.financial_payments where reverses_payment_id=p_payment_id;if v_reversed>=v_original.amount_cents then raise exception 'Payment already reversed' using errcode='23505';end if;
 insert into public.financial_payments(organization_id,charge_id,kind,amount_cents,method,received_at,administrative_note,idempotency_key,reverses_payment_id,created_by) values(v_original.organization_id,v_original.charge_id,'reversal',v_original.amount_cents-v_reversed,v_original.method,current_date,coalesce(p_administrative_note,''),p_idempotency_key,p_payment_id,v_actor) returning id,created_at into v_id,v_at;
 insert into public.financial_audit_events(organization_id,entity_type,entity_id,action,actor_user_id) values(v_original.organization_id,'payment',v_id::text,'reversed',v_actor);return query select v_id,v_original.charge_id,v_original.amount_cents-v_reversed,v_original.method,current_date,v_at;end;$$;

create or replace function public.cancel_financial_charge(p_charge_id uuid,p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$declare v_actor uuid:=(select auth.uid());v_charge public.financial_charges;v_net bigint;begin select * into v_charge from public.financial_charges where id=p_charge_id for update;if not found then raise exception 'Charge not found' using errcode='P0002';end if;if not atrianutri_private.has_finance_access(v_charge.organization_id,array['manage']::public.finance_access_level[]) then raise exception 'Finance access denied' using errcode='42501';end if;if v_charge.updated_at<>p_expected_updated_at then raise exception 'Charge conflict' using errcode='40001';end if;select coalesce(sum(case when kind='receipt' then amount_cents else -amount_cents end),0) into v_net from public.financial_payments where charge_id=p_charge_id;if v_net<>0 then raise exception 'Reverse receipts before canceling charge' using errcode='22023';end if;update public.financial_charges set canceled_at=now(),canceled_by=v_actor where id=p_charge_id;insert into public.financial_audit_events(organization_id,entity_type,entity_id,action,actor_user_id) values(v_charge.organization_id,'charge',p_charge_id::text,'canceled',v_actor);end;$$;

create or replace function public.save_expense_category(p_organization_id uuid,p_name text,p_category_id uuid default null)
returns table(saved_id uuid,saved_name text) language plpgsql security definer set search_path='' as $$declare v_actor uuid:=(select auth.uid());v_id uuid;v_name text;begin if not atrianutri_private.has_finance_access(p_organization_id,array['manage']::public.finance_access_level[]) then raise exception 'Finance management denied' using errcode='42501';end if;if char_length(trim(p_name)) not between 2 and 120 then raise exception 'Invalid category' using errcode='22023';end if;if p_category_id is null then insert into public.expense_categories(organization_id,name,created_by) values(p_organization_id,trim(p_name),v_actor) returning id,name into v_id,v_name;else update public.expense_categories set name=trim(p_name) where id=p_category_id and organization_id=p_organization_id returning id,name into v_id,v_name;if not found then raise exception 'Category not found' using errcode='P0002';end if;end if;return query select v_id,v_name;end;$$;

create or replace function public.save_financial_expense(p_organization_id uuid,p_expense_id uuid,p_expected_updated_at timestamptz,p_category_id uuid,p_description text,p_amount_cents bigint,p_competence_date date,p_due_date date,p_paid_at date,p_status public.financial_expense_status,p_administrative_note text)
returns table(saved_id uuid,saved_updated_at timestamptz) language plpgsql security definer set search_path='' as $$declare v_actor uuid:=(select auth.uid());v_id uuid;v_at timestamptz;begin if not atrianutri_private.has_finance_access(p_organization_id,array['manage']::public.finance_access_level[]) then raise exception 'Finance management denied' using errcode='42501';end if;if p_amount_cents<=0 or (p_status='paid' and p_paid_at is null) then raise exception 'Invalid expense' using errcode='22023';end if;if p_expense_id is null then insert into public.financial_expenses(organization_id,category_id,description,amount_cents,competence_date,due_date,paid_at,status,administrative_note,created_by,updated_by) values(p_organization_id,p_category_id,trim(p_description),p_amount_cents,p_competence_date,p_due_date,p_paid_at,p_status,coalesce(p_administrative_note,''),v_actor,v_actor) returning id,updated_at into v_id,v_at;else update public.financial_expenses set category_id=p_category_id,description=trim(p_description),amount_cents=p_amount_cents,competence_date=p_competence_date,due_date=p_due_date,paid_at=p_paid_at,status=p_status,administrative_note=coalesce(p_administrative_note,''),updated_by=v_actor where id=p_expense_id and organization_id=p_organization_id and updated_at=p_expected_updated_at returning id,updated_at into v_id,v_at;if not found then raise exception 'Expense conflict' using errcode='40001';end if;end if;insert into public.financial_audit_events(organization_id,entity_type,entity_id,action,actor_user_id) values(p_organization_id,'expense',v_id::text,case when p_expense_id is null then 'created' else 'updated' end,v_actor);return query select v_id,v_at;end;$$;

revoke all on function public.set_finance_permission(uuid,uuid,public.finance_access_level,boolean),public.create_financial_charge(uuid,uuid,uuid,uuid,uuid,text,bigint,date,text),public.record_financial_payment(uuid,bigint,public.financial_payment_method,date,text,uuid,integer,integer),public.reverse_financial_payment(uuid,uuid,text),public.cancel_financial_charge(uuid,timestamptz),public.save_expense_category(uuid,text,uuid),public.save_financial_expense(uuid,uuid,timestamptz,uuid,text,bigint,date,date,date,public.financial_expense_status,text) from public,anon;
grant execute on function public.set_finance_permission(uuid,uuid,public.finance_access_level,boolean),public.create_financial_charge(uuid,uuid,uuid,uuid,uuid,text,bigint,date,text),public.record_financial_payment(uuid,bigint,public.financial_payment_method,date,text,uuid,integer,integer),public.reverse_financial_payment(uuid,uuid,text),public.cancel_financial_charge(uuid,timestamptz),public.save_expense_category(uuid,text,uuid),public.save_financial_expense(uuid,uuid,timestamptz,uuid,text,bigint,date,date,date,public.financial_expense_status,text) to authenticated;

commit;
