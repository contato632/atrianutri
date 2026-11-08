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

describe('SupabaseNutritionRepository diary and habits', () => {
  const entry = { patientId: 'patient-1', entryDate: '2026-11-08', mealTime: '12:00', mealType: 'lunch' as const, foods: [{ id: 'food-1', name: 'Refeição fictícia', quantity: '' }], notes: '', eatingContext: '', hungerBefore: '', satietyAfter: '', routineChanges: '', sharedWithPatient: false, professionalPrivateNote: '', submissionKey: '30000000-0000-4000-8000-000000000001' }

  it('só confirma o diário com id e timestamp retornados pela RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ saved_id: 'entry-server', saved_updated_at: '2026-11-08T14:00:00Z' }], error: null })
    const saved = await new SupabaseNutritionRepository(clientWithRpc(rpc), 'org-1').saveFoodDiaryEntry(entry)
    expect(rpc).toHaveBeenCalledWith('save_food_diary_entry', expect.objectContaining({ p_organization_id: 'org-1', p_patient_id: 'patient-1', p_entry_id: null }))
    expect(saved).toEqual(expect.objectContaining({ id: 'entry-server', updatedAt: '2026-11-08T14:00:00Z' }))
  })

  it('propaga conflito otimista de meta sem informar sucesso', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '40001', message: 'conflict' } })
    const repository = new SupabaseNutritionRepository(clientWithRpc(rpc), 'org-1')
    await expect(repository.saveHabitGoal({ patientId: 'patient-1', title: 'Meta fictícia', description: '', status: 'active', sharedWithPatient: false, professionalPrivateNote: '', submissionKey: '30000000-0000-4000-8000-000000000002' }, 'goal-1', '2026-11-08T10:00:00Z')).rejects.toBeInstanceOf(RepositoryConflictError)
  })

  it('não confirma check-in quando a RPC não retorna identificação', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    const repository = new SupabaseNutritionRepository(clientWithRpc(rpc), 'org-1')
    await expect(repository.saveHabitCheckIn({ patientId: 'patient-1', goalId: 'goal-1', recordedOn: '2026-11-08', progress: 'difficulty', notes: '', difficulties: 'Turno alterado', nextStep: '', sharedWithPatient: false, professionalPrivateNote: '', submissionKey: '30000000-0000-4000-8000-000000000003' })).rejects.toThrow('não confirmou')
  })
})

describe('SupabaseNutritionRepository complete evaluation',()=>{
  const evaluation={patientId:'patient-1',evaluatedOn:'2026-11-08',consultationReason:'Motivo fictício',healthHistory:'',reportedAllergies:'',reportedMedications:'',previousNutritionCare:'',foodRestrictionsAndPreferences:'',usualMealSchedule:'',usualMealsCount:'',mealEnvironment:'',foodAccess:'',hydration:'',reportedDifficulties:'',professionalObservations:'',submissionKey:'50000000-0000-4000-8000-000000000020'}
  it('confirma avaliação somente após retorno da RPC',async()=>{const rpc=vi.fn().mockResolvedValue({data:[{saved_id:'evaluation-server',saved_updated_at:'2026-11-08T15:00:00Z'}],error:null});const saved=await new SupabaseNutritionRepository(clientWithRpc(rpc),'org-1').saveNutritionEvaluation(evaluation);expect(rpc).toHaveBeenCalledWith('save_nutrition_evaluation',expect.objectContaining({p_patient_id:'patient-1'}));expect(saved.id).toBe('evaluation-server')})
  it('traduz conflito do recordatório',async()=>{const rpc=vi.fn().mockResolvedValue({data:null,error:{code:'40001',message:'conflict'}});const repo=new SupabaseNutritionRepository(clientWithRpc(rpc),'org-1');await expect(repo.saveDietaryRecall24h({evaluationId:'evaluation-1',patientId:'patient-1',recallDate:'2026-11-08',meals:[{id:'m',name:'Almoço',time:'12:00',foods:[{id:'f',name:'Item',quantity:''}],context:'',notes:''}],complementaryNotes:'',submissionKey:'50000000-0000-4000-8000-000000000021'},'recall-1','old')).rejects.toBeInstanceOf(RepositoryConflictError)})
})
