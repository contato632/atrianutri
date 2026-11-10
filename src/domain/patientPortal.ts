import type { Appointment, Assessment, FoodDiaryEntry, HabitCheckIn, HabitGoal, MealPlan, NutritionWorkspace, PatientAdministrative } from './models'
import { activePatientLink, publishedPlanVersion } from './patientConnection'

export type PatientPortalSnapshot = {
  patient: Pick<PatientAdministrative, 'id' | 'fullName' | 'status'>
  nutritionist: { name: string; registration: string }
  nextAppointment?: Pick<Appointment, 'id' | 'title' | 'startsAt' | 'endsAt' | 'professionalLabel'>
  plan?: MealPlan
  diaryEntries: Array<Omit<FoodDiaryEntry, 'professionalPrivateNote'>>
  goals: Array<Omit<HabitGoal, 'professionalPrivateNote'>>
  checkIns: Array<Omit<HabitCheckIn, 'professionalPrivateNote'>>
  assessments: Array<Omit<Assessment, 'notes'>>
}

export const demoPatientAccess = {
  email: 'ana.exemplo@demo.local',
  code: 'ATRIA-DEMO',
  patientId: 'demo-patient-ana',
  linked: true,
} as const

const withoutPrivateNote = <T extends { professionalPrivateNote: string }>(record: T): Omit<T, 'professionalPrivateNote'> => {
  const { professionalPrivateNote: _private, ...safe } = record
  return safe
}

export function patientPortalSnapshot(workspace: NutritionWorkspace, patientId: string, organizationId = 'demo-organization'): PatientPortalSnapshot {
  const patient = workspace.patients.find((item) => item.id === patientId)
  if (!patient) throw new Error('Vínculo de paciente não encontrado ou suspenso.')
  const link = activePatientLink(workspace.patientLinks ?? [], organizationId, patientId)
  if (!link) throw new Error('Vínculo de paciente não encontrado ou suspenso.')
  const plan = publishedPlanVersion(workspace.mealPlans, workspace.mealPlanPublications ?? [], organizationId, patientId)
  const goals = workspace.habitGoals.filter((item) => item.patientId === patientId && item.sharedWithPatient).map(withoutPrivateNote)
  const goalIds = new Set(goals.map((item) => item.id))
  const now = Date.now()
  const nextAppointment = workspace.appointments
    .filter((item) => item.patientId === patientId && ['scheduled', 'confirmed'].includes(item.status) && new Date(item.startsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
  return {
    patient: { id: patient.id, fullName: patient.fullName, status: patient.status },
    nutritionist: { name: link.professionalName, registration: 'CRN-5 00000 · identificação fictícia' },
    nextAppointment: nextAppointment && { id: nextAppointment.id, title: nextAppointment.title, startsAt: nextAppointment.startsAt, endsAt: nextAppointment.endsAt, professionalLabel: nextAppointment.professionalLabel },
    plan: plan ? structuredClone(plan) : undefined,
    diaryEntries: workspace.foodDiaryEntries.filter((item) => item.patientId === patientId && (item.source === 'patient' || item.sharedWithPatient)).map(withoutPrivateNote),
    goals,
    checkIns: workspace.habitCheckIns.filter((item) => item.patientId === patientId && goalIds.has(item.goalId) && (item.source === 'patient' || item.sharedWithPatient)).map(withoutPrivateNote),
    assessments: workspace.assessments.filter((item) => item.patientId === patientId).map(({ notes: _notes, ...safe }) => safe).sort((a, b) => a.assessedAt.localeCompare(b.assessedAt)),
  }
}

export function authenticateDemoPatient(email: string, code: string) {
  const normalizedEmail = email.trim().toLocaleLowerCase('pt-BR')
  if (normalizedEmail !== demoPatientAccess.email || code !== demoPatientAccess.code) throw new Error('Conta fictícia ou código de demonstração inválido.')
  if (!demoPatientAccess.linked) throw new Error('Este acesso não possui vínculo ativo com um profissional.')
  return demoPatientAccess.patientId
}
