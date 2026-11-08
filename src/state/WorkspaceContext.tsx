import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Appointment, AppointmentChangeScope, AppointmentInput, AssessmentInput, ClinicalProfileInput, DietaryRecall24h, DietaryRecall24hInput, FoodDiaryEntry, FoodDiaryEntryInput, HabitCheckIn, HabitCheckInInput, HabitGoal, HabitGoalInput, MealPlan, NutritionEvaluation, NutritionEvaluationInput, NutritionWorkspace, PatientInput, ProfessionalService, ProfessionalServiceInput } from '../domain/models'
import { DemoNutritionRepository, type NutritionRepository } from '../data/repository'

type WorkspaceContextValue = {
  workspace: NutritionWorkspace
  loading: boolean
  error: string | null
  createPatient: (input: PatientInput) => Promise<string>
  updatePatient: (id: string, input: PatientInput) => Promise<void>
  saveClinicalProfile: (patientId: string, input: ClinicalProfileInput, expectedUpdatedAt?: string) => Promise<void>
  createAssessment: (input: AssessmentInput) => Promise<void>
  saveMealPlan: (plan: MealPlan, summary: string) => Promise<MealPlan>
  saveFoodDiaryEntry: (input: FoodDiaryEntryInput, entry?: FoodDiaryEntry) => Promise<FoodDiaryEntry>
  saveHabitGoal: (input: HabitGoalInput, goal?: HabitGoal) => Promise<HabitGoal>
  saveHabitCheckIn: (input: HabitCheckInInput, checkIn?: HabitCheckIn) => Promise<HabitCheckIn>
  saveNutritionEvaluation: (input: NutritionEvaluationInput, evaluation?: NutritionEvaluation) => Promise<NutritionEvaluation>
  saveDietaryRecall24h: (input: DietaryRecall24hInput, recall?: DietaryRecall24h) => Promise<DietaryRecall24h>
  saveProfessionalService:(input:ProfessionalServiceInput,service?:ProfessionalService)=>Promise<ProfessionalService>
  saveAppointment:(input:AppointmentInput,appointment?:Appointment,scope?:AppointmentChangeScope)=>Promise<Appointment>
  cancelAppointment:(appointment:Appointment,scope:AppointmentChangeScope)=>Promise<void>
  refresh: () => Promise<void>
}

const emptyWorkspace: NutritionWorkspace = { patients: [], clinicalProfiles: [], assessments: [], mealPlans: [], foodDiaryEntries: [], habitGoals: [], habitCheckIns: [], nutritionEvaluations: [], dietaryRecalls24h: [], professionalServices: [], appointments: [] }
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
const defaultDemoRepository = new DemoNutritionRepository()

export function WorkspaceProvider({ children, repository = defaultDemoRepository }: { children: ReactNode; repository?: NutritionRepository }) {
  const [workspace, setWorkspace] = useState(emptyWorkspace)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      setError(null)
      setWorkspace(await repository.snapshot())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [repository])

  const value = useMemo<WorkspaceContextValue>(() => ({
    workspace,
    loading,
    error,
    refresh,
    async createPatient(input) {
      const patient = await repository.createPatient(input)
      await refresh()
      return patient.id
    },
    async updatePatient(id, input) {
      await repository.updatePatient(id, input)
      await refresh()
    },
    async saveClinicalProfile(patientId, input, expectedUpdatedAt) {
      await repository.saveClinicalProfile(patientId, input, expectedUpdatedAt)
      await refresh()
    },
    async createAssessment(input) {
      await repository.createAssessment(input)
      await refresh()
    },
    async saveMealPlan(plan, summary) {
      const saved = await repository.saveMealPlan(plan, summary)
      await refresh()
      return saved
    },
    async saveFoodDiaryEntry(input, entry) {
      const saved = await repository.saveFoodDiaryEntry(input, entry?.id, entry?.updatedAt)
      await refresh()
      return saved
    },
    async saveHabitGoal(input, goal) {
      const saved = await repository.saveHabitGoal(input, goal?.id, goal?.updatedAt)
      await refresh()
      return saved
    },
    async saveHabitCheckIn(input, checkIn) {
      const saved = await repository.saveHabitCheckIn(input, checkIn?.id, checkIn?.updatedAt)
      await refresh()
      return saved
    },
    async saveNutritionEvaluation(input, evaluation) {
      const saved = await repository.saveNutritionEvaluation(input, evaluation?.id, evaluation?.updatedAt)
      await refresh(); return saved
    },
    async saveDietaryRecall24h(input, recall) {
      const saved = await repository.saveDietaryRecall24h(input, recall?.id, recall?.updatedAt)
      await refresh(); return saved
    },
    async saveProfessionalService(input,service){const saved=await repository.saveProfessionalService(input,service?.id);await refresh();return saved},
    async saveAppointment(input,appointment,scope='occurrence'){const saved=await repository.saveAppointment(input,appointment?.id,scope,appointment?.updatedAt);await refresh();return saved},
    async cancelAppointment(appointment,scope){await repository.cancelAppointment(appointment.id,scope,appointment.updatedAt);await refresh()},
  }), [workspace, loading, error, repository])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace deve ser usado dentro de WorkspaceProvider.')
  return value
}
