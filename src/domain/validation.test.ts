import { describe, expect, it } from 'vitest'
import { appointmentSchema, assessmentSchema, dietaryRecall24hSchema, foodDiaryEntrySchema, habitCheckInSchema, habitGoalSchema, nutritionEvaluationSchema, patientSchema, professionalServiceSchema } from './validation'

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

describe('avaliação completa e recordatório de 24 horas', () => {
  it('aceita campos clínicos opcionais sem inferências', () => {
    expect(nutritionEvaluationSchema.safeParse({ patientId:'patient-1',evaluatedOn:'2026-11-08',consultationReason:'',healthHistory:'',reportedAllergies:'',reportedMedications:'',previousNutritionCare:'',foodRestrictionsAndPreferences:'',usualMealSchedule:'',usualMealsCount:'',mealEnvironment:'',foodAccess:'',hydration:'',reportedDifficulties:'',professionalObservations:'',submissionKey:'50000000-0000-4000-8000-000000000001' }).success).toBe(true)
  })
  it('valida refeição, horário e alimento do recordatório', () => {
    const base={evaluationId:'evaluation-1',patientId:'patient-1',recallDate:'2026-11-08',complementaryNotes:'',submissionKey:'50000000-0000-4000-8000-000000000002'}
    expect(dietaryRecall24hSchema.safeParse({...base,meals:[{id:'meal-1',name:'Almoço',time:'12:30',foods:[{id:'food-1',name:'Preparação relatada',quantity:''}],context:'',notes:''}]}).success).toBe(true)
    expect(dietaryRecall24hSchema.safeParse({...base,meals:[]}).success).toBe(false)
  })
})

describe('agenda e serviços',()=>{
  it('valida serviço e exige paciente em consulta',()=>{expect(professionalServiceSchema.safeParse({name:'Consulta inicial',defaultDurationMinutes:60,priceCents:20000,active:true}).success).toBe(true);const base={category:'nutrition-consultation',status:'scheduled',title:'Consulta',privateTitle:'',administrativeNote:'',startsAt:'2026-11-09T12:00:00.000Z',endsAt:'2026-11-09T13:00:00.000Z',recurrenceFrequency:'none'};expect(appointmentSchema.safeParse(base).success).toBe(false);expect(appointmentSchema.safeParse({...base,patientId:'patient-1'}).success).toBe(true)})
})
