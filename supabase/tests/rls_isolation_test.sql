-- Run only in a disposable local Supabase instance after the foundation migration:
--   supabase test db
-- Never run against AtriaClinic or any production project.

begin;
select plan(12);

select ok(has_table_privilege('authenticated', 'public.patients_administrative', 'select'), 'authenticated has explicit patient select grant');
select ok(not has_table_privilege('anon', 'public.patients_administrative', 'select'), 'anon cannot read patient administration');
select ok(not has_table_privilege('anon', 'public.patient_clinical_profiles', 'select'), 'anon cannot read clinical profiles');
select ok(not has_table_privilege('anon', 'public.nutrition_assessments', 'select'), 'anon cannot read assessments');
select ok(not has_table_privilege('anon', 'public.meal_plans', 'select'), 'anon cannot read meal plans');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'insert'), 'clients cannot insert audit events');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'update'), 'clients cannot alter audit events');
select ok(not has_table_privilege('authenticated', 'public.meal_plan_versions', 'update'), 'plan versions are immutable to clients');
select ok(not has_table_privilege('authenticated', 'public.meal_plan_versions', 'delete'), 'plan versions cannot be deleted by clients');
select row_security_active('public.patients_administrative'), 'patient administration has RLS';
select row_security_active('public.patient_clinical_profiles'), 'clinical profiles have RLS';
select row_security_active('public.nutrition_assessments'), 'assessments have RLS';

select * from finish();
rollback;
