import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { MealPlan } from '../domain/models'
import { RepositoryConflictError, SupabaseNutritionRepository } from './SupabaseNutritionRepository'

const newPlan: MealPlan = {
  id: 'temporary-client-id', patientId: 'patient-1', title: 'Plano manual', status: 'draft',
  version: 0, updatedAt: '', meals: [], revisions: [],
}

function clientWithRpc(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as unknown as SupabaseClient
}

describe('SupabaseNutritionRepository meal plan persistence', () => {
  it('só confirma um novo plano após receber id, versão e horário do servidor', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ saved_plan_id: 'server-plan-id', saved_version: 1, saved_at: '2026-11-08T12:00:00Z' }], error: null })
    const repository = new SupabaseNutritionRepository(clientWithRpc(rpc), 'org-1')
    const saved = await repository.saveMealPlan(newPlan, 'Criação')

    expect(rpc).toHaveBeenCalledWith('create_meal_plan_draft', expect.objectContaining({ p_organization_id: 'org-1', p_patient_id: 'patient-1' }))
    expect(saved).toEqual(expect.objectContaining({ id: 'server-plan-id', version: 1, updatedAt: '2026-11-08T12:00:00Z' }))
  })

  it('não informa sucesso quando o servidor não confirma a versão', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    const repository = new SupabaseNutritionRepository(clientWithRpc(rpc), 'org-1')
    await expect(repository.saveMealPlan(newPlan, 'Criação')).rejects.toThrow('não confirmou')
  })

  it('traduz conflito otimista em erro específico', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '40001', message: 'conflict' } })
    const repository = new SupabaseNutritionRepository(clientWithRpc(rpc), 'org-1')
    await expect(repository.saveMealPlan({ ...newPlan, id: 'plan-1', version: 2 }, 'Ajuste')).rejects.toBeInstanceOf(RepositoryConflictError)
  })
})

describe('SupabaseNutritionRepository clinical profile', () => {
  it('bloqueia overwrite quando o timestamp de anamnese mudou', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const select = vi.fn().mockReturnValue({ maybeSingle })
    const eq = vi.fn().mockReturnThis()
    const update = vi.fn().mockReturnValue({ eq, select })
    const from = vi.fn().mockReturnValue({ update })
    const repository = new SupabaseNutritionRepository({ from } as unknown as SupabaseClient, 'org-ficticia')
    await expect(repository.saveClinicalProfile('patient-ficticio', {
      goal: '', foodHistory: '', habits: '', professionalNotes: '',
    }, '2026-11-08T13:00:00Z')).rejects.toBeInstanceOf(RepositoryConflictError)
    expect(from).toHaveBeenCalledWith('patient_clinical_profiles')
    expect(eq).toHaveBeenCalledWith('organization_id', 'org-ficticia')
    expect(eq).toHaveBeenCalledWith('patient_id', 'patient-ficticio')
    expect(eq).toHaveBeenCalledWith('updated_at', '2026-11-08T13:00:00Z')
  })
})
