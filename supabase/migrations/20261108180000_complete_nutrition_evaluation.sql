-- AtriaNutri — structured nutrition evaluation and retrospective 24-hour recall.
-- Review-only migration. Do not apply remotely in Etapa 06.
begin;

create table public.nutrition_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  evaluated_on date not null check (evaluated_on <= current_date),
  consultation_reason text not null default '' check (char_length(consultation_reason) <= 4000),
  health_history text not null default '' check (char_length(health_history) <= 8000),
  reported_allergies text not null default '' check (char_length(reported_allergies) <= 4000),
  reported_medications text not null default '' check (char_length(reported_medications) <= 4000),
  previous_nutrition_care text not null default '' check (char_length(previous_nutrition_care) <= 4000),
  food_restrictions_and_preferences text not null default '' check (char_length(food_restrictions_and_preferences) <= 8000),
  usual_meal_schedule text not null default '' check (char_length(usual_meal_schedule) <= 4000),
  usual_meals_count text not null default '' check (char_length(usual_meals_count) <= 200),
  meal_environment text not null default '' check (char_length(meal_environment) <= 4000),
  food_access text not null default '' check (char_length(food_access) <= 4000),
  hydration text not null default '' check (char_length(hydration) <= 2000),
  reported_difficulties text not null default '' check (char_length(reported_difficulties) <= 8000),
  professional_observations text not null default '' check (char_length(professional_observations) <= 8000),
  created_by uuid not null references auth.users(id),
  responsible_professional_user_id uuid not null,
  submission_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, organization_id) references public.patients_administrative(id, organization_id) on delete cascade,
  foreign key (organization_id, responsible_professional_user_id) references public.organization_members(organization_id, user_id),
  unique (id, organization_id, patient_id),
  unique (organization_id, patient_id, created_by, submission_key)
);

create table public.dietary_recalls_24h (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  nutrition_evaluation_id uuid not null,
  recall_date date not null check (recall_date <= current_date),
  meals jsonb not null check (jsonb_typeof(meals) = 'array' and jsonb_array_length(meals) between 1 and 20 and octet_length(meals::text) <= 60000),
  complementary_notes text not null default '' check (char_length(complementary_notes) <= 4000),
  created_by uuid not null references auth.users(id),
  submission_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (nutrition_evaluation_id, organization_id, patient_id) references public.nutrition_evaluations(id, organization_id, patient_id) on delete cascade,
  unique (id, organization_id, patient_id),
  unique (organization_id, patient_id, created_by, submission_key)
);

create index nutrition_evaluations_patient_date_idx on public.nutrition_evaluations(organization_id, patient_id, evaluated_on desc);
create index dietary_recalls_patient_date_idx on public.dietary_recalls_24h(organization_id, patient_id, recall_date desc);
create index dietary_recalls_evaluation_idx on public.dietary_recalls_24h(nutrition_evaluation_id);

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
  'patient_administrative','patient_assignment','patient_clinical_profile','nutrition_assessment','meal_plan','meal_plan_version','organization_member',
  'food_diary_entry','habit_goal','habit_check_in','clinical_private_note','nutrition_evaluation','dietary_recall_24h'
));

create or replace function atrianutri_private.audit_sensitive_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_org uuid := coalesce((v_new->>'organization_id')::uuid,(v_old->>'organization_id')::uuid);
  v_id text := coalesce(v_new->>'id',v_new->>'patient_id',v_new->>'user_id',v_old->>'id',v_old->>'patient_id',v_old->>'user_id');
  v_changed text[];
begin
  select coalesce(array_agg(field_name order by field_name),'{}') into v_changed from (
    select field_name from jsonb_object_keys(v_old||v_new) fields(field_name) where v_old->field_name is distinct from v_new->field_name
  ) changed;
  v_changed := array(select value from unnest(v_changed) value where value not in (
    'full_name','birth_date','email','phone','goal','food_history','habits','professional_notes','weight_kg','height_cm','waist_cm','hip_cm','arm_cm','body_fat_percentage','bmi','notes','meals',
    'foods','eating_context','hunger_before','satiety_after','routine_changes','title','description','difficulties','next_step','content',
    'consultation_reason','health_history','reported_allergies','reported_medications','previous_nutrition_care','food_restrictions_and_preferences',
    'usual_meal_schedule','usual_meals_count','meal_environment','food_access','hydration','reported_difficulties','professional_observations','complementary_notes'
  ));
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,operation,changed_fields)
  values(v_org,(select auth.uid()),tg_argv[0],v_id,tg_op,v_changed);
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function atrianutri_private.audit_sensitive_change() from public,anon,authenticated,service_role;

create trigger touch_nutrition_evaluation before update on public.nutrition_evaluations for each row execute function atrianutri_private.touch_updated_at();
create trigger audit_nutrition_evaluation after insert or update or delete on public.nutrition_evaluations for each row execute function atrianutri_private.audit_sensitive_change('nutrition_evaluation');
create trigger touch_dietary_recall before update on public.dietary_recalls_24h for each row execute function atrianutri_private.touch_updated_at();
create trigger audit_dietary_recall after insert or update or delete on public.dietary_recalls_24h for each row execute function atrianutri_private.audit_sensitive_change('dietary_recall_24h');

