import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migration = readFileSync(join(root, 'supabase/migrations/20261108122833_atrianutri_foundation.sql'), 'utf8')
const diaryMigration = readFileSync(join(root, 'supabase/migrations/20261108150000_food_diary_and_habits.sql'), 'utf8')
const evaluationMigration = readFileSync(join(root, 'supabase/migrations/20261108180000_complete_nutrition_evaluation.sql'), 'utf8')
const scheduleMigration = readFileSync(join(root, 'supabase/migrations/20261108210000_professional_schedule.sql'), 'utf8')
const scheduleHardeningMigration = readFileSync(join(root, 'supabase/migrations/20261108213000_professional_schedule_hardening.sql'), 'utf8')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? sourceFiles(path) : [path]
  }).filter((path) => /\.(ts|tsx|js|jsx)$/.test(path))
}

describe('frontend security contract', () => {
  it('não contém segredo administrativo ou armazenamento local de dados clínicos', () => {
    const files = sourceFiles(join(root, 'src')).filter((path) => !path.endsWith('security-contract.test.ts'))
    const combined = files.map((path) => `\nFILE:${relative(root, path)}\n${readFileSync(path, 'utf8')}`).join('')
    expect(combined).not.toMatch(/service[_-]?role/i)
    expect(combined).not.toContain('localStorage')
    expect(combined).not.toContain('sessionStorage')
  })

  it('bloqueia explicitamente a referência do AtriaClinic sem conectar a ela', () => {
    const client = readFileSync(join(root, 'src/lib/supabase.ts'), 'utf8')
    expect(client).toContain('tbbaiowzduqriwdjeacd')
    expect(client).toContain('forbiddenProjectRefs')
    expect(client).not.toContain('https://tbbaiowzduqriwdjeacd')
  })

  it('fixa a allowlist no projeto exclusivo do AtriaNutri e mantém dados reais bloqueados por padrão', () => {
    const client = readFileSync(join(root, 'src/lib/supabase.ts'), 'utf8')
    expect(client).toContain('zwnoxycxhlihqxhutlcy')
    expect(client).toContain('VITE_REAL_DATA_APPROVED')
    expect(readFileSync(join(root, '.env.example'), 'utf8')).toContain('VITE_REAL_DATA_APPROVED=false')
  })

  it('inclui navegação responsiva para desktop e celular', () => {
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    expect(css).toContain('.sidebar')
    expect(css).toContain('.mobile-tabs')
    expect(css).toContain('@media (max-width: 900px)')
  })
})

describe('migration security contract', () => {
  const protectedTables = ['patients_administrative', 'patient_clinical_profiles', 'nutrition_assessments', 'meal_plans', 'meal_plan_versions', 'audit_events']

  it.each(protectedTables)('habilita RLS em %s', (table) => {
    expect(migration).toContain(`alter table public.${table} enable row level security`)
  })

  it('revoga o acesso anônimo e não concede mutação de auditoria', () => {
    expect(migration).toContain('revoke all on all tables in schema public from anon, authenticated')
    expect(migration).toContain('grant select on public.audit_events to authenticated')
    expect(migration).not.toContain('grant insert on public.audit_events to authenticated')
    expect(migration).not.toContain('grant update on public.audit_events to authenticated')
  })

  it('separa acesso administrativo, clínico e por organização', () => {
    expect(migration).toContain('can_access_patient_admin')
    expect(migration).toContain('can_access_patient_clinical')
    expect(migration).toContain('patient_professional_assignments')
    expect(migration).toContain('organization_id')
  })

  it('amarra cada versão ao plano, organização e paciente do cabeçalho', () => {
    expect(migration).toContain('unique (id, organization_id, patient_id)')
    expect(migration).toContain('foreign key (meal_plan_id, organization_id, patient_id)')
    expect(migration).toContain('references public.meal_plans(id, organization_id, patient_id)')
  })

  it('mantém versões imutáveis e usa RPC transacional com conflito otimista', () => {
    expect(migration).not.toContain('grant insert (organization_id, meal_plan_id, patient_id, version, meals, change_summary, created_by)')
    expect(migration).not.toContain('grant update (current_version)')
    expect(migration).toContain('for update')
    expect(migration).toContain("raise exception 'Meal plan version conflict' using errcode = '40001'")
    expect(migration).toContain('public.save_meal_plan_version')
    expect(migration).toContain('public.create_meal_plan_draft')
  })

  it('impede autoelevação de cargo e acesso clínico', () => {
    expect(migration).toContain("user_id <> (select auth.uid())")
    expect(migration).toContain("and role <> 'owner'")
    expect(migration).toContain("array['owner']::public.organization_role[]")
  })
})

