\set ON_ERROR_STOP on
\pset pager off
\echo 'AtriaNutri remote read-only inventory'

begin transaction read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';

select current_database() as database_name,
       current_user as database_role,
       current_setting('server_version') as postgres_version,
       current_setting('transaction_read_only') as transaction_read_only;

select version
from supabase_migrations.schema_migrations
order by version;

select nspname as schema_name
from pg_namespace
where nspname in ('auth', 'public', 'storage', 'supabase_migrations', 'atrianutri_private')
order by nspname;

select extname, extversion, n.nspname as schema_name
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by extname;

select n.nspname as schema_name,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       count(p.policyname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname in ('public', 'auth') and c.relkind in ('r', 'p')
group by n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
order by n.nspname, c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd,
       qual is not null as has_using,
       with_check is not null as has_with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as identity_arguments,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       coalesce(array_to_string(p.proconfig, ', '), '') as function_config,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'atrianutri_private')
  and not exists (
    select 1 from pg_depend d
    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  )
order by n.nspname, p.proname, identity_arguments;

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
order by grantee, table_name, privilege_type;

select event_object_schema as schema_name,
       event_object_table as table_name,
       trigger_name,
       action_timing,
       event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
order by event_object_table, trigger_name, event_manipulation;

select table_name
from information_schema.tables
where table_schema = 'auth'
order by table_name;

commit;
