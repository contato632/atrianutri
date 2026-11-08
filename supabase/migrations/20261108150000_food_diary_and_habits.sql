-- AtriaNutri — food diary and individualized habit tracking.
-- Review-only migration for the dedicated AtriaNutri project. Do not apply remotely in Etapa 05.

begin;

create type public.food_diary_meal_type as enum (
  'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack', 'other'
);
create type public.clinical_record_source as enum ('patient', 'professional');
create type public.habit_goal_status as enum ('active', 'paused', 'completed');
create type public.habit_progress as enum ('progressing', 'maintaining', 'difficulty', 'not_observed');

create table public.food_diary_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  entry_date date not null check (entry_date <= current_date),
  meal_time time not null,
  meal_type public.food_diary_meal_type not null,
  foods jsonb not null check (
    jsonb_typeof(foods) = 'array'
    and jsonb_array_length(foods) between 1 and 50
    and octet_length(foods::text) <= 30000
  ),
  notes text not null default '' check (char_length(notes) <= 4000),
  eating_context text not null default '' check (char_length(eating_context) <= 2000),
  hunger_before text not null default '' check (char_length(hunger_before) <= 500),
  satiety_after text not null default '' check (char_length(satiety_after) <= 500),
  routine_changes text not null default '' check (char_length(routine_changes) <= 4000),
  source public.clinical_record_source not null,
  author_user_id uuid not null references auth.users(id),
  responsible_professional_user_id uuid not null,
  shared_with_patient_at timestamptz,
  submission_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, organization_id)
    references public.patients_administrative(id, organization_id) on delete cascade,
  foreign key (organization_id, responsible_professional_user_id)
    references public.organization_members(organization_id, user_id),
  unique (id, organization_id, patient_id),
  unique (organization_id, patient_id, author_user_id, submission_key)
);

create table public.habit_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  title text not null check (char_length(trim(title)) between 3 and 200),
  description text not null default '' check (char_length(description) <= 4000),
  status public.habit_goal_status not null default 'active',
  created_by uuid not null references auth.users(id),
  responsible_professional_user_id uuid not null,
  shared_with_patient_at timestamptz,
  submission_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, organization_id)
    references public.patients_administrative(id, organization_id) on delete cascade,
  foreign key (organization_id, responsible_professional_user_id)
    references public.organization_members(organization_id, user_id),
  unique (id, organization_id, patient_id),
  unique (organization_id, patient_id, created_by, submission_key)
);

create table public.habit_check_ins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  habit_goal_id uuid not null,
  recorded_on date not null check (recorded_on <= current_date),
  progress public.habit_progress not null,
  notes text not null default '' check (char_length(notes) <= 4000),
  difficulties text not null default '' check (char_length(difficulties) <= 4000),
  next_step text not null default '' check (char_length(next_step) <= 2000),
  source public.clinical_record_source not null,
  author_user_id uuid not null references auth.users(id),
  shared_with_patient_at timestamptz,
  submission_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (habit_goal_id, organization_id, patient_id)
    references public.habit_goals(id, organization_id, patient_id) on delete cascade,
  unique (id, organization_id, patient_id),
  unique (organization_id, patient_id, author_user_id, submission_key)
);

-- Private notes never share a row with patient-visible content.
create table public.clinical_private_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  food_diary_entry_id uuid,
  habit_goal_id uuid,
  habit_check_in_id uuid,
  content text not null check (char_length(trim(content)) between 1 and 4000),
  author_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint private_note_single_parent check (
    num_nonnulls(food_diary_entry_id, habit_goal_id, habit_check_in_id) = 1
  ),
  foreign key (food_diary_entry_id, organization_id, patient_id)
    references public.food_diary_entries(id, organization_id, patient_id) on delete cascade,
  foreign key (habit_goal_id, organization_id, patient_id)
    references public.habit_goals(id, organization_id, patient_id) on delete cascade,
  foreign key (habit_check_in_id, organization_id, patient_id)
    references public.habit_check_ins(id, organization_id, patient_id) on delete cascade
);

