-- Disposable pgTAP coverage for Etapa 16. All identities and data are fictitious.
begin;
select no_plan();

insert into auth.users(id,email) values
  ('61000000-0000-4000-8000-000000000001','nutri-a-link@demo.local'),
  ('61000000-0000-4000-8000-000000000002','patient-a-link@demo.local'),
  ('62000000-0000-4000-8000-000000000001','nutri-b-link@demo.local'),
  ('62000000-0000-4000-8000-000000000002','patient-b-link@demo.local');
insert into public.organizations(id,name,created_by) values
  ('6a000000-0000-4000-8000-000000000001','Organização Vínculo A','61000000-0000-4000-8000-000000000001'),
  ('6b000000-0000-4000-8000-000000000001','Organização Vínculo B','62000000-0000-4000-8000-000000000001');
insert into public.organization_members(organization_id,user_id,role,clinical_access,created_by) values
  ('6a000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','nutritionist',true,'61000000-0000-4000-8000-000000000001'),
  ('6b000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','nutritionist',true,'62000000-0000-4000-8000-000000000001');
insert into public.patients_administrative(id,organization_id,full_name,birth_date,email,phone,created_by) values
  ('6a100000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000001','Paciente Vínculo A','1990-01-01','patient-a-link@demo.local','71999991001','61000000-0000-4000-8000-000000000001'),
  ('6b100000-0000-4000-8000-000000000001','6b000000-0000-4000-8000-000000000001','Paciente Vínculo B','1991-01-01','patient-b-link@demo.local','11999991002','62000000-0000-4000-8000-000000000001');
insert into public.patient_professional_assignments(organization_id,patient_id,professional_user_id,assigned_by) values
  ('6a000000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001'),
  ('6b000000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001');
insert into public.meal_plans(id,organization_id,patient_id,title,status,current_version,created_by,updated_by) values
  ('6a200000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001','Plano Vínculo A','draft',2,'61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001');
insert into public.meal_plan_versions(organization_id,meal_plan_id,patient_id,version,meals,change_summary,created_by) values
  ('6a000000-0000-4000-8000-000000000001','6a200000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001',1,'[{"name":"Versão um"}]','Primeira','61000000-0000-4000-8000-000000000001'),
  ('6a000000-0000-4000-8000-000000000001','6a200000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001',2,'[{"name":"Rascunho dois"}]','Segunda','61000000-0000-4000-8000-000000000001');

select ok(not has_table_privilege('anon','public.patient_portal_invitations','select'), 'anon cannot read invitations');
select ok(not has_table_privilege('authenticated','public.patient_portal_invitations','insert,update,delete'), 'clients cannot mutate invitations directly');
select ok(not has_table_privilege('authenticated','public.patient_portal_links','insert,update,delete'), 'clients cannot mutate links directly');
select ok(not has_table_privilege('authenticated','public.meal_plan_publications','insert,update,delete'), 'clients cannot mutate publications directly');
select ok(has_function_privilege('authenticated','public.accept_patient_portal_invitation(text)','execute'),'authenticated may execute invitation acceptance');
select ok(not has_function_privilege('anon','public.accept_patient_portal_invitation(text)','execute'),'anon cannot execute invitation acceptance');

set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
create temp table test_invite on commit drop as select * from public.create_patient_portal_invitation('6a000000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001');
select results_eq($$select count(*) from public.patient_portal_invitations$$,array[1::bigint],'assigned professional sees created invitation');
select ok((select length(invitation_token)>=40 from test_invite),'server returns a cryptographically large opaque token once');
select ok(not exists(select 1 from public.patient_portal_invitations invitation,test_invite result where encode(invitation.token_hash,'hex')=result.invitation_token),'database stores a hash rather than the raw token');
select throws_ok($$select * from public.create_patient_portal_invitation('6a000000-0000-4000-8000-000000000001','6a100000-0000-4000-8000-000000000001')$$,'23505',null,'second pending invitation is rejected');
select throws_ok($$select * from public.create_patient_portal_invitation('6b000000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001')$$,'42501',null,'professional cannot invite across organizations');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok(format('select * from public.accept_patient_portal_invitation(%L)',(select invitation_token from test_invite)),'42501',null,'another patient cannot consume the invitation');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select lives_ok(format('select * from public.accept_patient_portal_invitation(%L)',(select invitation_token from test_invite)),'matching authenticated patient activates the link');
select results_eq($$select patient_id from public.patient_portal_links where status='active'$$,array['6a100000-0000-4000-8000-000000000001'::uuid],'patient sees only own active link');
select throws_ok(format('select * from public.accept_patient_portal_invitation(%L)',(select invitation_token from test_invite)),'42501',null,'invitation cannot be reused');
select is_empty($$select * from public.meal_plans$$,'patient cannot see a plan before explicit publication');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.publish_meal_plan_version('6a200000-0000-4000-8000-000000000001',1)$$,'professional publishes an explicit immutable version');
select lives_ok(format('select public.revoke_meal_plan_publication(%L)',(select id from public.meal_plan_publications where status='active')),'professional explicitly suspends a publication');
select lives_ok($$select public.publish_meal_plan_version('6a200000-0000-4000-8000-000000000001',2)$$,'professional replaces publication while preserving history');
select results_eq($$select status::text from public.meal_plan_publications order by published_at,id$$,array['revoked'::text,'active'::text],'replaced publication preserves revoked history');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002',true);
select results_eq($$select version from public.meal_plan_versions order by version$$,array[2],'patient sees only the currently published version');
select is_empty($$select * from public.patient_clinical_profiles$$,'patient never gains access to professional clinical profile');
select is_empty($$select * from public.financial_charges$$,'patient never gains access to financial records');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
select lives_ok(format('select public.end_patient_portal_link(%L)',(select id from public.patient_portal_links where status='active')),'professional ends the active link');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002',true);
select is_empty($$select * from public.meal_plan_versions$$,'ending link immediately revokes published plan access');
select is_empty($$select * from public.patients_administrative$$,'ending link revokes patient self access');

select * from finish();
rollback;
