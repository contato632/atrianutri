import { describe, expect, it } from 'vitest'
import type { MealPlan, NutritionWorkspace } from '../domain/models'
import { DemoNutritionRepository } from './repository'

const empty: NutritionWorkspace = { patients: [], clinicalProfiles: [], assessments: [], mealPlans: [], foodDiaryEntries: [], habitGoals: [], habitCheckIns: [], nutritionEvaluations: [], dietaryRecalls24h: [], professionalServices: [], appointments: [], financialCharges: [], financialPayments: [], expenseCategories: [{id:'cat',name:'Outras',active:true}], financialExpenses: [] }

describe('DemoNutritionRepository', () => {
  it('cria e edita paciente sem misturar o perfil clínico no cadastro', async () => {
    const repository = new DemoNutritionRepository(empty)
    const input = { fullName: 'Paciente Fictício', birthDate: '1995-02-10', phone: '(11) 99999-1111', email: 'ficticio@demo.local', status: 'active' as const }
    const created = await repository.createPatient(input)
    expect(created.fullName).toBe(input.fullName)

    await repository.updatePatient(created.id, { ...input, phone: '(11) 98888-2222' })
    const snapshot = await repository.snapshot()
    expect(snapshot.patients[0].phone).toBe('(11) 98888-2222')
    expect(snapshot.clinicalProfiles[0]).toEqual(expect.objectContaining({ patientId: created.id, goal: '', professionalNotes: '' }))
    expect(snapshot.patients[0]).not.toHaveProperty('professionalNotes')
    const saved = await repository.saveClinicalProfile(created.id, {
      goal: 'Organizar os horários de refeição',
      foodHistory: 'Histórico fictício',
      habits: 'Turnos alternados',
      professionalNotes: 'Revisar na próxima consulta',
    }, snapshot.clinicalProfiles[0].updatedAt)
    expect(saved.foodHistory).toBe('Histórico fictício')
    expect((await repository.snapshot()).clinicalProfiles[0].habits).toBe('Turnos alternados')
  })

  it('calcula IMC ao criar avaliação', async () => {
    const repository = new DemoNutritionRepository(empty)
    const patient = await repository.createPatient({ fullName: 'Paciente Teste', birthDate: '1990-01-01', phone: '(71) 99999-9999', email: 'teste@demo.local', status: 'active' })
    const assessment = await repository.createAssessment({ patientId: patient.id, assessedAt: '2026-11-08', weightKg: 70, heightCm: 175, notes: '' })
    expect(assessment.bmi).toBe(22.9)
  })

  it('salva revisões do rascunho somente na instância de demonstração', async () => {
    const repository = new DemoNutritionRepository(empty)
    const patient = await repository.createPatient({ fullName: 'Paciente Teste', birthDate: '1990-01-01', phone: '(71) 99999-9999', email: 'teste@demo.local', status: 'active' })
    const plan: MealPlan = { id: 'plan-test', patientId: patient.id, title: 'Plano manual', status: 'draft', version: 0, updatedAt: '', meals: [], nutritionTargets: { energyKcal: 2000 }, revisions: [] }
    const first = await repository.saveMealPlan(plan, 'Criação')
    const second = await repository.saveMealPlan({ ...first, title: 'Plano ajustado' }, 'Ajuste')
    expect(second.version).toBe(2)
    expect(second.revisions.map((item) => item.summary)).toEqual(['Criação', 'Ajuste'])
    expect(second.revisions[0].nutritionTargets).toEqual({ energyKcal: 2000 })
  })

  it('cria e edita diário, meta e acompanhamento sem perder o vínculo do paciente', async () => {
    const repository = new DemoNutritionRepository(empty)
    const patient = await repository.createPatient({ fullName: 'Paciente Diário', birthDate: '1992-03-02', phone: '(11) 90000-0000', email: 'diario@demo.local', status: 'active' })
    const entry = await repository.saveFoodDiaryEntry({ patientId: patient.id, entryDate: '2026-11-07', mealTime: '12:30', mealType: 'lunch', foods: [{ id: 'food-1', name: 'Arroz e feijão', quantity: 'Porção informada' }], notes: '', eatingContext: 'Em casa', hungerBefore: '', satietyAfter: '', routineChanges: '', sharedWithPatient: false, professionalPrivateNote: 'Nota privada fictícia', submissionKey: '10000000-0000-4000-8000-000000000001' })
    const edited = await repository.saveFoodDiaryEntry({ ...entry, notes: 'Relato atualizado' }, entry.id, entry.updatedAt)
    const goal = await repository.saveHabitGoal({ patientId: patient.id, title: 'Organizar o lanche da tarde', description: 'Meta combinada no contexto fictício', status: 'active', sharedWithPatient: true, professionalPrivateNote: '', submissionKey: '10000000-0000-4000-8000-000000000002' })
    await repository.saveHabitCheckIn({ patientId: patient.id, goalId: goal.id, recordedOn: '2026-11-08', progress: 'not-observed', notes: '', difficulties: 'Mudança de turno', nextStep: 'Observar a rotina', sharedWithPatient: true, professionalPrivateNote: '', submissionKey: '10000000-0000-4000-8000-000000000003' })

    const snapshot = await repository.snapshot()
    expect(edited.notes).toBe('Relato atualizado')
    expect(snapshot.foodDiaryEntries).toHaveLength(1)
    expect(snapshot.habitGoals[0].patientId).toBe(patient.id)
    expect(snapshot.habitCheckIns[0]).toEqual(expect.objectContaining({ patientId: patient.id, goalId: goal.id }))
  })

  it('impede overwrite otimista e check-in em meta de outro paciente', async () => {
    const repository = new DemoNutritionRepository(empty)
    const first = await repository.createPatient({ fullName: 'Paciente Um', birthDate: '1990-01-01', phone: '(11) 90000-0001', email: 'um@demo.local', status: 'active' })
    const second = await repository.createPatient({ fullName: 'Paciente Dois', birthDate: '1991-01-01', phone: '(11) 90000-0002', email: 'dois@demo.local', status: 'active' })
    const goal = await repository.saveHabitGoal({ patientId: first.id, title: 'Meta do primeiro paciente', description: '', status: 'active', sharedWithPatient: false, professionalPrivateNote: '', submissionKey: '20000000-0000-4000-8000-000000000001' })
    await expect(repository.saveHabitGoal({ ...goal, title: 'Tentativa concorrente' }, goal.id, 'timestamp-antigo')).rejects.toThrow('outra sessão')
    await expect(repository.saveHabitCheckIn({ patientId: second.id, goalId: goal.id, recordedOn: '2026-11-08', progress: 'difficulty', notes: '', difficulties: '', nextStep: '', sharedWithPatient: false, professionalPrivateNote: '', submissionKey: '20000000-0000-4000-8000-000000000002' })).rejects.toThrow('não encontrada')
  })

  it('salva avaliação estruturada e recordatório vinculados no modo demonstração', async () => {
    const repository=new DemoNutritionRepository(empty);const patient=await repository.createPatient({fullName:'Paciente Avaliação',birthDate:'1990-01-01',phone:'(11) 90000-0010',email:'avaliacao@demo.local',status:'active'})
    const evaluation=await repository.saveNutritionEvaluation({patientId:patient.id,evaluatedOn:'2026-11-08',consultationReason:'Contexto fictício',healthHistory:'',reportedAllergies:'',reportedMedications:'',previousNutritionCare:'',foodRestrictionsAndPreferences:'',usualMealSchedule:'',usualMealsCount:'',mealEnvironment:'',foodAccess:'',hydration:'',reportedDifficulties:'',professionalObservations:'',submissionKey:'50000000-0000-4000-8000-000000000010'})
    await repository.saveDietaryRecall24h({evaluationId:evaluation.id,patientId:patient.id,recallDate:'2026-11-07',meals:[{id:'meal-1',name:'Almoço',time:'12:00',foods:[{id:'food-1',name:'Preparação fictícia',quantity:''}],context:'',notes:''}],complementaryNotes:'',submissionKey:'50000000-0000-4000-8000-000000000011'})
    const snapshot=await repository.snapshot();expect(snapshot.nutritionEvaluations[0].consultationReason).toBe('Contexto fictício');expect(snapshot.dietaryRecalls24h[0].evaluationId).toBe(evaluation.id)
    await expect(repository.saveNutritionEvaluation({...evaluation,consultationReason:'Concorrente'},evaluation.id,'antigo')).rejects.toThrow('outra sessão')
  })

  it('cria, remarca e cancela agenda em memória com prevenção de conflito',async()=>{const repository=new DemoNutritionRepository(empty);const patient=await repository.createPatient({fullName:'Paciente Agenda',birthDate:'1990-01-01',phone:'(11) 90000-0099',email:'agenda@demo.local',status:'active'});const input={patientId:patient.id,category:'nutrition-consultation' as const,status:'scheduled' as const,title:'Consulta nutricional',privateTitle:'',administrativeNote:'',startsAt:'2027-01-10T12:00:00.000Z',endsAt:'2027-01-10T13:00:00.000Z',recurrenceFrequency:'none' as const};const created=await repository.saveAppointment(input);await expect(repository.saveAppointment({...input,startsAt:'2027-01-10T12:30:00.000Z',endsAt:'2027-01-10T13:30:00.000Z'})).rejects.toThrow('Conflito');const moved=await repository.saveAppointment({...input,startsAt:'2027-01-10T14:00:00.000Z',endsAt:'2027-01-10T15:00:00.000Z'},created.id,'occurrence',created.updatedAt);expect(moved.startsAt).toContain('14:00');await repository.cancelAppointment(moved.id,'occurrence',moved.updatedAt);expect((await repository.snapshot()).appointments[0].status).toBe('canceled')})

  it('registra cobrança, pagamentos parciais e estorno sem superar o saldo',async()=>{const repository=new DemoNutritionRepository(empty);const patient=await repository.createPatient({fullName:'Paciente Financeiro',birthDate:'1990-01-01',phone:'(11) 90000-0199',email:'financeiro@demo.local',status:'active'});const charge=await repository.saveFinancialCharge({patientId:patient.id,professionalId:'professional-1',description:'Consulta fictícia',amountCents:20000,dueDate:'2026-11-20',administrativeNote:''});const first=await repository.recordFinancialPayment({chargeId:charge.id,amountCents:8000,method:'pix',receivedAt:'2026-11-10',administrativeNote:'',idempotencyKey:'90000000-0000-4000-8000-000000000001',installmentNumber:1,installmentCount:2});await expect(repository.recordFinancialPayment({chargeId:charge.id,amountCents:13000,method:'cash',receivedAt:'2026-11-10',administrativeNote:'',idempotencyKey:'90000000-0000-4000-8000-000000000002'})).rejects.toThrow('superar');await repository.reverseFinancialPayment(first.id,'90000000-0000-4000-8000-000000000003','Estorno fictício');expect((await repository.snapshot()).financialPayments.map((item)=>item.kind)).toEqual(['reversal','receipt'])})

  it('impede cobrança duplicada por agendamento e requisição duplicada de pagamento',async()=>{const seed=structuredClone(empty);seed.patients.push({id:'p',fullName:'Paciente',birthDate:'1990-01-01',phone:'x',email:'p@demo.local',status:'active',createdAt:''});seed.appointments.push({id:'a',patientId:'p',professionalId:'u',professionalLabel:'Profissional',category:'follow-up',status:'scheduled',title:'Retorno',privateTitle:'',administrativeNote:'',startsAt:'2026-11-20T12:00:00Z',endsAt:'2026-11-20T13:00:00Z',recurrenceFrequency:'none',createdAt:'',updatedAt:''});const repository=new DemoNutritionRepository(seed);const input={patientId:'p',professionalId:'u',appointmentId:'a',description:'Retorno',amountCents:10000,dueDate:'2026-11-20',administrativeNote:''};const charge=await repository.saveFinancialCharge(input);await expect(repository.saveFinancialCharge(input)).rejects.toThrow('já possui');const payment={chargeId:charge.id,amountCents:5000,method:'pix' as const,receivedAt:'2026-11-20',administrativeNote:'',idempotencyKey:'90000000-0000-4000-8000-000000000010'};await repository.recordFinancialPayment(payment);await expect(repository.recordFinancialPayment(payment)).rejects.toThrow('já foi registrado')})
})
