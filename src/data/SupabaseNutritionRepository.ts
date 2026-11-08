import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Assessment,
  AssessmentInput,
  Meal,
  MealPlan,
  NutritionWorkspace,
  PatientAdministrative,
  PatientClinical,
  PatientInput,
  PatientStatus,
} from '../domain/models'
import type { NutritionRepository } from './repository'

type QueryError = { code?: string; message?: string } | null

export class RepositoryConflictError extends Error {
  constructor(message = 'Este registro foi alterado em outra sessão. Atualize os dados antes de tentar novamente.') {
    super(message)
    this.name = 'RepositoryConflictError'
  }
}

function repositoryError(error: QueryError, fallback: string): Error {
  if (error?.code === '40001' || error?.code === '23505') return new RepositoryConflictError()
  if (error?.code === '42501') return new Error('Você não possui permissão para realizar esta operação.')
  if (error?.code === '23503') return new Error('O vínculo entre organização, paciente e registro é inválido.')
  return new Error(fallback)
}

function requireData<T>(data: T | null, error: QueryError, fallback: string): T {
  if (error || data === null) throw repositoryError(error, fallback)
  return data
}

const toDatabaseStatus = (status: PatientStatus) => status === 'follow-up' ? 'follow_up' : status
const fromDatabaseStatus = (status: string): PatientStatus => status === 'follow_up' ? 'follow-up' : status as PatientStatus

function decodeMeals(value: unknown): Meal[] {
  if (!Array.isArray(value)) throw new Error('O servidor retornou uma versão de plano inválida.')
  return value.map((meal, mealIndex) => {
    if (!meal || typeof meal !== 'object') throw new Error('O servidor retornou uma refeição inválida.')
    const row = meal as Record<string, unknown>
    const foods = Array.isArray(row.foods) ? row.foods.map((food, foodIndex) => {
      if (!food || typeof food !== 'object') throw new Error('O servidor retornou um item alimentar inválido.')
      const item = food as Record<string, unknown>
      return {
        id: String(item.id ?? `food-${mealIndex}-${foodIndex}`),
        name: String(item.name ?? ''),
        quantity: String(item.quantity ?? ''),
      }
    }) : []
    return {
      id: String(row.id ?? `meal-${mealIndex}`),
      name: String(row.name ?? ''),
      time: String(row.time ?? ''),
      guidance: String(row.guidance ?? ''),
      foods,
    }
  })
}

