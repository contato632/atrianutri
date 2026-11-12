-- AtriaNutri Etapa 22 — anamnese estruturada, versionada e privada.
-- Migration local/versionada. Não aplicar remotamente sem homologação explícita.
begin;

create type public.nutrition_anamnesis_kind as enum ('initial','update','complement');
create type public.nutrition_anamnesis_status as enum ('draft','completed');

create table public.nutrition_anamneses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null,
  kind public.nutrition_anamnesis_kind not null,
  status public.nutrition_anamnesis_status not null default 'draft',
  version integer not null check (version > 0),
  recorded_on date not null default current_date,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  professional_private_notes text not null default '' check (char_length(professional_private_notes) <= 12000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, organization_id) references public.patients_administrative(id, organization_id) on delete cascade,
  foreign key (organization_id, created_by) references public.organization_members(organization_id, user_id),
  unique (organization_id, patient_id, version)
);

create index nutrition_anamneses_patient_history_idx on public.nutrition_anamneses(organization_id,patient_id,version desc);
create unique index nutrition_anamneses_one_draft_idx on public.nutrition_anamneses(organization_id,patient_id) where status='draft';
create trigger touch_nutrition_anamnesis before update on public.nutrition_anamneses for each row execute function atrianutri_private.touch_updated_at();
create trigger audit_nutrition_anamnesis after insert or update or delete on public.nutrition_anamneses for each row execute function atrianutri_private.audit_sensitive_change('nutrition_anamnesis');

alter table public.nutrition_anamneses enable row level security;
revoke all on public.nutrition_anamneses from public,anon,authenticated;
grant select on public.nutrition_anamneses to authenticated;

create policy nutrition_anamneses_select_professional on public.nutrition_anamneses for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id,patient_id)
);

create or replace function public.save_nutrition_anamnesis(
  p_organization_id uuid,p_patient_id uuid,p_kind public.nutrition_anamnesis_kind,p_status public.nutrition_anamnesis_status,
  p_recorded_on date,p_answers jsonb,p_professional_private_notes text,p_record_id uuid default null,p_expected_updated_at timestamptz default null
) returns public.nutrition_anamneses
language plpgsql security definer set search_path='' as $$
declare v_saved public.nutrition_anamneses; v_version integer;
begin
  if not atrianutri_private.can_access_patient_clinical(p_organization_id,p_patient_id) then raise exception 'Clinical access denied' using errcode='42501'; end if;
  if jsonb_typeof(p_answers)<>'object' or char_length(coalesce(p_professional_private_notes,''))>12000 then raise exception 'Invalid anamnesis payload' using errcode='22023'; end if;
  perform 1 from public.patients_administrative where id=p_patient_id and organization_id=p_organization_id for update;
  if p_record_id is not null then
    update public.nutrition_anamneses set kind=p_kind,status=p_status,recorded_on=p_recorded_on,answers=p_answers,professional_private_notes=coalesce(p_professional_private_notes,'')
    where id=p_record_id and organization_id=p_organization_id and patient_id=p_patient_id and status='draft' and updated_at=p_expected_updated_at returning * into v_saved;
    if v_saved.id is null then raise exception 'Draft changed or unavailable' using errcode='40001'; end if;
  else
    select coalesce(max(version),0)+1 into v_version from public.nutrition_anamneses where organization_id=p_organization_id and patient_id=p_patient_id;
    insert into public.nutrition_anamneses(organization_id,patient_id,kind,status,version,recorded_on,answers,professional_private_notes,created_by)
    values(p_organization_id,p_patient_id,p_kind,p_status,v_version,p_recorded_on,p_answers,coalesce(p_professional_private_notes,''),(select auth.uid())) returning * into v_saved;
  end if;
  return v_saved;
end;
$$;

revoke all on function public.save_nutrition_anamnesis(uuid,uuid,public.nutrition_anamnesis_kind,public.nutrition_anamnesis_status,date,jsonb,text,uuid,timestamptz) from public,anon;
grant execute on function public.save_nutrition_anamnesis(uuid,uuid,public.nutrition_anamnesis_kind,public.nutrition_anamnesis_status,date,jsonb,text,uuid,timestamptz) to authenticated;
commit;
