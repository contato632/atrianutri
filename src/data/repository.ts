import { calculateBmi } from '../domain/nutrition'
import type { Assessment, AssessmentInput, ClinicalProfileInput, PatientClinical, MealPlan, NutritionWorkspace, PatientAdministrative, PatientInput } from '../domain/models'
import { demoWorkspace } from './demo-data'

export interface NutritionRepository {
  snapshot(): Promise<NutritionWorkspace>
  createPatient(input: PatientInput): Promise<PatientAdministrative>
  updatePatient(id: string, input: PatientInput): Promise<PatientAdministrative>
  saveClinicalProfile(patientId: string, input: ClinicalProfileInput, expectedUpdatedAt?: string): Promise<PatientClinical>
  createAssessment(input: AssessmentInput): Promise<Assessment>
  saveMealPlan(plan: MealPlan, summary: string): Promise<MealPlan>
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
}
