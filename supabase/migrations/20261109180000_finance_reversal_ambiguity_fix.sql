-- Corrige a ambiguidade entre a coluna financial_payments.amount_cents e o
-- campo de retorno homônimo do RPC. Migration complementar; não aplicada remotamente.
begin;

create or replace function public.reverse_financial_payment(
  p_payment_id uuid,
  p_idempotency_key uuid,
  p_administrative_note text
)
returns table(
  saved_id uuid,
  charge_id uuid,
  amount_cents bigint,
  method public.financial_payment_method,
  received_at date,
  saved_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_original public.financial_payments;
  v_reversed bigint;
  v_id uuid;
  v_at timestamptz;
begin
  select * into v_original
  from public.financial_payments
  where id = p_payment_id and kind = 'receipt'
  for update;

  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if not atrianutri_private.has_finance_access(v_original.organization_id, array['manage']::public.finance_access_level[]) then
    raise exception 'Finance reversal denied' using errcode = '42501';
  end if;

  select coalesce(sum(payment.amount_cents), 0)
  into v_reversed
  from public.financial_payments as payment
  where payment.reverses_payment_id = p_payment_id;

  if v_reversed >= v_original.amount_cents then
    raise exception 'Payment already reversed' using errcode = '23505';
  end if;

  insert into public.financial_payments(
    organization_id, charge_id, kind, amount_cents, method, received_at,
    administrative_note, idempotency_key, reverses_payment_id, created_by
  ) values (
    v_original.organization_id, v_original.charge_id, 'reversal',
    v_original.amount_cents - v_reversed, v_original.method, current_date,
    coalesce(p_administrative_note, ''), p_idempotency_key, p_payment_id, v_actor
  ) returning id, created_at into v_id, v_at;

  insert into public.financial_audit_events(
    organization_id, entity_type, entity_id, action, actor_user_id
  ) values (
    v_original.organization_id, 'payment', v_id::text, 'reversed', v_actor
  );

  return query select
    v_id, v_original.charge_id, v_original.amount_cents - v_reversed,
    v_original.method, current_date, v_at;
end;
$$;

revoke all on function public.reverse_financial_payment(uuid, uuid, text) from public, anon;
grant execute on function public.reverse_financial_payment(uuid, uuid, text) to authenticated;

commit;
