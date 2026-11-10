\set ON_ERROR_STOP on
\pset pager off
\echo 'AtriaNutri post-migration verification (read only)'

begin transaction read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';

select array_agg(version order by version) = array[
  '20261108122833',
  '20261108150000',
  '20261108180000',
  '20261108210000',
  '20261108213000',
  '20261108230000',
  '20261109090000',
  '20261109180000'
]::text[] as migration_history_exact
from supabase_migrations.schema_migrations;

select count(*) = 28 as expected_public_table_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p');

select count(*) = 0 as no_public_table_without_rls_or_policy
from (
  select c.oid
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
  where n.nspname = 'public' and c.relkind in ('r', 'p')
  group by c.oid, c.relrowsecurity
  having not c.relrowsecurity or count(p.policyname) = 0
) missing;

select count(*) = 0 as no_unsafe_security_definer_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'atrianutri_private')
  and p.prosecdef
  and not exists (
    select 1
    from unnest(coalesce(p.proconfig, array[]::text[])) config
    where config like 'search_path=%'
  );

select count(*) = 0 as anon_has_no_public_table_privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon';

select count(*) = 0 as anon_cannot_execute_application_functions
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'atrianutri_private')
  and not exists (
    select 1 from pg_depend d
    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  )
  and has_function_privilege('anon', p.oid, 'EXECUTE');

select count(*) = 0 as authenticated_has_no_direct_finance_writes
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in (
    'organization_finance_permissions', 'financial_charges', 'financial_payments',
    'expense_categories', 'financial_expenses', 'financial_audit_events'
  )
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

select count(*) = 0 as authenticated_has_no_direct_private_note_writes
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in ('clinical_private_notes', 'appointment_private_details')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

select to_regprocedure('public.reverse_financial_payment(uuid,uuid,text)') is not null
       and position(
         'sum(payment.amount_cents)' in
         pg_get_functiondef(to_regprocedure('public.reverse_financial_payment(uuid,uuid,text)'))
       ) > 0 as finance_reversal_fix_present;

select to_regprocedure('atrianutri_private.protect_appointment_private_details()') is not null
       as private_appointment_guard_present;

commit;
