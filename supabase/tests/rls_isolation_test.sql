-- Run only in a disposable local Supabase instance:
--   supabase test db
-- All fixtures are fictitious and the transaction always rolls back.
-- Never point this suite at AtriaClinic or any production project.

begin;
select no_plan();

-- Stable fictitious identities for two isolated organizations.
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'owner-a@demo.local'),
  ('10000000-0000-4000-8000-000000000002', 'nutritionist-a@demo.local'),
  ('10000000-0000-4000-8000-000000000003', 'reception-a@demo.local'),
  ('10000000-0000-4000-8000-000000000004', 'patient-a@demo.local'),
  ('20000000-0000-4000-8000-000000000001', 'owner-b@demo.local'),
  ('20000000-0000-4000-8000-000000000002', 'nutritionist-b@demo.local'),
  ('20000000-0000-4000-8000-000000000003', 'patient-b@demo.local');

insert into public.profiles (id, full_name) values
  ('10000000-0000-4000-8000-000000000001', 'Proprietário A'),
  ('10000000-0000-4000-8000-000000000002', 'Nutricionista A'),
  ('10000000-0000-4000-8000-000000000003', 'Recepção A'),
  ('10000000-0000-4000-8000-000000000004', 'Paciente A'),
  ('20000000-0000-4000-8000-000000000001', 'Proprietário B'),
  ('20000000-0000-4000-8000-000000000002', 'Nutricionista B'),
  ('20000000-0000-4000-8000-000000000003', 'Paciente B');

insert into public.organizations (id, name, created_by) values
  ('a0000000-0000-4000-8000-000000000001', 'Organização A', '10000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000001', 'Organização B', '20000000-0000-4000-8000-000000000001');

insert into public.organization_members (organization_id, user_id, role, clinical_access, created_by) values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', true, '10000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'nutritionist', true, '10000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'reception', false, '10000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'owner', true, '20000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'nutritionist', true, '20000000-0000-4000-8000-000000000001');

insert into public.patients_administrative (
  id, organization_id, auth_user_id, full_name, birth_date, email, phone, created_by
) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'Paciente A Vinculado', '1990-01-01', 'patient-a@demo.local', '71999990001', '10000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', null, 'Paciente A Sem Vínculo', '1991-01-01', 'unassigned-a@demo.local', '71999990002', '10000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'Paciente B Vinculado', '1992-01-01', 'patient-b@demo.local', '11999990001', '20000000-0000-4000-8000-000000000001');

insert into public.patient_professional_assignments (
  organization_id, patient_id, professional_user_id, assigned_by
) values
  ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001');

insert into public.patient_clinical_profiles (
  patient_id, organization_id, goal, professional_notes, created_by
) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Objetivo A', 'Nota A', '10000000-0000-4000-8000-000000000002'),
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Objetivo sem vínculo', 'Nota restrita', '10000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Objetivo B', 'Nota B', '20000000-0000-4000-8000-000000000002');

insert into public.nutrition_assessments (
  id, organization_id, patient_id, assessed_at, weight_kg, height_cm,
  notes, shared_with_patient_at, created_by
) values
  ('aa100000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-11-08', 70, 170, 'Avaliação A', now(), '10000000-0000-4000-8000-000000000002'),
  ('bb100000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', '2026-11-08', 80, 180, 'Avaliação B', null, '20000000-0000-4000-8000-000000000002');

insert into public.meal_plans (
  id, organization_id, patient_id, title, status, current_version,
  activated_at, created_by, updated_by
) values
  ('aa000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Plano A', 'active', 1, now(), '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002'),
  ('bb000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Plano B', 'draft', 0, null, '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002');

insert into public.meal_plan_versions (
  id, organization_id, meal_plan_id, patient_id, version, meals, change_summary, created_by
) values (
  'aa010000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  'aa000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  1, '[]'::jsonb, 'Versão válida', '10000000-0000-4000-8000-000000000002'
);