create unique index private_note_food_entry_unique on public.clinical_private_notes(food_diary_entry_id) where food_diary_entry_id is not null;
create unique index private_note_habit_goal_unique on public.clinical_private_notes(habit_goal_id) where habit_goal_id is not null;
create unique index private_note_habit_check_in_unique on public.clinical_private_notes(habit_check_in_id) where habit_check_in_id is not null;
create index food_diary_patient_period_idx on public.food_diary_entries(organization_id, patient_id, entry_date desc, meal_time desc);
create index food_diary_patient_type_idx on public.food_diary_entries(organization_id, patient_id, meal_type, entry_date desc);
create index habit_goals_patient_status_idx on public.habit_goals(organization_id, patient_id, status, updated_at desc);
create index habit_check_ins_goal_date_idx on public.habit_check_ins(organization_id, patient_id, habit_goal_id, recorded_on desc);
create index clinical_private_notes_patient_idx on public.clinical_private_notes(organization_id, patient_id, updated_at desc);

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
  'patient_administrative', 'patient_assignment', 'patient_clinical_profile',
  'nutrition_assessment', 'meal_plan', 'meal_plan_version', 'organization_member',
  'food_diary_entry', 'habit_goal', 'habit_check_in', 'clinical_private_note'
));

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
    select field_name from jsonb_object_keys(v_old || v_new) as fields(field_name)
    where v_old -> field_name is distinct from v_new -> field_name
  ) changed;
  v_changed := array(select value from unnest(v_changed) value where value not in (
    'full_name','birth_date','email','phone','goal','food_history','habits','professional_notes',
    'weight_kg','height_cm','waist_cm','hip_cm','arm_cm','body_fat_percentage','bmi','notes','meals',
    'foods','eating_context','hunger_before','satiety_after','routine_changes','title','description',
    'difficulties','next_step','content'
  ));
  insert into public.audit_events(organization_id, actor_user_id, entity_type, entity_id, operation, changed_fields)
  values (v_org, (select auth.uid()), v_entity, v_id, tg_op, v_changed);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function atrianutri_private.audit_sensitive_change() from public, anon, authenticated, service_role;

create trigger touch_food_diary_entry before update on public.food_diary_entries for each row execute function atrianutri_private.touch_updated_at();
create trigger touch_habit_goal before update on public.habit_goals for each row execute function atrianutri_private.touch_updated_at();
create trigger touch_habit_check_in before update on public.habit_check_ins for each row execute function atrianutri_private.touch_updated_at();
create trigger touch_clinical_private_note before update on public.clinical_private_notes for each row execute function atrianutri_private.touch_updated_at();
create trigger audit_food_diary_entry after insert or update or delete on public.food_diary_entries for each row execute function atrianutri_private.audit_sensitive_change('food_diary_entry');
create trigger audit_habit_goal after insert or update or delete on public.habit_goals for each row execute function atrianutri_private.audit_sensitive_change('habit_goal');
create trigger audit_habit_check_in after insert or update or delete on public.habit_check_ins for each row execute function atrianutri_private.audit_sensitive_change('habit_check_in');
create trigger audit_clinical_private_note after insert or update or delete on public.clinical_private_notes for each row execute function atrianutri_private.audit_sensitive_change('clinical_private_note');

alter table public.food_diary_entries enable row level security;
alter table public.habit_goals enable row level security;
alter table public.habit_check_ins enable row level security;
alter table public.clinical_private_notes enable row level security;

revoke all on public.food_diary_entries, public.habit_goals, public.habit_check_ins, public.clinical_private_notes from public, anon, authenticated;
grant select on public.food_diary_entries, public.habit_goals, public.habit_check_ins, public.clinical_private_notes to authenticated;

create policy food_diary_select_authorized on public.food_diary_entries for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (atrianutri_private.is_patient_self(organization_id, patient_id) and (author_user_id = (select auth.uid()) or shared_with_patient_at is not null))
);
create policy food_diary_insert_authorized on public.food_diary_entries for insert to authenticated with check (
  author_user_id = (select auth.uid()) and (
    (source = 'professional' and atrianutri_private.can_access_patient_clinical(organization_id, patient_id))
    or (source = 'patient' and atrianutri_private.is_patient_self(organization_id, patient_id))
  )
);
create policy food_diary_update_authorized on public.food_diary_entries for update to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (source = 'patient' and author_user_id = (select auth.uid()) and atrianutri_private.is_patient_self(organization_id, patient_id))
) with check (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (source = 'patient' and author_user_id = (select auth.uid()) and atrianutri_private.is_patient_self(organization_id, patient_id))
);