describe('food diary and habits migration contract', () => {
  const protectedTables = ['food_diary_entries', 'habit_goals', 'habit_check_ins', 'clinical_private_notes']

  it.each(protectedTables)('habilita RLS em %s', (table) => {
    expect(diaryMigration).toContain(`alter table public.${table} enable row level security`)
  })

  it('separa observações privadas e não concede escrita clínica direta ao frontend', () => {
    expect(diaryMigration).toContain('num_nonnulls(food_diary_entry_id, habit_goal_id, habit_check_in_id) = 1')
    expect(diaryMigration).toContain('revoke all on public.food_diary_entries, public.habit_goals, public.habit_check_ins, public.clinical_private_notes from public, anon, authenticated')
    expect(diaryMigration).not.toContain('grant insert on public.food_diary_entries to authenticated')
    expect(diaryMigration).not.toContain('grant update on public.clinical_private_notes to authenticated')
  })

  it('usa RPCs transacionais, idempotência e conflito otimista', () => {
    expect(diaryMigration).toContain('public.save_food_diary_entry')
    expect(diaryMigration).toContain('public.save_habit_goal')
    expect(diaryMigration).toContain('public.save_habit_check_in')
    expect(diaryMigration).toContain('submission_key')
    expect(diaryMigration).toContain("using errcode = '40001'")
    expect(diaryMigration).toContain('Patients can only edit their own entries')
    expect(diaryMigration).toContain('Patients can only edit their own check-ins')
    expect(diaryMigration).toContain('Habit goal is not shared with the patient')
  })

  it('não inclui conteúdo sensível no metadado de auditoria', () => {
    for (const field of ['foods', 'eating_context', 'hunger_before', 'satiety_after', 'routine_changes', 'difficulties', 'next_step', 'content']) {
      expect(diaryMigration).toMatch(new RegExp(`'${field}'`))
    }
  })
})

describe('complete nutrition evaluation migration contract', () => {
  it.each(['nutrition_evaluations','dietary_recalls_24h'])('habilita RLS em %s',(table)=>expect(evaluationMigration).toContain(`alter table public.${table} enable row level security`))
  it('preserva autoria, vínculo composto e escrita somente por RPC',()=>{
    expect(evaluationMigration).toContain('responsible_professional_user_id uuid not null')
    expect(evaluationMigration).toContain('references public.nutrition_evaluations(id, organization_id, patient_id)')
    expect(evaluationMigration).toContain('revoke all on public.nutrition_evaluations,public.dietary_recalls_24h from public,anon,authenticated')
    expect(evaluationMigration).toContain('public.save_nutrition_evaluation')
    expect(evaluationMigration).toContain('public.save_dietary_recall_24h')
    expect(evaluationMigration).not.toContain('drop table')
    expect(evaluationMigration).not.toContain('truncate')
  })
  it('remove conteúdo clínico da auditoria',()=>{
    for(const field of ['consultation_reason','health_history','reported_allergies','reported_medications','professional_observations','complementary_notes']) expect(evaluationMigration).toContain(`'${field}'`)
  })
})

describe('professional schedule migration contract', () => {
  const protectedTables = ['professional_services', 'appointment_series', 'appointments', 'appointment_private_details', 'appointment_changes']

  it.each(protectedTables)('habilita RLS em %s', (table) => {
    expect(scheduleMigration).toContain(`alter table public.${table} enable row level security`)
  })

  it('impede escrita direta e concentra mutações em RPCs autorizadas', () => {
    expect(scheduleMigration).toContain('revoke all on public.professional_services,public.appointment_series,public.appointments,public.appointment_private_details,public.appointment_changes from public,anon,authenticated')
    expect(scheduleMigration).toContain('public.save_professional_service')
    expect(scheduleMigration).toContain('public.create_appointment_series')
    expect(scheduleMigration).toContain('public.update_appointment')
    expect(scheduleMigration).toContain('public.cancel_appointment')
    expect(scheduleMigration).not.toContain('grant insert on public.appointments')
    expect(scheduleMigration).not.toContain('grant update on public.appointments')
  })

  it('garante isolamento organizacional, sigilo pessoal e conflito no PostgreSQL', () => {
    expect(scheduleMigration).toContain('appointments_professional_no_overlap')
    expect(scheduleMigration).toContain('exclude using gist')
    expect(scheduleMigration).toContain('appointment_private_select_owner')
    expect(scheduleMigration).toContain("m.role in('owner','admin','reception') or m.user_id=p_professional_id")
    expect(scheduleMigration).toContain("raise exception 'Appointment time conflict' using errcode='23P01'")
  })

  it('mantém recorrência limitada, auditoria e exclusão lógica por cancelamento', () => {
    expect(scheduleMigration).toContain('for v_i in 0..103 loop')
    expect(scheduleMigration).toContain("p_recurrence_ends_on>p_local_start::date+730")
    expect(scheduleMigration).toContain("change_type in('created','updated','rescheduled','status_changed','canceled')")
    expect(scheduleMigration).toContain("set status='canceled'")
    expect(scheduleMigration).not.toContain('drop table')
    expect(scheduleMigration).not.toContain('truncate')
  })
})

describe('professional schedule hardening contract', () => {
  it('registra exceções de recorrência com autoria sem operação destrutiva', () => {
    expect(scheduleHardeningMigration).toContain('appointment_series_exceptions')
    expect(scheduleHardeningMigration).toContain('capture_appointment_series_exception')
    expect(scheduleHardeningMigration).toContain('changed_by')
    expect(scheduleHardeningMigration).not.toContain('drop table')
    expect(scheduleHardeningMigration).not.toContain('truncate')
  })

  it('protege detalhes particulares mesmo em mutações security-definer', () => {
    expect(scheduleHardeningMigration).toContain('protect_appointment_private_details')
    expect(scheduleHardeningMigration).toContain('v_actor is distinct from v_professional')
    expect(scheduleHardeningMigration).toContain("errcode = '42501'")
  })
})