alter table public.nutrition_evaluations enable row level security;
alter table public.dietary_recalls_24h enable row level security;
revoke all on public.nutrition_evaluations,public.dietary_recalls_24h from public,anon,authenticated;
grant select on public.nutrition_evaluations,public.dietary_recalls_24h to authenticated;

create policy nutrition_evaluations_select_clinical on public.nutrition_evaluations for select to authenticated using (atrianutri_private.can_access_patient_clinical(organization_id,patient_id));
create policy nutrition_evaluations_insert_clinical on public.nutrition_evaluations for insert to authenticated with check (created_by=(select auth.uid()) and responsible_professional_user_id=(select auth.uid()) and atrianutri_private.can_access_patient_clinical(organization_id,patient_id));
create policy nutrition_evaluations_update_clinical on public.nutrition_evaluations for update to authenticated using (atrianutri_private.can_access_patient_clinical(organization_id,patient_id)) with check (atrianutri_private.can_access_patient_clinical(organization_id,patient_id));
create policy dietary_recalls_select_clinical on public.dietary_recalls_24h for select to authenticated using (atrianutri_private.can_access_patient_clinical(organization_id,patient_id));
create policy dietary_recalls_insert_clinical on public.dietary_recalls_24h for insert to authenticated with check (created_by=(select auth.uid()) and atrianutri_private.can_access_patient_clinical(organization_id,patient_id));
create policy dietary_recalls_update_clinical on public.dietary_recalls_24h for update to authenticated using (atrianutri_private.can_access_patient_clinical(organization_id,patient_id)) with check (atrianutri_private.can_access_patient_clinical(organization_id,patient_id));