create policy habit_goals_select_authorized on public.habit_goals for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (shared_with_patient_at is not null and atrianutri_private.is_patient_self(organization_id, patient_id))
);
create policy habit_goals_insert_professional on public.habit_goals for insert to authenticated with check (
  created_by = (select auth.uid()) and atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
);
create policy habit_goals_update_professional on public.habit_goals for update to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
) with check (atrianutri_private.can_access_patient_clinical(organization_id, patient_id));

create policy habit_check_ins_select_authorized on public.habit_check_ins for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (atrianutri_private.is_patient_self(organization_id, patient_id) and (author_user_id = (select auth.uid()) or shared_with_patient_at is not null))
);
create policy habit_check_ins_insert_authorized on public.habit_check_ins for insert to authenticated with check (
  author_user_id = (select auth.uid()) and (
    (source = 'professional' and atrianutri_private.can_access_patient_clinical(organization_id, patient_id))
    or (source = 'patient' and atrianutri_private.is_patient_self(organization_id, patient_id))
  )
);
create policy habit_check_ins_update_authorized on public.habit_check_ins for update to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (source = 'patient' and author_user_id = (select auth.uid()) and atrianutri_private.is_patient_self(organization_id, patient_id))
) with check (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
  or (source = 'patient' and author_user_id = (select auth.uid()) and atrianutri_private.is_patient_self(organization_id, patient_id))
);

create policy clinical_private_notes_select_professional on public.clinical_private_notes for select to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
);
create policy clinical_private_notes_insert_professional on public.clinical_private_notes for insert to authenticated with check (
  author_user_id = (select auth.uid()) and atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
);
create policy clinical_private_notes_update_professional on public.clinical_private_notes for update to authenticated using (
  atrianutri_private.can_access_patient_clinical(organization_id, patient_id)
) with check (atrianutri_private.can_access_patient_clinical(organization_id, patient_id));

