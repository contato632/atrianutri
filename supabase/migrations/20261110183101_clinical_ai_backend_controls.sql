-- AtriaNutri Etapa 19 — metadados e cotas do backend de IA clínica.
-- Migration local/versionada. Não aplicar remotamente sem homologação explícita.
begin;

create type public.clinical_ai_tool as enum (
  'evolution-analysis', 'appointment-preparation', 'investigation-questions', 'clinical-summary'
);
create type public.clinical_ai_operation_status as enum ('reserved', 'success', 'error', 'canceled');

create table public.clinical_ai_usage_limits (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  tool public.clinical_ai_tool not null,
  period_start date not null,
  period_end date not null,
  max_requests integer not null check (max_requests between 1 and 10000),
  max_input_tokens bigint not null check (max_input_tokens between 1 and 1000000000),
  max_output_tokens bigint not null check (max_output_tokens between 1 and 1000000000),
  max_cost_micros bigint not null check (max_cost_micros >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, professional_user_id, tool, period_start),
  foreign key (organization_id, professional_user_id)
    references public.organization_members(organization_id, user_id) on delete cascade,
  constraint clinical_ai_limit_period check (period_end >= period_start)
);

create table public.clinical_ai_operations (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null,
  tool public.clinical_ai_tool not null,
  idempotency_key uuid not null,
  status public.clinical_ai_operation_status not null default 'reserved',
  reserved_input_tokens integer not null check (reserved_input_tokens between 1 and 200000),
  reserved_output_tokens integer not null check (reserved_output_tokens between 1 and 200000),
  reserved_cost_micros bigint not null check (reserved_cost_micros >= 0),
  input_tokens integer check (input_tokens between 0 and 200000),
  output_tokens integer check (output_tokens between 0 and 200000),
  estimated_cost_micros bigint check (estimated_cost_micros >= 0),
  model text check (model is null or char_length(model) between 1 and 160),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 300000),
  error_code text check (error_code is null or char_length(error_code) <= 80),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (patient_id, organization_id)
    references public.patients_administrative(id, organization_id) on delete cascade,
  foreign key (organization_id, professional_user_id)
    references public.organization_members(organization_id, user_id),
  unique (organization_id, professional_user_id, idempotency_key),
  constraint clinical_ai_operation_completion check (
    (status = 'reserved' and completed_at is null)
    or (status <> 'reserved' and completed_at is not null)
  )
);

create index clinical_ai_operations_scope_time_idx
  on public.clinical_ai_operations(organization_id, professional_user_id, tool, created_at desc);

alter table public.clinical_ai_usage_limits enable row level security;
alter table public.clinical_ai_operations enable row level security;
revoke all on public.clinical_ai_usage_limits, public.clinical_ai_operations from public, anon, authenticated;
grant select, insert, update on public.clinical_ai_usage_limits, public.clinical_ai_operations to service_role;