-- Referential integrity: patient, organization and plan must be the same tuple.
select ok(
  exists(select 1 from public.meal_plan_versions where id = 'aa010000-0000-4000-8000-000000000001'),
  'a matching plan/patient/organization version is accepted'
);
select throws_ok(
  $$insert into public.meal_plan_versions (organization_id, meal_plan_id, patient_id, version, created_by)
    values ('a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000001', 2, '10000000-0000-4000-8000-000000000002')$$,
  '23503', null, 'a version cannot point at another patient in the same organization'
);
select throws_ok(
  $$insert into public.meal_plan_versions (organization_id, meal_plan_id, patient_id, version, created_by)
    values ('b0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001', 2, '20000000-0000-4000-8000-000000000002')$$,
  '23503', null, 'a version cannot cross organization boundaries'
);
select throws_ok(
  $$insert into public.patient_professional_assignments
      (organization_id, patient_id, professional_user_id, assigned_by)
    values ('a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001')$$,
  '23503', null, 'a professional assignment requires membership in the same organization'
);

-- Baseline grants and immutable columns.
select ok(not has_table_privilege('anon', 'public.patients_administrative', 'select'), 'anon cannot read patient administration');
select ok(not has_table_privilege('anon', 'public.patient_clinical_profiles', 'select'), 'anon cannot read clinical profiles');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'insert,update,delete'), 'clients cannot mutate audit events');
select ok(not has_table_privilege('authenticated', 'public.meal_plan_versions', 'insert,update,delete'), 'clients cannot write immutable plan versions directly');
select ok(not has_table_privilege('authenticated', 'public.patients_administrative', 'insert'), 'patient creation is restricted to the audited RPC');
select ok(not has_column_privilege('authenticated', 'public.meal_plans', 'patient_id', 'update'), 'clients cannot change a plan patient');
select ok(not has_column_privilege('authenticated', 'public.meal_plans', 'organization_id', 'update'), 'clients cannot change a plan organization');
select ok(not has_column_privilege('authenticated', 'public.nutrition_assessments', 'patient_id', 'update'), 'clients cannot move an assessment to another patient');