create or replace function public.save_food_diary_entry(
  p_organization_id uuid, p_patient_id uuid, p_entry_date date, p_meal_time time,
  p_meal_type public.food_diary_meal_type, p_foods jsonb, p_notes text, p_eating_context text,
  p_hunger_before text, p_satiety_after text, p_routine_changes text, p_shared_with_patient boolean,
  p_private_note text, p_submission_key uuid, p_entry_id uuid default null, p_expected_updated_at timestamptz default null
)
returns table (saved_id uuid, saved_updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid()); v_source public.clinical_record_source; v_responsible uuid;
  v_current timestamptz; v_saved_id uuid; v_saved_at timestamptz;
  v_existing_source public.clinical_record_source; v_existing_author uuid;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_entry_date > current_date or p_foods is null or jsonb_typeof(p_foods) <> 'array' or jsonb_array_length(p_foods) not between 1 and 50 then
    raise exception 'Invalid food diary entry' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_foods) item
    where jsonb_typeof(item) <> 'object'
      or char_length(trim(coalesce(item ->> 'name', ''))) not between 1 and 300
      or char_length(coalesce(item ->> 'quantity', '')) > 200
  ) then raise exception 'Invalid food diary item' using errcode = '22023'; end if;
  if octet_length(p_foods::text) > 30000 or char_length(coalesce(p_notes,'')) > 4000 or char_length(coalesce(p_eating_context,'')) > 2000
     or char_length(coalesce(p_hunger_before,'')) > 500 or char_length(coalesce(p_satiety_after,'')) > 500
     or char_length(coalesce(p_routine_changes,'')) > 4000 or char_length(coalesce(p_private_note,'')) > 4000 then
    raise exception 'Food diary content is too long' using errcode = '22023';
  end if;
  if atrianutri_private.can_access_patient_clinical(p_organization_id, p_patient_id) then
    v_source := 'professional'; v_responsible := v_actor;
  elsif atrianutri_private.is_patient_self(p_organization_id, p_patient_id) then
    v_source := 'patient';
    if nullif(trim(coalesce(p_private_note,'')), '') is not null then raise exception 'Patients cannot create private clinical notes' using errcode = '42501'; end if;
    select a.professional_user_id into v_responsible from public.patient_professional_assignments a
    join public.organization_members m on m.organization_id = a.organization_id and m.user_id = a.professional_user_id
    where a.organization_id = p_organization_id and a.patient_id = p_patient_id and a.active and m.active and m.clinical_access
    order by a.created_at limit 1;
    if v_responsible is null then raise exception 'Responsible professional required' using errcode = '42501'; end if;
  else raise exception 'Clinical access denied' using errcode = '42501'; end if;

  if p_entry_id is null then
    select e.id, e.updated_at into v_saved_id, v_saved_at from public.food_diary_entries e
    where e.organization_id = p_organization_id and e.patient_id = p_patient_id and e.author_user_id = v_actor and e.submission_key = p_submission_key;
    if v_saved_id is null then
      insert into public.food_diary_entries (organization_id, patient_id, entry_date, meal_time, meal_type, foods, notes, eating_context, hunger_before, satiety_after, routine_changes, source, author_user_id, responsible_professional_user_id, shared_with_patient_at, submission_key)
      values (p_organization_id, p_patient_id, p_entry_date, p_meal_time, p_meal_type, p_foods, coalesce(p_notes,''), coalesce(p_eating_context,''), coalesce(p_hunger_before,''), coalesce(p_satiety_after,''), coalesce(p_routine_changes,''), v_source, v_actor, v_responsible, case when v_source = 'professional' and p_shared_with_patient then now() else null end, p_submission_key)
      returning id, updated_at into v_saved_id, v_saved_at;
    end if;
  else
    select e.updated_at, e.source, e.author_user_id into v_current, v_existing_source, v_existing_author
    from public.food_diary_entries e
    where e.id = p_entry_id and e.organization_id = p_organization_id and e.patient_id = p_patient_id for update;
    if not found then raise exception 'Food diary entry not found' using errcode = 'P0002'; end if;
    if v_source = 'patient' and (v_existing_source <> 'patient' or v_existing_author <> v_actor) then
      raise exception 'Patients can only edit their own entries' using errcode = '42501';
    end if;
    if p_expected_updated_at is null or v_current <> p_expected_updated_at then raise exception 'Food diary entry conflict' using errcode = '40001'; end if;
    update public.food_diary_entries set entry_date=p_entry_date, meal_time=p_meal_time, meal_type=p_meal_type, foods=p_foods,
      notes=coalesce(p_notes,''), eating_context=coalesce(p_eating_context,''), hunger_before=coalesce(p_hunger_before,''), satiety_after=coalesce(p_satiety_after,''), routine_changes=coalesce(p_routine_changes,''),
      shared_with_patient_at=case when v_source='professional' and p_shared_with_patient then coalesce(shared_with_patient_at,now()) when v_source='professional' then null else shared_with_patient_at end
    where id=p_entry_id returning id, updated_at into v_saved_id, v_saved_at;
  end if;
  if v_source = 'professional' then
    if nullif(trim(coalesce(p_private_note,'')), '') is null then delete from public.clinical_private_notes where food_diary_entry_id=v_saved_id;
    else insert into public.clinical_private_notes(organization_id,patient_id,food_diary_entry_id,content,author_user_id)
      values(p_organization_id,p_patient_id,v_saved_id,trim(p_private_note),v_actor)
      on conflict (food_diary_entry_id) where food_diary_entry_id is not null do update set content=excluded.content,author_user_id=excluded.author_user_id;
    end if;
  end if;
  return query select v_saved_id, v_saved_at;
end;
$$;

