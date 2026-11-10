-- AtriaNutri Etapa 13: immutable manual nutrition targets alongside each plan version.
-- The structured foods, source snapshots and approved substitutions remain inside meals JSONB.

create or replace function atrianutri_private.valid_nutrition_targets(p_targets jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_targets is null or jsonb_typeof(p_targets) <> 'object' or octet_length(p_targets::text) > 2000 then false
    else not exists (
      select 1 from jsonb_each(p_targets) target
      where target.key not in ('energyKcal','proteinG','carbohydrateG','fatG','fiberG','sodiumMg')
         or jsonb_typeof(target.value) <> 'number'
         or (target.value #>> '{}')::numeric <= 0
    )
  end
$$;
revoke all on function atrianutri_private.valid_nutrition_targets(jsonb) from public,anon,authenticated,service_role;

alter table public.meal_plan_versions
  add column nutrition_targets jsonb not null default '{}'::jsonb
  check (atrianutri_private.valid_nutrition_targets(nutrition_targets));

create or replace function public.save_meal_plan_version_v2(
  p_meal_plan_id uuid,
  p_expected_version integer,
  p_title text,
  p_meals jsonb,
  p_nutrition_targets jsonb,
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
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_expected_version is null or p_expected_version < 0 then raise exception 'Invalid expected version' using errcode='22023'; end if;
  if p_meals is null or jsonb_typeof(p_meals) <> 'array' then raise exception 'Meals must be a JSON array' using errcode='22023'; end if;
  if not atrianutri_private.valid_nutrition_targets(p_nutrition_targets)
  then raise exception 'Invalid nutrition targets' using errcode='22023'; end if;
  if char_length(trim(p_title)) not between 2 and 200 then raise exception 'Invalid meal plan title' using errcode='22023'; end if;
  if char_length(coalesce(p_change_summary,'')) > 500 then raise exception 'Change summary is too long' using errcode='22023'; end if;

  select plan.organization_id,plan.patient_id,plan.current_version into v_organization_id,v_patient_id,v_current_version
  from public.meal_plans plan where plan.id=p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found' using errcode='P0002'; end if;
  if not atrianutri_private.can_access_patient_clinical(v_organization_id,v_patient_id) then raise exception 'Clinical access denied' using errcode='42501'; end if;
  if v_current_version<>p_expected_version then raise exception 'Meal plan version conflict' using errcode='40001'; end if;

  v_next_version:=v_current_version+1; v_saved_at:=now();
  insert into public.meal_plan_versions(organization_id,meal_plan_id,patient_id,version,meals,nutrition_targets,change_summary,created_by,created_at)
  values(v_organization_id,p_meal_plan_id,v_patient_id,v_next_version,p_meals,p_nutrition_targets,coalesce(p_change_summary,''),(select auth.uid()),v_saved_at);
  update public.meal_plans set title=trim(p_title),current_version=v_next_version,updated_by=(select auth.uid()),updated_at=v_saved_at where id=p_meal_plan_id;
  return query select p_meal_plan_id,v_next_version,v_saved_at;
end;
$$;

create or replace function public.create_meal_plan_draft_v2(
  p_organization_id uuid,
  p_patient_id uuid,
  p_title text,
  p_meals jsonb,
  p_nutrition_targets jsonb,
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
  if v_actor is null or not atrianutri_private.can_access_patient_clinical(p_organization_id,p_patient_id) then raise exception 'Clinical access denied' using errcode='42501'; end if;
  if char_length(trim(p_title)) not between 2 and 200 then raise exception 'Invalid meal plan title' using errcode='22023'; end if;
  if p_meals is null or jsonb_typeof(p_meals)<>'array' then raise exception 'Meals must be a JSON array' using errcode='22023'; end if;
  if not atrianutri_private.valid_nutrition_targets(p_nutrition_targets)
  then raise exception 'Invalid nutrition targets' using errcode='22023'; end if;
  if char_length(coalesce(p_change_summary,''))>500 then raise exception 'Change summary is too long' using errcode='22023'; end if;

  insert into public.meal_plans(organization_id,patient_id,title,status,current_version,created_by,updated_by,created_at,updated_at)
  values(p_organization_id,p_patient_id,trim(p_title),'draft',1,v_actor,v_actor,v_saved_at,v_saved_at) returning id into v_plan_id;
  insert into public.meal_plan_versions(organization_id,meal_plan_id,patient_id,version,meals,nutrition_targets,change_summary,created_by,created_at)
  values(p_organization_id,v_plan_id,p_patient_id,1,p_meals,p_nutrition_targets,coalesce(p_change_summary,''),v_actor,v_saved_at);
  return query select v_plan_id,1,v_saved_at;
end;
$$;

revoke all on function public.save_meal_plan_version_v2(uuid,integer,text,jsonb,jsonb,text) from public,anon,service_role;
revoke all on function public.create_meal_plan_draft_v2(uuid,uuid,text,jsonb,jsonb,text) from public,anon,service_role;
grant execute on function public.save_meal_plan_version_v2(uuid,integer,text,jsonb,jsonb,text) to authenticated;
grant execute on function public.create_meal_plan_draft_v2(uuid,uuid,text,jsonb,jsonb,text) to authenticated;

comment on column public.meal_plan_versions.nutrition_targets is 'Manual professional targets snapshotted with the immutable plan version; never generated by the application.';
