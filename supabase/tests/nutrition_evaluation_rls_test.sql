begin;
select no_plan();
-- All fixtures are fictitious and rolled back.
insert into auth.users(id,email) values
('61000000-0000-4000-8000-000000000001','nutri-eval-a@demo.local'),('61000000-0000-4000-8000-000000000002','unassigned-eval-a@demo.local'),('61000000-0000-4000-8000-000000000003','reception-eval-a@demo.local'),('62000000-0000-4000-8000-000000000001','nutri-eval-b@demo.local');
insert into public.profiles(id,full_name) values
('61000000-0000-4000-8000-000000000001','Nutri Avaliação A'),('61000000-0000-4000-8000-000000000002','Nutri Sem Vínculo'),('61000000-0000-4000-8000-000000000003','Recepção Avaliação'),('62000000-0000-4000-8000-000000000001','Nutri Avaliação B');
insert into public.organizations(id,name,created_by) values('6a000000-0000-4000-8000-000000000001','Organização Avaliação A','61000000-0000-4000-8000-000000000001'),('6b000000-0000-4000-8000-000000000001','Organização Avaliação B','62000000-0000-4000-8000-000000000001');
insert into public.organization_members(organization_id,user_id,role,clinical_access,created_by) values
('6a000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','nutritionist',true,'61000000-0000-4000-8000-000000000001'),
('6a000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002','nutritionist',true,'61000000-0000-4000-8000-000000000001'),
('6a000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000003','reception',false,'61000000-0000-4000-8000-000000000001'),
('6b000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','nutritionist',true,'62000000-0000-4000-8000-000000000001');
insert into public.patients_administrative(id,organization_id,full_name,birth_date,email,phone,created_by) values
('6a100000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000001','Paciente Avaliação A','1990-01-01','eval-a@demo.local','11000000001','61000000-0000-4000-8000-000000000001'),
('6b100000-0000-4000-8000-000000000001','6b000000-0000-4000-8000-000000000001','Paciente Avaliação B','1991-01-01','eval-b@demo.local','11000000002','62000000-0000-4000-8000-000000000001');
insert into public.patient_professional_assignments(organization_id,patient_id,professional_user_id,assigned_by) values
('6a000000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001'),
('6b000000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001');
insert into public.nutrition_evaluations(id,organization_id,patient_id,evaluated_on,consultation_reason,created_by,responsible_professional_user_id,submission_key) values
('6e100000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001',current_date,'Motivo fictício A','61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','6e110000-0000-4000-8000-000000000001'),
('6e200000-0000-4000-8000-000000000001','6b000000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001',current_date,'Motivo fictício B','62000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','6e210000-0000-4000-8000-000000000001');
insert into public.dietary_recalls_24h(id,organization_id,patient_id,nutrition_evaluation_id,recall_date,meals,created_by,submission_key) values
('6d100000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001',current_date,'[{"name":"Almoço","time":"12:00","foods":[{"name":"Preparação fictícia"}]}]','61000000-0000-4000-8000-000000000001','6d110000-0000-4000-8000-000000000001');

select ok(not has_table_privilege('anon','public.nutrition_evaluations','select'),'anon cannot read evaluations');
select ok(not has_table_privilege('authenticated','public.nutrition_evaluations','insert,update,delete'),'authenticated cannot write evaluations directly');
select ok(not has_table_privilege('authenticated','public.dietary_recalls_24h','insert,update,delete'),'authenticated cannot write recalls directly');
select throws_ok($$insert into public.dietary_recalls_24h(organization_id,patient_id,nutrition_evaluation_id,recall_date,meals,created_by,submission_key) values('6b000000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001',current_date,'[{"name":"Teste","time":"12:00","foods":[{"name":"Item"}]}]','62000000-0000-4000-8000-000000000001',gen_random_uuid())$$,'23503',null,'recall cannot cross organization and patient tuple');

set local role authenticated;select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
select results_eq($$select id from public.nutrition_evaluations order by id$$,array['6e100000-0000-4000-8000-000000000001'::uuid],'assigned nutritionist sees only evaluation A');
select results_eq($$select id from public.dietary_recalls_24h$$,array['6d100000-0000-4000-8000-000000000001'::uuid],'assigned nutritionist sees recall A');
select lives_ok($$select * from public.save_nutrition_evaluation('6a000000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001',current_date,'Nova avaliação','','','','','','','','','','','','','6e110000-0000-4000-8000-000000000009')$$,'authorized nutritionist creates evaluation by RPC');
select lives_ok($$select * from public.save_dietary_recall_24h('6a000000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001',current_date,'[{"name":"Jantar","time":"19:00","foods":[{"name":"Sopa","quantity":"1 prato"}],"context":"Casa","notes":""}]','','6d110000-0000-4000-8000-000000000009')$$,'authorized nutritionist creates recall by RPC');
select throws_ok($$select * from public.save_nutrition_evaluation('6a000000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001',current_date,'Edição obsoleta','','','','','','','','','','','','','6e110000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001','2000-01-01T00:00:00Z')$$,'40001',null,'stale evaluation update is rejected');
select throws_ok($$select * from public.save_dietary_recall_24h('6a000000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001',current_date,'[{"name":"Jantar","time":"19:00","foods":[{"name":"Sopa"}]}]','','6d110000-0000-4000-8000-000000000001','6d100000-0000-4000-8000-000000000001','2000-01-01T00:00:00Z')$$,'40001',null,'stale recall update is rejected');
select throws_ok($$select * from public.save_nutrition_evaluation('6b000000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001',current_date,'Cruzada','','','','','','','','','','','','','6e210000-0000-4000-8000-000000000009')$$,'42501',null,'nutritionist A cannot write organization B');

reset role;set local role authenticated;select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002',true);
select is_empty($$select * from public.nutrition_evaluations$$,'unassigned professional cannot read evaluations');
select is_empty($$select * from public.dietary_recalls_24h$$,'unassigned professional cannot read recalls');
reset role;set local role authenticated;select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000003',true);
select is_empty($$select * from public.nutrition_evaluations$$,'reception cannot read evaluations');
select is_empty($$select * from public.dietary_recalls_24h$$,'reception cannot read recalls');
reset role;
select ok(not exists(select 1 from public.audit_events a,unnest(a.changed_fields) f where a.entity_type in('nutrition_evaluation','dietary_recall_24h') and f=any(array['consultation_reason','health_history','reported_allergies','reported_medications','meals','professional_observations'])),'audit excludes clinical content fields');
select * from finish();rollback;
