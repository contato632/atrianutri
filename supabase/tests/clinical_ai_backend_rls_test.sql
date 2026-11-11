-- Etapa 19. Execute somente no Supabase local descartável com identidades fictícias.
begin;
select no_plan();

select ok((select relrowsecurity from pg_class where oid='public.clinical_ai_usage_limits'::regclass),'limits use RLS');
select ok((select relrowsecurity from pg_class where oid='public.clinical_ai_operations'::regclass),'operations use RLS');
select ok(not has_table_privilege('anon','public.clinical_ai_operations','select,insert,update,delete'),'anon has no AI operation access');
select ok(not has_table_privilege('authenticated','public.clinical_ai_operations','select,insert,update,delete'),'authenticated cannot access AI operations directly');
select ok(not has_table_privilege('authenticated','public.clinical_ai_usage_limits','select,insert,update,delete'),'authenticated cannot inspect or change quotas');
select ok(not has_function_privilege('authenticated','public.reserve_clinical_ai_operation(uuid,uuid,uuid,uuid,public.clinical_ai_tool,uuid,integer,integer,bigint)','execute'),'client cannot reserve quota directly');
select ok(has_function_privilege('service_role','public.reserve_clinical_ai_operation(uuid,uuid,uuid,uuid,public.clinical_ai_tool,uuid,integer,integer,bigint)','execute'),'backend role may reserve quota');
select ok(not (select prosecdef from pg_proc where oid='public.reserve_clinical_ai_operation(uuid,uuid,uuid,uuid,public.clinical_ai_tool,uuid,integer,integer,bigint)'::regprocedure),'reservation does not use security definer');

insert into auth.users(id,email) values
 ('71000000-0000-4000-8000-000000000001','nutri-ai-a@demo.local'),
 ('72000000-0000-4000-8000-000000000001','nutri-ai-b@demo.local');
insert into public.organizations(id,name,created_by) values
 ('7a000000-0000-4000-8000-000000000001','Organização IA A','71000000-0000-4000-8000-000000000001'),
 ('7b000000-0000-4000-8000-000000000001','Organização IA B','72000000-0000-4000-8000-000000000001');
insert into public.organization_members(organization_id,user_id,role,clinical_access,created_by) values
 ('7a000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','nutritionist',true,'71000000-0000-4000-8000-000000000001'),
 ('7b000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','nutritionist',true,'72000000-0000-4000-8000-000000000001');
insert into public.patients_administrative(id,organization_id,full_name,birth_date,email,phone,created_by) values
 ('7a100000-0000-4000-8000-000000000001','7a000000-0000-4000-8000-000000000001','Paciente IA A','1990-01-01','patient-ai-a@demo.local','71999991001','71000000-0000-4000-8000-000000000001'),
 ('7b100000-0000-4000-8000-000000000001','7b000000-0000-4000-8000-000000000001','Paciente IA B','1991-01-01','patient-ai-b@demo.local','71999991002','72000000-0000-4000-8000-000000000001');
insert into public.patient_professional_assignments(organization_id,patient_id,professional_user_id,assigned_by) values
 ('7a000000-0000-4000-8000-000000000001','7a100000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001'),
 ('7b000000-0000-4000-8000-000000000001','7b100000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001');
insert into public.clinical_ai_usage_limits(organization_id,professional_user_id,tool,period_start,period_end,max_requests,max_input_tokens,max_output_tokens,max_cost_micros) values
 ('7a000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','evolution-analysis',current_date,current_date,1,1000,1000,1000);

set local role service_role;
select lives_ok($$select * from public.reserve_clinical_ai_operation('71111111-1111-4111-8111-111111111111','7a000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','7a100000-0000-4000-8000-000000000001','evolution-analysis','71222222-2222-4222-8222-222222222222',100,100,100)$$,'authorized backend reserves atomically');
select results_eq($$select reused from public.reserve_clinical_ai_operation('71111111-1111-4111-8111-111111111111','7a000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','7a100000-0000-4000-8000-000000000001','evolution-analysis','71222222-2222-4222-8222-222222222222',100,100,100)$$,array[true],'idempotency reuses reservation');
select throws_ok($$select * from public.reserve_clinical_ai_operation('71333333-3333-4333-8333-333333333333','7a000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','7a100000-0000-4000-8000-000000000001','evolution-analysis','71444444-4444-4444-8444-444444444444',100,100,100)$$,'P0001','AI quota exceeded','concurrent-safe quota blocks excess');
select lives_ok($$select public.complete_clinical_ai_operation('71111111-1111-4111-8111-111111111111','71000000-0000-4000-8000-000000000001','success',90,80,70,'configured-model',100,null)$$,'backend reconciles usage metadata');
select throws_ok($$select public.complete_clinical_ai_operation('71111111-1111-4111-8111-111111111111','71000000-0000-4000-8000-000000000001','success',90,80,70,'configured-model',100,null)$$,'P0001','AI operation not found or already completed','operation cannot be completed twice');

reset role;
update public.patient_professional_assignments set active=false where organization_id='7a000000-0000-4000-8000-000000000001';
set local role service_role;
select throws_ok($$select * from public.reserve_clinical_ai_operation('71555555-5555-4555-8555-555555555555','7a000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','7a100000-0000-4000-8000-000000000001','evolution-analysis','71666666-6666-4666-8666-666666666666',100,100,100)$$,'42501','Clinical AI access denied','revoked assignment blocks reservation');
select throws_ok($$select * from public.reserve_clinical_ai_operation('71777777-7777-4777-8777-777777777777','7b000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','7b100000-0000-4000-8000-000000000001','evolution-analysis','71888888-8888-4888-8888-888888888888',100,100,100)$$,'42501','Clinical AI access denied','cross-organization identity is denied');

select * from finish();
rollback;
