-- Disposable pgTAP coverage for Etapa 05. All identities and clinical data are fictitious.
begin;
select no_plan();

insert into auth.users (id, email) values
  ('31000000-0000-4000-8000-000000000001', 'nutri-a-diary@demo.local'),
  ('31000000-0000-4000-8000-000000000002', 'reception-a-diary@demo.local'),
  ('31000000-0000-4000-8000-000000000003', 'patient-a-diary@demo.local'),
  ('31000000-0000-4000-8000-000000000004', 'unassigned-a-diary@demo.local'),
  ('32000000-0000-4000-8000-000000000001', 'nutri-b-diary@demo.local'),
  ('32000000-0000-4000-8000-000000000002', 'patient-b-diary@demo.local');
insert into public.profiles (id, full_name) values
  ('31000000-0000-4000-8000-000000000001', 'Nutricionista A Diário'),
  ('31000000-0000-4000-8000-000000000002', 'Recepção A Diário'),
  ('31000000-0000-4000-8000-000000000003', 'Paciente A Diário'),
  ('31000000-0000-4000-8000-000000000004', 'Nutricionista A Sem Vínculo'),
  ('32000000-0000-4000-8000-000000000001', 'Nutricionista B Diário'),
  ('32000000-0000-4000-8000-000000000002', 'Paciente B Diário');
insert into public.organizations (id, name, created_by) values
  ('3a000000-0000-4000-8000-000000000001', 'Organização Diário A', '31000000-0000-4000-8000-000000000001'),
  ('3b000000-0000-4000-8000-000000000001', 'Organização Diário B', '32000000-0000-4000-8000-000000000001');
