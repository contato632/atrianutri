import { describe, expect, it } from 'vitest'
import type { MealPlan, NutritionWorkspace } from '../domain/models'
import { DemoNutritionRepository } from './repository'

const empty: NutritionWorkspace = { patients: [], clinicalProfiles: [], assessments: [], mealPlans: [] }

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
    const plan: MealPlan = { id: 'plan-test', patientId: patient.id, title: 'Plano manual', status: 'draft', version: 0, updatedAt: '', meals: [], revisions: [] }
    const first = await repository.saveMealPlan(plan, 'Criação')
    const second = await repository.saveMealPlan({ ...first, title: 'Plano ajustado' }, 'Ajuste')
    expect(second.version).toBe(2)
    expect(second.revisions.map((item) => item.summary)).toEqual(['Criação', 'Ajuste'])
  })
})