create or replace function public.save_nutrition_evaluation(
  p_organization_id uuid,p_patient_id uuid,p_evaluated_on date,p_consultation_reason text,p_health_history text,p_reported_allergies text,
  p_reported_medications text,p_previous_nutrition_care text,p_food_restrictions_and_preferences text,p_usual_meal_schedule text,
  p_usual_meals_count text,p_meal_environment text,p_food_access text,p_hydration text,p_reported_difficulties text,p_professional_observations text,
  p_submission_key uuid,p_evaluation_id uuid default null,p_expected_updated_at timestamptz default null
) returns table(saved_id uuid,saved_updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_current timestamptz; v_id uuid; v_at timestamptz;
begin
  if v_actor is null or not atrianutri_private.can_access_patient_clinical(p_organization_id,p_patient_id) then raise exception 'Clinical access denied' using errcode='42501'; end if;
  if p_evaluated_on>current_date or char_length(coalesce(p_consultation_reason,''))>4000 or char_length(coalesce(p_health_history,''))>8000
    or char_length(coalesce(p_reported_allergies,''))>4000 or char_length(coalesce(p_reported_medications,''))>4000 or char_length(coalesce(p_previous_nutrition_care,''))>4000
    or char_length(coalesce(p_food_restrictions_and_preferences,''))>8000 or char_length(coalesce(p_usual_meal_schedule,''))>4000 or char_length(coalesce(p_usual_meals_count,''))>200
    or char_length(coalesce(p_meal_environment,''))>4000 or char_length(coalesce(p_food_access,''))>4000 or char_length(coalesce(p_hydration,''))>2000
    or char_length(coalesce(p_reported_difficulties,''))>8000 or char_length(coalesce(p_professional_observations,''))>8000 then raise exception 'Invalid nutrition evaluation' using errcode='22023'; end if;
  if p_evaluation_id is null then
    select e.id,e.updated_at into v_id,v_at from public.nutrition_evaluations e where e.organization_id=p_organization_id and e.patient_id=p_patient_id and e.created_by=v_actor and e.submission_key=p_submission_key;
    if v_id is null then insert into public.nutrition_evaluations(organization_id,patient_id,evaluated_on,consultation_reason,health_history,reported_allergies,reported_medications,previous_nutrition_care,food_restrictions_and_preferences,usual_meal_schedule,usual_meals_count,meal_environment,food_access,hydration,reported_difficulties,professional_observations,created_by,responsible_professional_user_id,submission_key)
      values(p_organization_id,p_patient_id,p_evaluated_on,coalesce(p_consultation_reason,''),coalesce(p_health_history,''),coalesce(p_reported_allergies,''),coalesce(p_reported_medications,''),coalesce(p_previous_nutrition_care,''),coalesce(p_food_restrictions_and_preferences,''),coalesce(p_usual_meal_schedule,''),coalesce(p_usual_meals_count,''),coalesce(p_meal_environment,''),coalesce(p_food_access,''),coalesce(p_hydration,''),coalesce(p_reported_difficulties,''),coalesce(p_professional_observations,''),v_actor,v_actor,p_submission_key) returning id,updated_at into v_id,v_at; end if;
  else
    select updated_at into v_current from public.nutrition_evaluations where id=p_evaluation_id and organization_id=p_organization_id and patient_id=p_patient_id for update;
    if not found then raise exception 'Nutrition evaluation not found' using errcode='P0002'; end if;
    if p_expected_updated_at is null or v_current<>p_expected_updated_at then raise exception 'Nutrition evaluation conflict' using errcode='40001'; end if;
    update public.nutrition_evaluations set evaluated_on=p_evaluated_on,consultation_reason=coalesce(p_consultation_reason,''),health_history=coalesce(p_health_history,''),reported_allergies=coalesce(p_reported_allergies,''),reported_medications=coalesce(p_reported_medications,''),previous_nutrition_care=coalesce(p_previous_nutrition_care,''),food_restrictions_and_preferences=coalesce(p_food_restrictions_and_preferences,''),usual_meal_schedule=coalesce(p_usual_meal_schedule,''),usual_meals_count=coalesce(p_usual_meals_count,''),meal_environment=coalesce(p_meal_environment,''),food_access=coalesce(p_food_access,''),hydration=coalesce(p_hydration,''),reported_difficulties=coalesce(p_reported_difficulties,''),professional_observations=coalesce(p_professional_observations,'') where id=p_evaluation_id returning id,updated_at into v_id,v_at;
  end if;
  return query select v_id,v_at;
end; $$;

create or replace function public.save_dietary_recall_24h(p_organization_id uuid,p_patient_id uuid,p_nutrition_evaluation_id uuid,p_recall_date date,p_meals jsonb,p_complementary_notes text,p_submission_key uuid,p_recall_id uuid default null,p_expected_updated_at timestamptz default null)
returns table(saved_id uuid,saved_updated_at timestamptz) language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_current timestamptz; v_id uuid; v_at timestamptz;
begin
  if v_actor is null or not atrianutri_private.can_access_patient_clinical(p_organization_id,p_patient_id) then raise exception 'Clinical access denied' using errcode='42501'; end if;
  if not exists(select 1 from public.nutrition_evaluations e where e.id=p_nutrition_evaluation_id and e.organization_id=p_organization_id and e.patient_id=p_patient_id) then raise exception 'Nutrition evaluation not found' using errcode='P0002'; end if;
  if p_recall_date>current_date or p_meals is null or jsonb_typeof(p_meals)<>'array' or jsonb_array_length(p_meals) not between 1 and 20 or octet_length(p_meals::text)>60000 or char_length(coalesce(p_complementary_notes,''))>4000 then raise exception 'Invalid dietary recall' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_meals) meal where jsonb_typeof(meal)<>'object' or char_length(trim(coalesce(meal->>'name',''))) not between 1 and 200 or coalesce(meal->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or jsonb_typeof(meal->'foods')<>'array' or jsonb_array_length(meal->'foods') not between 1 and 50 or char_length(coalesce(meal->>'context',''))>2000 or char_length(coalesce(meal->>'notes',''))>2000) then raise exception 'Invalid dietary recall meal' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_meals) meal cross join lateral jsonb_array_elements(meal->'foods') food where jsonb_typeof(food)<>'object' or char_length(trim(coalesce(food->>'name',''))) not between 1 and 300 or char_length(coalesce(food->>'quantity',''))>200) then raise exception 'Invalid dietary recall food' using errcode='22023'; end if;
  if p_recall_id is null then
    select r.id,r.updated_at into v_id,v_at from public.dietary_recalls_24h r where r.organization_id=p_organization_id and r.patient_id=p_patient_id and r.created_by=v_actor and r.submission_key=p_submission_key;
    if v_id is null then insert into public.dietary_recalls_24h(organization_id,patient_id,nutrition_evaluation_id,recall_date,meals,complementary_notes,created_by,submission_key) values(p_organization_id,p_patient_id,p_nutrition_evaluation_id,p_recall_date,p_meals,coalesce(p_complementary_notes,''),v_actor,p_submission_key) returning id,updated_at into v_id,v_at; end if;
  else
    select updated_at into v_current from public.dietary_recalls_24h where id=p_recall_id and organization_id=p_organization_id and patient_id=p_patient_id and nutrition_evaluation_id=p_nutrition_evaluation_id for update;
    if not found then raise exception 'Dietary recall not found' using errcode='P0002'; end if;
    if p_expected_updated_at is null or v_current<>p_expected_updated_at then raise exception 'Dietary recall conflict' using errcode='40001'; end if;
    update public.dietary_recalls_24h set recall_date=p_recall_date,meals=p_meals,complementary_notes=coalesce(p_complementary_notes,'') where id=p_recall_id returning id,updated_at into v_id,v_at;
  end if;
  return query select v_id,v_at;
end; $$;

revoke all on function public.save_nutrition_evaluation(uuid,uuid,date,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid,uuid,timestamptz) from public,anon,service_role;
revoke all on function public.save_dietary_recall_24h(uuid,uuid,uuid,date,jsonb,text,uuid,uuid,timestamptz) from public,anon,service_role;
grant execute on function public.save_nutrition_evaluation(uuid,uuid,date,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.save_dietary_recall_24h(uuid,uuid,uuid,date,jsonb,text,uuid,uuid,timestamptz) to authenticated;

commit;