-- Nutritionist A: only the assigned patient in organization A is visible.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select results_eq(
  $$select id from public.organizations order by id$$,
  array['a0000000-0000-4000-8000-000000000001'::uuid],
  'nutritionist A sees only organization A'
);
select results_eq(
  $$select id from public.patients_administrative order by id$$,
  array['a1000000-0000-4000-8000-000000000001'::uuid],
  'nutritionist A sees only the assigned patient'
);
select results_eq(
  $$select patient_id from public.patient_clinical_profiles order by patient_id$$,
  array['a1000000-0000-4000-8000-000000000001'::uuid],
  'nutritionist A cannot read unassigned or organization B clinical profiles'
);
select results_eq(
  $$update public.patients_administrative set phone = '00000000000'
    where id = 'b1000000-0000-4000-8000-000000000001' returning id$$,
  array[]::uuid[],
  'nutritionist A cannot alter organization B patient administration'
);
select results_eq(
  $$update public.nutrition_assessments set notes = 'Tentativa indevida'
    where id = 'bb100000-0000-4000-8000-000000000001' returning id$$,
  array[]::uuid[],
  'nutritionist A cannot alter organization B assessment'
);
select throws_ok(
  $$insert into public.meal_plan_versions (organization_id, meal_plan_id, patient_id, version, created_by)
    values ('a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000001', 2, '10000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'nutritionists cannot bypass the transactional version RPC'
);
select throws_ok(
  $$update public.meal_plans set patient_id = 'a2000000-0000-4000-8000-000000000001'
    where id = 'aa000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'nutritionists cannot change immutable plan ownership columns'
);

-- Reception A: administrative access only, never clinical.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select results_eq(
  $$select id from public.patients_administrative order by id$$,
  array[
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'a2000000-0000-4000-8000-000000000001'::uuid
  ],
  'reception A sees organization A administrative patients'
);
select is_empty($$select * from public.patient_clinical_profiles$$, 'reception cannot read clinical profiles');
select is_empty($$select * from public.nutrition_assessments$$, 'reception cannot read assessments');
select is_empty($$select * from public.meal_plans$$, 'reception cannot read meal plans');
select is_empty($$select * from public.meal_plan_versions$$, 'reception cannot read plan versions');
select results_eq(
  $$update public.patients_administrative set phone = '71999990009'
    where id = 'a1000000-0000-4000-8000-000000000001' returning id$$,
  array['a1000000-0000-4000-8000-000000000001'::uuid],
  'reception can update permitted administrative fields'
);
select is_empty(
  $$update public.organization_members set role = 'owner', clinical_access = true
    where user_id = '10000000-0000-4000-8000-000000000003' returning user_id$$,
  'reception cannot promote itself or grant itself clinical access'
);
select lives_ok(
  $$select (public.create_patient_administrative(
    'a0000000-0000-4000-8000-000000000001', 'Paciente criado pela recepção',
    '1993-01-01', 'reception-created@demo.local', '71999990010'
  )).id$$,
  'reception creates an administrative patient only through the server RPC'
);
select results_eq(
  $$select count(*) from public.patients_administrative$$,
  array[3::bigint],
  'reception sees the server-confirmed administrative patient'
);

-- Patient A: only own administrative row and explicitly shared clinical outputs.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select results_eq(
  $$select id from public.patients_administrative order by id$$,
  array['a1000000-0000-4000-8000-000000000001'::uuid],
  'patient A sees only their own administrative record'
);
select is_empty($$select * from public.patient_clinical_profiles$$, 'patient cannot read professional clinical notes');
select results_eq(
  $$select id from public.nutrition_assessments order by id$$,
  array['aa100000-0000-4000-8000-000000000001'::uuid],
  'patient sees only an assessment explicitly shared with them'
);
select results_eq(
  $$select id from public.meal_plans order by id$$,
  array['aa000000-0000-4000-8000-000000000001'::uuid],
  'patient sees only their active meal plan'
);
select results_eq(
  $$select id from public.meal_plan_versions order by id$$,
  array['aa010000-0000-4000-8000-000000000001'::uuid],
  'patient sees only the current active meal plan version'
);
select results_eq(
  $$select id from public.profiles where id <> '10000000-0000-4000-8000-000000000004'$$,
  array[]::uuid[],
  'patient cannot read another user profile'
);
select throws_ok(
  $$insert into public.audit_events (organization_id, entity_type, entity_id, operation)
    values ('a0000000-0000-4000-8000-000000000001', 'meal_plan', 'x', 'UPDATE')$$,
  '42501', null, 'ordinary users cannot forge audit events'
);
select throws_ok(
  $$update public.meal_plan_versions set change_summary = 'Alterado'$$,
  '42501', null, 'previous plan versions are immutable'
);

-- Only an owner can manage another non-owner member; owner records and self-updates stay blocked.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is_empty(
  $$update public.organization_members set role = 'admin'
    where user_id = '10000000-0000-4000-8000-000000000001' returning user_id$$,
  'an owner cannot mutate their own owner membership through the client policy'
);
select results_eq(
  $$update public.organization_members set active = false
    where user_id = '10000000-0000-4000-8000-000000000002' returning user_id$$,
  array['10000000-0000-4000-8000-000000000002'::uuid],
  'owner can deactivate another professional'
);

-- Deactivated nutritionist loses both administrative and clinical access immediately.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is_empty($$select * from public.patients_administrative$$, 'inactive professional cannot read patient administration');
select is_empty($$select * from public.patient_clinical_profiles$$, 'inactive professional cannot read clinical profiles');
select is_empty($$select * from public.nutrition_assessments$$, 'inactive professional cannot read assessments');
select is_empty($$select * from public.meal_plans$$, 'inactive professional cannot read meal plans');

-- Restore only inside the transaction to exercise the version RPC.
reset role;
update public.organization_members
set active = true
where organization_id = 'a0000000-0000-4000-8000-000000000001'
  and user_id = '10000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select results_eq(
  $$select saved_version from public.save_meal_plan_version(
    'aa000000-0000-4000-8000-000000000001', 1,
    'Plano A revisado', '[{"name":"Refeição revisada"}]'::jsonb, 'Revisão autorizada')$$,
  array[2],
  'authorized nutritionist saves the next version transactionally'
);
select throws_ok(
  $$select * from public.save_meal_plan_version(
    'aa000000-0000-4000-8000-000000000001', 1, 'Plano A', '[]'::jsonb, 'Versão obsoleta')$$,
  '40001', null, 'stale expected version is rejected as a conflict'
);
select throws_ok(
  $$select * from public.save_meal_plan_version(
    'bb000000-0000-4000-8000-000000000001', 0, 'Plano B', '[]'::jsonb, 'Acesso cruzado')$$,
  '42501', null, 'nutritionist A cannot version an organization B plan'
);
select results_eq(
  $$select current_version from public.meal_plans
    where id = 'aa000000-0000-4000-8000-000000000001'$$,
  array[2],
  'transactional save confirms the server-side current version'
);

select * from finish();
rollback;