insert into public.organization_members (organization_id, user_id, role, clinical_access, created_by) values
  ('3a000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'nutritionist', true, '31000000-0000-4000-8000-000000000001'),
  ('3a000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', 'reception', false, '31000000-0000-4000-8000-000000000001'),
  ('3a000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000004', 'nutritionist', true, '31000000-0000-4000-8000-000000000001'),
  ('3b000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', 'nutritionist', true, '32000000-0000-4000-8000-000000000001');
insert into public.patients_administrative (id, organization_id, auth_user_id, full_name, birth_date, email, phone, created_by) values
  ('3a100000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000003', 'Paciente Fictício A', '1990-01-01', 'patient-a-diary@demo.local', '11000000001', '31000000-0000-4000-8000-000000000001'),
  ('3b100000-0000-4000-8000-000000000001', '3b000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000002', 'Paciente Fictício B', '1991-01-01', 'patient-b-diary@demo.local', '11000000002', '32000000-0000-4000-8000-000000000001');
insert into public.patient_professional_assignments (organization_id, patient_id, professional_user_id, assigned_by) values
  ('3a000000-0000-4000-8000-000000000001', '3a100000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001'),
  ('3b000000-0000-4000-8000-000000000001', '3b100000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001');

insert into public.food_diary_entries (id,organization_id,patient_id,entry_date,meal_time,meal_type,foods,source,author_user_id,responsible_professional_user_id,shared_with_patient_at,submission_key) values
  ('3d100000-0000-4000-8000-000000000001','3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001',current_date,'08:00','breakfast','[{"name":"Refeição compartilhada fictícia"}]','professional','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',now(),'3d110000-0000-4000-8000-000000000001'),
  ('3d100000-0000-4000-8000-000000000002','3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001',current_date,'12:00','lunch','[{"name":"Refeição privada profissional"}]','professional','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',null,'3d110000-0000-4000-8000-000000000002'),
  ('3d100000-0000-4000-8000-000000000003','3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001',current_date,'16:00','afternoon_snack','[{"name":"Refeição informada pelo paciente"}]','patient','31000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000001',null,'3d110000-0000-4000-8000-000000000003'),
  ('3d200000-0000-4000-8000-000000000001','3b000000-0000-4000-8000-000000000001','3b100000-0000-4000-8000-000000000001',current_date,'09:00','breakfast','[{"name":"Refeição organização B"}]','professional','32000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001',now(),'3d210000-0000-4000-8000-000000000001');
insert into public.habit_goals (id,organization_id,patient_id,title,description,status,created_by,responsible_professional_user_id,shared_with_patient_at,submission_key) values
  ('3e100000-0000-4000-8000-000000000001','3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001','Meta compartilhada fictícia','Contexto individualizado','active','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',now(),'3e110000-0000-4000-8000-000000000001'),
  ('3e100000-0000-4000-8000-000000000002','3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001','Meta não compartilhada','Contexto privado','active','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',null,'3e110000-0000-4000-8000-000000000002'),
  ('3e200000-0000-4000-8000-000000000001','3b000000-0000-4000-8000-000000000001','3b100000-0000-4000-8000-000000000001','Meta organização B','Contexto B','active','32000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001',now(),'3e210000-0000-4000-8000-000000000001');
insert into public.habit_check_ins (id,organization_id,patient_id,habit_goal_id,recorded_on,progress,notes,source,author_user_id,shared_with_patient_at,submission_key) values
  ('3f100000-0000-4000-8000-000000000001','3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001','3e100000-0000-4000-8000-000000000001',current_date,'progressing','Acompanhamento compartilhado','professional','31000000-0000-4000-8000-000000000001',now(),'3f110000-0000-4000-8000-000000000001'),
  ('3f100000-0000-4000-8000-000000000002','3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001','3e100000-0000-4000-8000-000000000001',current_date,'difficulty','Relato do paciente','patient','31000000-0000-4000-8000-000000000003',null,'3f110000-0000-4000-8000-000000000002'),
  ('3f200000-0000-4000-8000-000000000001','3b000000-0000-4000-8000-000000000001','3b100000-0000-4000-8000-000000000001','3e200000-0000-4000-8000-000000000001',current_date,'maintaining','Acompanhamento B','professional','32000000-0000-4000-8000-000000000001',now(),'3f210000-0000-4000-8000-000000000001');
insert into public.clinical_private_notes (organization_id,patient_id,food_diary_entry_id,content,author_user_id) values
  ('3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001','3d100000-0000-4000-8000-000000000001','Conteúdo clínico privado fictício','31000000-0000-4000-8000-000000000001'),
  ('3b000000-0000-4000-8000-000000000001','3b100000-0000-4000-8000-000000000001','3d200000-0000-4000-8000-000000000001','Conteúdo privado organização B','32000000-0000-4000-8000-000000000001');

select ok(not has_table_privilege('anon','public.food_diary_entries','select'), 'anon cannot read food diary');
select ok(not has_table_privilege('authenticated','public.food_diary_entries','insert,update,delete'), 'authenticated cannot write diary tables directly');
select ok(not has_table_privilege('authenticated','public.habit_goals','insert,update,delete'), 'authenticated cannot write habit goals directly');
select ok(not has_table_privilege('authenticated','public.clinical_private_notes','insert,update,delete'), 'authenticated cannot write private notes directly');
select throws_ok(
  $$insert into public.clinical_private_notes(organization_id,patient_id,habit_goal_id,content,author_user_id) values('3b000000-0000-4000-8000-000000000001','3b100000-0000-4000-8000-000000000001','3e100000-0000-4000-8000-000000000001','Tentativa cruzada','32000000-0000-4000-8000-000000000001')$$,
  '23503', null, 'private note parent cannot cross patient or organization tuple');
select ok(not exists(
  select 1 from public.audit_events a, unnest(a.changed_fields) f
  where a.entity_type in ('food_diary_entry','habit_goal','habit_check_in','clinical_private_note')
    and f = any(array['foods','notes','eating_context','hunger_before','satiety_after','routine_changes','title','description','difficulties','next_step','content'])
), 'audit metadata excludes diary, habit and private-note content fields');

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
select results_eq($$select id from public.food_diary_entries order by id$$, array['3d100000-0000-4000-8000-000000000001'::uuid,'3d100000-0000-4000-8000-000000000002'::uuid,'3d100000-0000-4000-8000-000000000003'::uuid], 'assigned nutritionist sees only patient A diary');
select results_eq($$select count(*) from public.clinical_private_notes$$, array[1::bigint], 'assigned nutritionist sees only patient A private notes');
select lives_ok($$select * from public.save_habit_goal('3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001','Nova meta fictícia','Contexto', 'active',true,'Nota privada','3e110000-0000-4000-8000-000000000009')$$, 'authorized nutritionist creates a goal through RPC');
select throws_ok($$select * from public.save_habit_goal('3b000000-0000-4000-8000-000000000001','3b100000-0000-4000-8000-000000000001','Meta cruzada','Contexto','active',false,'','3e210000-0000-4000-8000-000000000009')$$, '42501', null, 'nutritionist cannot create a goal in organization B');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
select is_empty($$select * from public.food_diary_entries$$, 'same-organization professional without assignment cannot read diary');
select is_empty($$select * from public.habit_goals$$, 'same-organization professional without assignment cannot read habits');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
select is_empty($$select * from public.food_diary_entries$$, 'reception cannot read diary');
select is_empty($$select * from public.habit_goals$$, 'reception cannot read habit goals');
select is_empty($$select * from public.clinical_private_notes$$, 'reception cannot read private notes');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
select results_eq($$select id from public.food_diary_entries order by id$$, array['3d100000-0000-4000-8000-000000000001'::uuid,'3d100000-0000-4000-8000-000000000003'::uuid], 'patient sees own and explicitly shared diary entries only');
select results_eq($$select title from public.habit_goals order by title$$, array['Meta compartilhada fictícia'::text,'Nova meta fictícia'::text], 'patient sees explicitly shared habit goals only');
select results_eq($$select id from public.habit_check_ins order by id$$, array['3f100000-0000-4000-8000-000000000001'::uuid,'3f100000-0000-4000-8000-000000000002'::uuid], 'patient sees own and explicitly shared check-ins only');
select is_empty($$select * from public.clinical_private_notes$$, 'patient never reads private clinical notes');
select throws_ok($$select * from public.save_habit_check_in('3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001','3e100000-0000-4000-8000-000000000002',current_date,'not_observed','','','',false,'','3f110000-0000-4000-8000-000000000009')$$, '42501', null, 'patient cannot attach a check-in to an unshared goal');
select lives_ok($$select * from public.save_food_diary_entry('3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001',current_date,'18:00','dinner','[{"name":"Jantar fictício"}]','','','','','',false,'','3d110000-0000-4000-8000-000000000009')$$, 'patient creates own diary entry through RPC');
select results_eq($$select count(*) from public.save_food_diary_entry('3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001',current_date,'18:00','dinner','[{"name":"Jantar fictício"}]','','','','','',false,'','3d110000-0000-4000-8000-000000000009')$$, array[1::bigint], 'repeated submission key returns the same server confirmation');
select results_eq($$select count(*) from public.food_diary_entries$$, array[3::bigint], 'idempotent retry creates only one additional visible entry');
select throws_ok(format($sql$select * from public.save_food_diary_entry('3a000000-0000-4000-8000-000000000001','3a100000-0000-4000-8000-000000000001',current_date,'08:00','breakfast','[{"name":"Tentativa indevida"}]','','','','','',false,'','3d110000-0000-4000-8000-000000000001','3d100000-0000-4000-8000-000000000001',%L)$sql$, (select updated_at from public.food_diary_entries where id='3d100000-0000-4000-8000-000000000001')), '42501', null, 'patient cannot edit a professional diary entry');

select * from finish();
rollback;