create or replace function public.save_habit_goal(
  p_organization_id uuid, p_patient_id uuid, p_title text, p_description text, p_status public.habit_goal_status,
  p_shared_with_patient boolean, p_private_note text, p_submission_key uuid,
  p_goal_id uuid default null, p_expected_updated_at timestamptz default null
)
returns table (saved_id uuid, saved_updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_current timestamptz; v_saved_id uuid; v_saved_at timestamptz;
begin
  if v_actor is null or not atrianutri_private.can_access_patient_clinical(p_organization_id,p_patient_id) then raise exception 'Clinical access denied' using errcode='42501'; end if;
  if char_length(trim(p_title)) not between 3 and 200 or char_length(coalesce(p_description,'')) > 4000 or char_length(coalesce(p_private_note,'')) > 4000 then raise exception 'Invalid habit goal' using errcode='22023'; end if;
  if p_goal_id is null then
    select g.id,g.updated_at into v_saved_id,v_saved_at from public.habit_goals g where g.organization_id=p_organization_id and g.patient_id=p_patient_id and g.created_by=v_actor and g.submission_key=p_submission_key;
    if v_saved_id is null then insert into public.habit_goals(organization_id,patient_id,title,description,status,created_by,responsible_professional_user_id,shared_with_patient_at,submission_key)
      values(p_organization_id,p_patient_id,trim(p_title),coalesce(p_description,''),p_status,v_actor,v_actor,case when p_shared_with_patient then now() else null end,p_submission_key)
      returning id,updated_at into v_saved_id,v_saved_at; end if;
  else
    select g.updated_at into v_current from public.habit_goals g where g.id=p_goal_id and g.organization_id=p_organization_id and g.patient_id=p_patient_id for update;
    if not found then raise exception 'Habit goal not found' using errcode='P0002'; end if;
    if p_expected_updated_at is null or v_current <> p_expected_updated_at then raise exception 'Habit goal conflict' using errcode='40001'; end if;
    update public.habit_goals set title=trim(p_title),description=coalesce(p_description,''),status=p_status,
      shared_with_patient_at=case when p_shared_with_patient then coalesce(shared_with_patient_at,now()) else null end
    where id=p_goal_id returning id,updated_at into v_saved_id,v_saved_at;
  end if;
  if nullif(trim(coalesce(p_private_note,'')), '') is null then delete from public.clinical_private_notes where habit_goal_id=v_saved_id;
  else insert into public.clinical_private_notes(organization_id,patient_id,habit_goal_id,content,author_user_id)
    values(p_organization_id,p_patient_id,v_saved_id,trim(p_private_note),v_actor)
    on conflict (habit_goal_id) where habit_goal_id is not null do update set content=excluded.content,author_user_id=excluded.author_user_id;
  end if;
  return query select v_saved_id,v_saved_at;
end;
$$;

create or replace function public.save_habit_check_in(
  p_organization_id uuid, p_patient_id uuid, p_habit_goal_id uuid, p_recorded_on date, p_progress public.habit_progress,
  p_notes text, p_difficulties text, p_next_step text, p_shared_with_patient boolean, p_private_note text, p_submission_key uuid,
  p_check_in_id uuid default null, p_expected_updated_at timestamptz default null
)
returns table (saved_id uuid, saved_updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_source public.clinical_record_source; v_current timestamptz; v_saved_id uuid; v_saved_at timestamptz;
  v_existing_source public.clinical_record_source; v_existing_author uuid;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_recorded_on > current_date or char_length(coalesce(p_notes,'')) > 4000 or char_length(coalesce(p_difficulties,'')) > 4000 or char_length(coalesce(p_next_step,'')) > 2000 or char_length(coalesce(p_private_note,'')) > 4000 then raise exception 'Invalid habit check-in' using errcode='22023'; end if;
  if not exists(select 1 from public.habit_goals g where g.id=p_habit_goal_id and g.organization_id=p_organization_id and g.patient_id=p_patient_id) then raise exception 'Habit goal not found' using errcode='P0002'; end if;
  if atrianutri_private.can_access_patient_clinical(p_organization_id,p_patient_id) then v_source:='professional';
  elsif atrianutri_private.is_patient_self(p_organization_id,p_patient_id) then v_source:='patient'; if nullif(trim(coalesce(p_private_note,'')),'') is not null then raise exception 'Patients cannot create private clinical notes' using errcode='42501'; end if;
  else raise exception 'Clinical access denied' using errcode='42501'; end if;
  if v_source='patient' and not exists(
    select 1 from public.habit_goals g
    where g.id=p_habit_goal_id and g.organization_id=p_organization_id and g.patient_id=p_patient_id and g.shared_with_patient_at is not null
  ) then raise exception 'Habit goal is not shared with the patient' using errcode='42501'; end if;
  if p_check_in_id is null then
    select c.id,c.updated_at into v_saved_id,v_saved_at from public.habit_check_ins c where c.organization_id=p_organization_id and c.patient_id=p_patient_id and c.author_user_id=v_actor and c.submission_key=p_submission_key;
    if v_saved_id is null then insert into public.habit_check_ins(organization_id,patient_id,habit_goal_id,recorded_on,progress,notes,difficulties,next_step,source,author_user_id,shared_with_patient_at,submission_key)
      values(p_organization_id,p_patient_id,p_habit_goal_id,p_recorded_on,p_progress,coalesce(p_notes,''),coalesce(p_difficulties,''),coalesce(p_next_step,''),v_source,v_actor,case when v_source='professional' and p_shared_with_patient then now() else null end,p_submission_key)
      returning id,updated_at into v_saved_id,v_saved_at; end if;
  else
    select c.updated_at,c.source,c.author_user_id into v_current,v_existing_source,v_existing_author
    from public.habit_check_ins c
    where c.id=p_check_in_id and c.organization_id=p_organization_id and c.patient_id=p_patient_id and c.habit_goal_id=p_habit_goal_id for update;
    if not found then raise exception 'Habit check-in not found' using errcode='P0002'; end if;
    if v_source='patient' and (v_existing_source <> 'patient' or v_existing_author <> v_actor) then
      raise exception 'Patients can only edit their own check-ins' using errcode='42501';
    end if;
    if p_expected_updated_at is null or v_current <> p_expected_updated_at then raise exception 'Habit check-in conflict' using errcode='40001'; end if;
    update public.habit_check_ins set recorded_on=p_recorded_on,progress=p_progress,notes=coalesce(p_notes,''),difficulties=coalesce(p_difficulties,''),next_step=coalesce(p_next_step,''),
      shared_with_patient_at=case when v_source='professional' and p_shared_with_patient then coalesce(shared_with_patient_at,now()) when v_source='professional' then null else shared_with_patient_at end
    where id=p_check_in_id returning id,updated_at into v_saved_id,v_saved_at;
  end if;
  if v_source='professional' then
    if nullif(trim(coalesce(p_private_note,'')),'') is null then delete from public.clinical_private_notes where habit_check_in_id=v_saved_id;
    else insert into public.clinical_private_notes(organization_id,patient_id,habit_check_in_id,content,author_user_id)
      values(p_organization_id,p_patient_id,v_saved_id,trim(p_private_note),v_actor)
      on conflict (habit_check_in_id) where habit_check_in_id is not null do update set content=excluded.content,author_user_id=excluded.author_user_id;
    end if;
  end if;
  return query select v_saved_id,v_saved_at;
end;
$$;

revoke all on function public.save_food_diary_entry(uuid,uuid,date,time,public.food_diary_meal_type,jsonb,text,text,text,text,text,boolean,text,uuid,uuid,timestamptz) from public,anon,service_role;
revoke all on function public.save_habit_goal(uuid,uuid,text,text,public.habit_goal_status,boolean,text,uuid,uuid,timestamptz) from public,anon,service_role;
revoke all on function public.save_habit_check_in(uuid,uuid,uuid,date,public.habit_progress,text,text,text,boolean,text,uuid,uuid,timestamptz) from public,anon,service_role;
grant execute on function public.save_food_diary_entry(uuid,uuid,date,time,public.food_diary_meal_type,jsonb,text,text,text,text,text,boolean,text,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.save_habit_goal(uuid,uuid,text,text,public.habit_goal_status,boolean,text,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.save_habit_check_in(uuid,uuid,uuid,date,public.habit_progress,text,text,text,boolean,text,uuid,uuid,timestamptz) to authenticated;

commit;
