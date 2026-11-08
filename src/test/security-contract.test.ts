import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migration = readFileSync(join(root, 'supabase/migrations/202611080001_atrianutri_foundation.sql'), 'utf8')

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
