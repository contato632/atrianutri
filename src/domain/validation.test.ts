import { describe, expect, it } from 'vitest'
import { assessmentSchema, foodDiaryEntrySchema, habitCheckInSchema, habitGoalSchema, patientSchema } from './validation'

describe('patientSchema', () => {
  it('aceita cadastro administrativo válido', () => {
    expect(patientSchema.safeParse({ fullName: 'Maria de Souza', birthDate: '1990-05-12', phone: '(11) 99999-9999', email: 'maria@example.com', status: 'active' }).success).toBe(true)
  })

  it('rejeita nome, e-mail e data inválidos', () => {
    const result = patientSchema.safeParse({ fullName: 'M', birthDate: '2999-01-01', phone: '1', email: 'incorreto', status: 'active' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['fullName', 'birthDate', 'phone', 'email']))
  })
})

describe('diário alimentar e hábitos', () => {
  it('valida uma entrada subjetiva sem impor notas ou classificações', () => {
    expect(foodDiaryEntrySchema.safeParse({
      patientId: 'patient-1', entryDate: '2026-11-08', mealTime: '12:30', mealType: 'lunch',
      foods: [{ id: 'food-1', name: 'Preparação informada', quantity: '' }], notes: '', eatingContext: '',
      hungerBefore: '', satietyAfter: '', routineChanges: '', sharedWithPatient: false,
      professionalPrivateNote: '', submissionKey: '10000000-0000-4000-8000-000000000001',
    }).success).toBe(true)
  })

  it('rejeita diário sem alimento e metas/check-ins fora dos contratos', () => {
    const base = { patientId: 'patient-1', sharedWithPatient: false, professionalPrivateNote: '', submissionKey: '10000000-0000-4000-8000-000000000001' }
    expect(foodDiaryEntrySchema.safeParse({ ...base, entryDate: '2026-11-08', mealTime: '99:00', mealType: 'lunch', foods: [], notes: '', eatingContext: '', hungerBefore: '', satietyAfter: '', routineChanges: '' }).success).toBe(false)
    expect(habitGoalSchema.safeParse({ ...base, title: 'H', description: '', status: 'active' }).success).toBe(false)
    expect(habitCheckInSchema.safeParse({ ...base, goalId: 'goal-1', recordedOn: '2026-11-08', progress: 'punitive-score', notes: '', difficulties: '', nextStep: '' }).success).toBe(false)
  })
})

describe('assessmentSchema', () => {
  it('mantém medidas opcionais e valida os limites principais', () => {
    expect(assessmentSchema.safeParse({ patientId: 'patient-1', assessedAt: '2026-11-08', weightKg: 72.4, heightCm: 168, notes: '' }).success).toBe(true)
    expect(assessmentSchema.safeParse({ patientId: 'patient-1', assessedAt: '2026-11-08', weightKg: 72.4, heightCm: 500, notes: '' }).success).toBe(false)
  })
})
