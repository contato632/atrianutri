begin;
select no_plan();

select has_table('public','financial_charges','financial charges table exists');
select has_table('public','financial_payments','financial payments table exists');
select has_table('public','financial_expenses','financial expenses table exists');
select has_table('public','organization_finance_permissions','explicit finance permissions exist');
select ok((select relrowsecurity from pg_class where oid='public.financial_charges'::regclass),'charges have RLS');
select ok((select relrowsecurity from pg_class where oid='public.financial_payments'::regclass),'payments have RLS');
select ok((select relrowsecurity from pg_class where oid='public.financial_expenses'::regclass),'expenses have RLS');
select ok(not has_table_privilege('anon','public.financial_charges','select'),'anonymous cannot read charges');
select ok(not has_table_privilege('authenticated','public.financial_charges','insert,update,delete'),'authenticated clients cannot mutate charges directly');
select ok(not has_table_privilege('authenticated','public.financial_payments','insert,update,delete'),'authenticated clients cannot mutate payments directly');
select ok(not has_table_privilege('authenticated','public.financial_expenses','insert,update,delete'),'authenticated clients cannot mutate expenses directly');
select has_function('public','create_financial_charge',array['uuid','uuid','uuid','uuid','uuid','text','bigint','date','text'],'transactional charge RPC exists');
select has_function('public','record_financial_payment',array['uuid','bigint','financial_payment_method','date','text','uuid','integer','integer'],'transactional receipt RPC exists');
select has_function('public','reverse_financial_payment',array['uuid','uuid','text'],'compensating reversal RPC exists');
select has_function('public','set_finance_permission',array['uuid','uuid','finance_access_level','boolean'],'explicit permission RPC exists');
select is((select count(*) from pg_constraint where conrelid='public.financial_payments'::regclass and pg_get_constraintdef(oid) like '%idempotency_key%'),1::bigint,'idempotency is enforced by a unique database constraint');
select ok(exists(select 1 from pg_indexes where tablename='financial_payments' and indexdef like '%idempotency_key%'),'payment idempotency has a unique database index');
select ok(exists(select 1 from pg_indexes where indexname='financial_charge_active_appointment_uniq'),'one active charge per appointment is enforced');

select * from finish();
rollback;
