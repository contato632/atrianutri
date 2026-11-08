import { calculateBmi } from '../domain/nutrition'
import type { Assessment, AssessmentInput, ClinicalProfileInput, FoodDiaryEntry, FoodDiaryEntryInput, HabitCheckIn, HabitCheckInInput, HabitGoal, HabitGoalInput, PatientClinical, MealPlan, NutritionWorkspace, PatientAdministrative, PatientInput } from '../domain/models'
import { demoWorkspace } from './demo-data'

export interface NutritionRepository {
  snapshot(): Promise<NutritionWorkspace>
  createPatient(input: PatientInput): Promise<PatientAdministrative>
  updatePatient(id: string, input: PatientInput): Promise<PatientAdministrative>
  saveClinicalProfile(patientId: string, input: ClinicalProfileInput, expectedUpdatedAt?: string): Promise<PatientClinical>
  createAssessment(input: AssessmentInput): Promise<Assessment>
  saveMealPlan(plan: MealPlan, summary: string): Promise<MealPlan>
  saveFoodDiaryEntry(input: FoodDiaryEntryInput, entryId?: string, expectedUpdatedAt?: string): Promise<FoodDiaryEntry>
  saveHabitGoal(input: HabitGoalInput, goalId?: string, expectedUpdatedAt?: string): Promise<HabitGoal>
  saveHabitCheckIn(input: HabitCheckInInput, checkInId?: string, expectedUpdatedAt?: string): Promise<HabitCheckIn>
}

const clone = <T,>(value: T): T => structuredClone(value)
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

export class DemoNutritionRepository implements NutritionRepository {
  private data: NutritionWorkspace

  constructor(seed: NutritionWorkspace = demoWorkspace) {
    this.data = clone(seed)
  }

  async snapshot() {
    return clone(this.data)
  }

  async createPatient(input: PatientInput) {
    const patient: PatientAdministrative = { ...input, id: id('patient'), createdAt: new Date().toISOString() }
    this.data.patients = [patient, ...this.data.patients]
    this.data.clinicalProfiles.push({ patientId: patient.id, goal: '', foodHistory: '', habits: '', professionalNotes: '', updatedAt: patient.createdAt })
    return clone(patient)
  }

  async updatePatient(patientId: string, input: PatientInput) {
    const index = this.data.patients.findIndex((patient) => patient.id === patientId)
    if (index === -1) throw new Error('Paciente não encontrado.')
    const updated = { ...this.data.patients[index], ...input }
    this.data.patients[index] = updated
    return clone(updated)
  }

  async saveClinicalProfile(patientId: string, input: ClinicalProfileInput, expectedUpdatedAt?: string) {
    if (!this.data.patients.some((patient) => patient.id === patientId)) throw new Error('Paciente não encontrado.')
    const index = this.data.clinicalProfiles.findIndex((profile) => profile.patientId === patientId)
    const previous = index >= 0 ? this.data.clinicalProfiles[index] : null
    if ((expectedUpdatedAt && previous?.updatedAt !== expectedUpdatedAt) || (!expectedUpdatedAt && previous)) {
      throw new Error('A anamnese foi alterada em outra sessão. Atualize os dados antes de salvar.')
    }
    const saved: PatientClinical = { patientId, ...clone(input), updatedAt: new Date().toISOString() }
    if (index >= 0) this.data.clinicalProfiles[index] = saved
    else this.data.clinicalProfiles.push(saved)
    return clone(saved)
  }

  async createAssessment(input: AssessmentInput) {
    if (!this.data.patients.some((patient) => patient.id === input.patientId)) throw new Error('Paciente não encontrado.')
    const assessment: Assessment = {
      ...input,
      id: id('assessment'),
      bmi: calculateBmi(input.weightKg, input.heightCm),
      createdAt: new Date().toISOString(),
    }
    this.data.assessments = [assessment, ...this.data.assessments]
    return clone(assessment)
  }

  async saveMealPlan(plan: MealPlan, summary: string) {
    const existing = this.data.mealPlans.find((item) => item.id === plan.id)
    const nextVersion = existing ? existing.version + 1 : 1
    const savedAt = new Date().toISOString()
    const saved: MealPlan = {
      ...clone(plan),
      id: plan.id || id('plan'),
      version: nextVersion,
      updatedAt: savedAt,
      revisions: [...(existing?.revisions ?? []), { version: nextVersion, savedAt, summary }],
    }
    this.data.mealPlans = [saved, ...this.data.mealPlans.filter((item) => item.id !== saved.id)]
    return clone(saved)
  }

  async saveFoodDiaryEntry(input: FoodDiaryEntryInput, entryId?: string, expectedUpdatedAt?: string) {
    if (!this.data.patients.some((patient) => patient.id === input.patientId)) throw new Error('Paciente não encontrado.')
    const index = entryId ? this.data.foodDiaryEntries.findIndex((entry) => entry.id === entryId) : -1
    const previous = index >= 0 ? this.data.foodDiaryEntries[index] : null
    if (entryId && !previous) throw new Error('Registro do diário não encontrado.')
    if (previous && expectedUpdatedAt !== previous.updatedAt) throw new Error('O registro foi alterado em outra sessão. Atualize antes de salvar.')
    const timestamp = new Date().toISOString()
    const saved: FoodDiaryEntry = { ...clone(input), id: previous?.id ?? id('diary'), source: 'professional', createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp }
    if (index >= 0) this.data.foodDiaryEntries[index] = saved
    else this.data.foodDiaryEntries.unshift(saved)
    return clone(saved)
  }

  async saveHabitGoal(input: HabitGoalInput, goalId?: string, expectedUpdatedAt?: string) {
    if (!this.data.patients.some((patient) => patient.id === input.patientId)) throw new Error('Paciente não encontrado.')
    const index = goalId ? this.data.habitGoals.findIndex((goal) => goal.id === goalId) : -1
    const previous = index >= 0 ? this.data.habitGoals[index] : null
    if (goalId && !previous) throw new Error('Meta de hábito não encontrada.')
    if (previous && expectedUpdatedAt !== previous.updatedAt) throw new Error('A meta foi alterada em outra sessão. Atualize antes de salvar.')
    const timestamp = new Date().toISOString()
    const saved: HabitGoal = { ...clone(input), id: previous?.id ?? id('habit'), createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp }
    if (index >= 0) this.data.habitGoals[index] = saved
    else this.data.habitGoals.unshift(saved)
    return clone(saved)
  }

  async saveHabitCheckIn(input: HabitCheckInInput, checkInId?: string, expectedUpdatedAt?: string) {
    const goal = this.data.habitGoals.find((item) => item.id === input.goalId && item.patientId === input.patientId)
    if (!goal) throw new Error('Meta de hábito não encontrada para este paciente.')
    const index = checkInId ? this.data.habitCheckIns.findIndex((item) => item.id === checkInId) : -1
    const previous = index >= 0 ? this.data.habitCheckIns[index] : null
    if (checkInId && !previous) throw new Error('Acompanhamento de hábito não encontrado.')
    if (previous && expectedUpdatedAt !== previous.updatedAt) throw new Error('O acompanhamento foi alterado em outra sessão. Atualize antes de salvar.')
    const timestamp = new Date().toISOString()
    const saved: HabitCheckIn = { ...clone(input), id: previous?.id ?? id('checkin'), source: 'professional', createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp }
    if (index >= 0) this.data.habitCheckIns[index] = saved
    else this.data.habitCheckIns.unshift(saved)
    return clone(saved)
  }
}