-- Invoker functions: service_role is required; there is no client-callable privileged path.
create or replace function public.reserve_clinical_ai_operation(
  p_request_id uuid,
  p_organization_id uuid,
  p_professional_user_id uuid,
  p_patient_id uuid,
  p_tool public.clinical_ai_tool,
  p_idempotency_key uuid,
  p_reserved_input_tokens integer,
  p_reserved_output_tokens integer,
  p_reserved_cost_micros bigint
) returns table(operation_id uuid, reused boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_limit public.clinical_ai_usage_limits%rowtype;
  v_existing uuid;
  v_requests bigint;
  v_input bigint;
  v_output bigint;
  v_cost bigint;
begin
  if p_reserved_input_tokens not between 1 and 200000
    or p_reserved_output_tokens not between 1 and 200000
    or p_reserved_cost_micros < 0 then
    raise exception 'Invalid AI reservation' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.organization_members m
    join public.patient_professional_assignments a
      on a.organization_id = m.organization_id and a.professional_user_id = m.user_id
     and a.patient_id = p_patient_id and a.active
    where m.organization_id = p_organization_id and m.user_id = p_professional_user_id
      and m.active and m.clinical_access and m.role in ('owner', 'nutritionist')
  ) then raise exception 'Clinical AI access denied' using errcode = '42501'; end if;

  select l.* into v_limit from public.clinical_ai_usage_limits l
   where l.organization_id = p_organization_id and l.professional_user_id = p_professional_user_id
     and l.tool = p_tool and current_date between l.period_start and l.period_end
   order by l.period_start desc limit 1 for update;
  if v_limit.organization_id is null then raise exception 'AI quota is not configured' using errcode = 'P0001'; end if;

  -- The limit row is the serialization point for quota and idempotency checks.
  select o.id into v_existing from public.clinical_ai_operations o
   where o.organization_id = p_organization_id
     and o.professional_user_id = p_professional_user_id
     and o.idempotency_key = p_idempotency_key;
  if v_existing is not null then return query select v_existing, true; return; end if;

  select count(*),
    coalesce(sum(case when o.status='success' then o.input_tokens else o.reserved_input_tokens end),0),
    coalesce(sum(case when o.status='success' then o.output_tokens else o.reserved_output_tokens end),0),
    coalesce(sum(case when o.status='success' then o.estimated_cost_micros else o.reserved_cost_micros end),0)
    into v_requests, v_input, v_output, v_cost
    from public.clinical_ai_operations o
   where o.organization_id = p_organization_id and o.professional_user_id = p_professional_user_id
     and o.tool = p_tool and o.created_at::date between v_limit.period_start and v_limit.period_end
     and o.status in ('reserved','success');

  if v_requests + 1 > v_limit.max_requests
    or v_input + p_reserved_input_tokens > v_limit.max_input_tokens
    or v_output + p_reserved_output_tokens > v_limit.max_output_tokens
    or v_cost + p_reserved_cost_micros > v_limit.max_cost_micros then
    raise exception 'AI quota exceeded' using errcode = 'P0001';
  end if;

  insert into public.clinical_ai_operations(id,organization_id,professional_user_id,patient_id,tool,idempotency_key,reserved_input_tokens,reserved_output_tokens,reserved_cost_micros)
  values(p_request_id,p_organization_id,p_professional_user_id,p_patient_id,p_tool,p_idempotency_key,p_reserved_input_tokens,p_reserved_output_tokens,p_reserved_cost_micros);
  return query select p_request_id, false;
end;
$$;

create or replace function public.complete_clinical_ai_operation(
  p_operation_id uuid,
  p_professional_user_id uuid,
  p_status public.clinical_ai_operation_status,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_micros bigint,
  p_model text,
  p_duration_ms integer,
  p_error_code text default null
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_status = 'reserved' then raise exception 'Completion status required' using errcode='22023'; end if;
  update public.clinical_ai_operations set
    status=p_status,input_tokens=greatest(coalesce(p_input_tokens,0),0),output_tokens=greatest(coalesce(p_output_tokens,0),0),
    estimated_cost_micros=greatest(coalesce(p_estimated_cost_micros,0),0),model=left(p_model,160),
    duration_ms=greatest(coalesce(p_duration_ms,0),0),error_code=left(p_error_code,80),completed_at=now()
  where id=p_operation_id and professional_user_id=p_professional_user_id and status='reserved'
    and greatest(coalesce(p_input_tokens,0),0) <= reserved_input_tokens
    and greatest(coalesce(p_output_tokens,0),0) <= reserved_output_tokens
    and greatest(coalesce(p_estimated_cost_micros,0),0) <= reserved_cost_micros;
  if not found then raise exception 'AI operation not found or already completed' using errcode='P0001'; end if;
end;
$$;

revoke all on function public.reserve_clinical_ai_operation(uuid,uuid,uuid,uuid,public.clinical_ai_tool,uuid,integer,integer,bigint) from public, anon, authenticated;
revoke all on function public.complete_clinical_ai_operation(uuid,uuid,public.clinical_ai_operation_status,integer,integer,bigint,text,integer,text) from public, anon, authenticated;
grant execute on function public.reserve_clinical_ai_operation(uuid,uuid,uuid,uuid,public.clinical_ai_tool,uuid,integer,integer,bigint) to service_role;
grant execute on function public.complete_clinical_ai_operation(uuid,uuid,public.clinical_ai_operation_status,integer,integer,bigint,text,integer,text) to service_role;

commit;
