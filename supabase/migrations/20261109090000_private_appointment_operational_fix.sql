-- Permite que papéis operacionais atualizem o compromisso sem alterar seu detalhe privado.
-- A tentativa de UPSERT da RPC passa pelo evento INSERT antes do conflito; somente uma linha
-- privada preexistente e pertencente ao mesmo compromisso pode seguir para o UPDATE protegido.
begin;

create or replace function atrianutri_private.protect_appointment_private_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professional uuid := coalesce(new.professional_user_id, old.professional_user_id);
  v_actor uuid := (select auth.uid());
begin
  if v_actor is not null and v_actor is distinct from v_professional then
    if tg_op = 'UPDATE' then
      new.private_title := old.private_title;
      return new;
    end if;

    if tg_op = 'INSERT' and exists (
      select 1
      from public.appointment_private_details d
      where d.appointment_id = new.appointment_id
        and d.organization_id = new.organization_id
        and d.professional_user_id = new.professional_user_id
    ) then
      return new;
    end if;

    raise exception 'Private appointment detail access denied' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function atrianutri_private.protect_appointment_private_details()
  from public, anon, authenticated, service_role;

commit;
