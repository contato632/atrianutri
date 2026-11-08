import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AssessmentInput, ClinicalProfileInput, MealPlan, NutritionWorkspace, PatientInput } from '../domain/models'
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
  refresh: () => Promise<void>
}

const emptyWorkspace: NutritionWorkspace = { patients: [], clinicalProfiles: [], assessments: [], mealPlans: [] }
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
  }), [workspace, loading, error, repository])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace deve ser usado dentro de WorkspaceProvider.')
  return value
}