export class SupabaseNutritionRepository implements NutritionRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly organizationId: string,
  ) {
    if (!organizationId) throw new Error('Selecione uma organização antes de acessar os dados.')
  }

  private async userId() {
    const { data, error } = await this.client.auth.getUser()
    if (error || !data.user) throw new Error('Sua identidade não pôde ser confirmada. Entre novamente.')
    return data.user.id
  }

  async snapshot(): Promise<NutritionWorkspace> {
    const [patientResult, clinicalResult, assessmentResult, planResult, versionResult] = await Promise.all([
      this.client.from('patients_administrative').select('id,full_name,birth_date,phone,email,status,next_appointment_at,created_at').eq('organization_id', this.organizationId).is('archived_at', null).order('full_name'),
      this.client.from('patient_clinical_profiles').select('patient_id,goal,professional_notes,updated_at').eq('organization_id', this.organizationId),
      this.client.from('nutrition_assessments').select('id,patient_id,assessed_at,weight_kg,height_cm,waist_cm,hip_cm,arm_cm,body_fat_percentage,bmi,notes,created_at').eq('organization_id', this.organizationId).order('assessed_at', { ascending: false }),
      this.client.from('meal_plans').select('id,patient_id,title,status,current_version,updated_at').eq('organization_id', this.organizationId).neq('status', 'archived').order('updated_at', { ascending: false }),
      this.client.from('meal_plan_versions').select('meal_plan_id,version,meals,change_summary,created_at').eq('organization_id', this.organizationId).order('version', { ascending: false }),
    ])

    const patientRows = requireData(patientResult.data, patientResult.error, 'Não foi possível carregar os pacientes.')
    const clinicalRows = requireData(clinicalResult.data, clinicalResult.error, 'Não foi possível carregar os dados clínicos.')
    const assessmentRows = requireData(assessmentResult.data, assessmentResult.error, 'Não foi possível carregar as avaliações.')
    const planRows = requireData(planResult.data, planResult.error, 'Não foi possível carregar os planos alimentares.')
    const versionRows = requireData(versionResult.data, versionResult.error, 'Não foi possível carregar as versões dos planos.')

    const patients: PatientAdministrative[] = patientRows.map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      birthDate: String(row.birth_date),
      phone: String(row.phone),
      email: String(row.email),
      status: fromDatabaseStatus(String(row.status)),
      nextAppointment: row.next_appointment_at ? String(row.next_appointment_at) : undefined,
      createdAt: String(row.created_at),
    }))
    const clinicalProfiles: PatientClinical[] = clinicalRows.map((row) => ({
      patientId: String(row.patient_id),
      goal: String(row.goal ?? ''),
      professionalNotes: String(row.professional_notes ?? ''),
      updatedAt: String(row.updated_at),
    }))
    const assessments: Assessment[] = assessmentRows.map((row) => ({
      id: String(row.id),
      patientId: String(row.patient_id),
      assessedAt: String(row.assessed_at),
      weightKg: Number(row.weight_kg),
      heightCm: Number(row.height_cm),
      waistCm: row.waist_cm === null ? undefined : Number(row.waist_cm),
      hipCm: row.hip_cm === null ? undefined : Number(row.hip_cm),
      armCm: row.arm_cm === null ? undefined : Number(row.arm_cm),
      bodyFatPercentage: row.body_fat_percentage === null ? undefined : Number(row.body_fat_percentage),
      bmi: Number(row.bmi),
      notes: String(row.notes ?? ''),
      createdAt: String(row.created_at),
    }))
    const mealPlans: MealPlan[] = planRows.map((row) => {
      const versions = versionRows.filter((version) => version.meal_plan_id === row.id)
      const current = versions.find((version) => Number(version.version) === Number(row.current_version))
      return {
        id: String(row.id),
        patientId: String(row.patient_id),
        title: String(row.title),
        status: row.status === 'active' ? 'active' : 'draft',
        version: Number(row.current_version),
        updatedAt: String(row.updated_at),
        meals: decodeMeals(current?.meals ?? []),
        revisions: [...versions].reverse().map((version) => ({
          version: Number(version.version),
          savedAt: String(version.created_at),
          summary: String(version.change_summary ?? ''),
        })),
      }
    })

    return { patients, clinicalProfiles, assessments, mealPlans }
  }

  async createPatient(input: PatientInput) {
    const { data, error } = await this.client.rpc('create_patient_administrative', {
      p_organization_id: this.organizationId,
      p_full_name: input.fullName,
      p_birth_date: input.birthDate,
      p_email: input.email,
      p_phone: input.phone,
      p_status: toDatabaseStatus(input.status),
      p_next_appointment_at: input.nextAppointment ?? null,
    })
    const row = requireData(Array.isArray(data) ? data[0] : data, error, 'O paciente não foi confirmado pelo servidor.')
    return {
      id: String(row.id), fullName: String(row.full_name), birthDate: String(row.birth_date),
      phone: String(row.phone), email: String(row.email), status: fromDatabaseStatus(String(row.status)),
      nextAppointment: row.next_appointment_at ? String(row.next_appointment_at) : undefined,
      createdAt: String(row.created_at),
    } satisfies PatientAdministrative
  }

  async updatePatient(patientId: string, input: PatientInput) {
    const { data, error } = await this.client.from('patients_administrative').update({
      full_name: input.fullName,
      birth_date: input.birthDate,
      phone: input.phone,
      email: input.email,
      status: toDatabaseStatus(input.status),
      next_appointment_at: input.nextAppointment ?? null,
    }).eq('organization_id', this.organizationId).eq('id', patientId).select('id,full_name,birth_date,phone,email,status,next_appointment_at,created_at').maybeSingle()
    const row = requireData(data, error, 'A alteração do paciente não foi confirmada pelo servidor.')
    return {
      id: String(row.id), fullName: String(row.full_name), birthDate: String(row.birth_date),
      phone: String(row.phone), email: String(row.email), status: fromDatabaseStatus(String(row.status)),
      nextAppointment: row.next_appointment_at ? String(row.next_appointment_at) : undefined,
      createdAt: String(row.created_at),
    }
  }

  async createAssessment(input: AssessmentInput) {
    const actor = await this.userId()
    const { data, error } = await this.client.from('nutrition_assessments').insert({
      organization_id: this.organizationId,
      patient_id: input.patientId,
      assessed_at: input.assessedAt,
      weight_kg: input.weightKg,
      height_cm: input.heightCm,
      waist_cm: input.waistCm ?? null,
      hip_cm: input.hipCm ?? null,
      arm_cm: input.armCm ?? null,
      body_fat_percentage: input.bodyFatPercentage ?? null,
      notes: input.notes,
      created_by: actor,
    }).select('id,patient_id,assessed_at,weight_kg,height_cm,waist_cm,hip_cm,arm_cm,body_fat_percentage,bmi,notes,created_at').single()
    const row = requireData(data, error, 'A avaliação não foi confirmada pelo servidor.')
    return {
      id: String(row.id), patientId: String(row.patient_id), assessedAt: String(row.assessed_at),
      weightKg: Number(row.weight_kg), heightCm: Number(row.height_cm),
      waistCm: row.waist_cm === null ? undefined : Number(row.waist_cm),
      hipCm: row.hip_cm === null ? undefined : Number(row.hip_cm),
      armCm: row.arm_cm === null ? undefined : Number(row.arm_cm),
      bodyFatPercentage: row.body_fat_percentage === null ? undefined : Number(row.body_fat_percentage),
      bmi: Number(row.bmi), notes: String(row.notes ?? ''), createdAt: String(row.created_at),
    }
  }

  async saveMealPlan(plan: MealPlan, summary: string) {
    const procedure = plan.version === 0 ? 'create_meal_plan_draft' : 'save_meal_plan_version'
    const params = plan.version === 0 ? {
      p_organization_id: this.organizationId,
      p_patient_id: plan.patientId,
      p_title: plan.title,
      p_meals: plan.meals,
      p_change_summary: summary,
    } : {
      p_meal_plan_id: plan.id,
      p_expected_version: plan.version,
      p_title: plan.title,
      p_meals: plan.meals,
      p_change_summary: summary,
    }
    const { data, error } = await this.client.rpc(procedure, params)
    const result = requireData(Array.isArray(data) ? data[0] : data, error, 'O rascunho não foi confirmado pelo servidor.')
    if (!result?.saved_plan_id || !result.saved_version || !result.saved_at) {
      throw new Error('O servidor não confirmou a versão salva.')
    }
    return {
      ...structuredClone(plan),
      id: String(result.saved_plan_id),
      version: Number(result.saved_version),
      updatedAt: String(result.saved_at),
      revisions: [...plan.revisions, { version: Number(result.saved_version), savedAt: String(result.saved_at), summary }],
    }
  }
}
