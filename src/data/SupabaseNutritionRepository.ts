import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Appointment,
  AppointmentChangeScope,
  AppointmentInput,
  Assessment,
  AssessmentInput,
  ClinicalProfileInput,
  DietaryRecall24h,
  DietaryRecall24hInput,
  FinancialCharge,
  FinancialChargeInput,
  FinancialExpense,
  FinancialExpenseInput,
  FinancialPayment,
  FinancialPaymentInput,
  FoodDiaryEntry,
  FoodDiaryEntryInput,
  FoodDiaryMealType,
  HabitCheckIn,
  HabitCheckInInput,
  HabitGoal,
  HabitGoalInput,
  Meal,
  MealPlan,
  NutritionEvaluation,
  NutritionEvaluationInput,
  NutritionWorkspace,
  PatientAdministrative,
  PatientClinical,
  PatientInput,
  PatientStatus,
  ProfessionalService,
  ProfessionalServiceInput,
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
  if (error?.code === '23P01') return new Error('Conflito de horário com outro compromisso deste profissional.')
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
const toDatabaseMealType = (value: FoodDiaryMealType) => value.replaceAll('-', '_')
const fromDatabaseMealType = (value: string) => value.replaceAll('_', '-') as FoodDiaryMealType
const toDatabaseProgress = (value: HabitCheckInInput['progress']) => value.replaceAll('-', '_')
const fromDatabaseProgress = (value: string) => value.replaceAll('_', '-') as HabitCheckIn['progress']

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
    const [patientResult, clinicalResult, assessmentResult, planResult, versionResult, diaryResult, goalResult, checkInResult, privateNoteResult, evaluationResult, recallResult, serviceResult, appointmentResult, seriesResult, appointmentPrivateResult, chargeResult, paymentResult, expenseCategoryResult, expenseResult] = await Promise.all([
      this.client.from('patients_administrative').select('id,full_name,birth_date,phone,email,status,next_appointment_at,created_at').eq('organization_id', this.organizationId).is('archived_at', null).order('full_name'),
      this.client.from('patient_clinical_profiles').select('patient_id,goal,food_history,habits,professional_notes,updated_at').eq('organization_id', this.organizationId),
      this.client.from('nutrition_assessments').select('id,patient_id,assessed_at,weight_kg,height_cm,waist_cm,hip_cm,arm_cm,body_fat_percentage,bmi,notes,created_at').eq('organization_id', this.organizationId).order('assessed_at', { ascending: false }),
      this.client.from('meal_plans').select('id,patient_id,title,status,current_version,updated_at').eq('organization_id', this.organizationId).neq('status', 'archived').order('updated_at', { ascending: false }),
      this.client.from('meal_plan_versions').select('meal_plan_id,version,meals,change_summary,created_at').eq('organization_id', this.organizationId).order('version', { ascending: false }),
      this.client.from('food_diary_entries').select('id,patient_id,entry_date,meal_time,meal_type,foods,notes,eating_context,hunger_before,satiety_after,routine_changes,source,shared_with_patient_at,submission_key,created_at,updated_at').eq('organization_id', this.organizationId).order('entry_date', { ascending: false }).order('meal_time', { ascending: false }),
      this.client.from('habit_goals').select('id,patient_id,title,description,status,shared_with_patient_at,submission_key,created_at,updated_at').eq('organization_id', this.organizationId).order('updated_at', { ascending: false }),
      this.client.from('habit_check_ins').select('id,habit_goal_id,patient_id,recorded_on,progress,notes,difficulties,next_step,source,shared_with_patient_at,submission_key,created_at,updated_at').eq('organization_id', this.organizationId).order('recorded_on', { ascending: false }),
      this.client.from('clinical_private_notes').select('food_diary_entry_id,habit_goal_id,habit_check_in_id,content').eq('organization_id', this.organizationId),
      this.client.from('nutrition_evaluations').select('id,patient_id,evaluated_on,consultation_reason,health_history,reported_allergies,reported_medications,previous_nutrition_care,food_restrictions_and_preferences,usual_meal_schedule,usual_meals_count,meal_environment,food_access,hydration,reported_difficulties,professional_observations,created_by,submission_key,created_at,updated_at').eq('organization_id', this.organizationId).order('evaluated_on', { ascending: false }),
      this.client.from('dietary_recalls_24h').select('id,nutrition_evaluation_id,patient_id,recall_date,meals,complementary_notes,created_by,submission_key,created_at,updated_at').eq('organization_id', this.organizationId).order('recall_date', { ascending: false }),
      this.client.from('professional_services').select('id,name,default_duration_minutes,price_cents,active,created_at,updated_at').eq('organization_id',this.organizationId).order('name'),
      this.client.from('appointments').select('id,series_id,patient_id,service_id,professional_user_id,category,status,title,administrative_note,starts_at,ends_at,created_at,updated_at').eq('organization_id',this.organizationId).is('archived_at',null).order('starts_at'),
      this.client.from('appointment_series').select('id,recurrence,recurrence_ends_on').eq('organization_id',this.organizationId),
      this.client.from('appointment_private_details').select('appointment_id,private_title').eq('organization_id',this.organizationId),
      this.client.from('financial_charges').select('id,patient_id,professional_user_id,appointment_id,service_id,description,amount_cents,due_date,administrative_note,canceled_at,created_at,updated_at').eq('organization_id',this.organizationId).order('due_date',{ascending:false}),
      this.client.from('financial_payments').select('id,charge_id,kind,amount_cents,method,received_at,administrative_note,idempotency_key,reverses_payment_id,installment_number,installment_count,created_at,created_by').eq('organization_id',this.organizationId).order('received_at',{ascending:false}),
      this.client.from('expense_categories').select('id,name,active').eq('organization_id',this.organizationId).order('name'),
      this.client.from('financial_expenses').select('id,category_id,description,amount_cents,competence_date,due_date,paid_at,status,administrative_note,created_at,updated_at').eq('organization_id',this.organizationId).order('due_date',{ascending:false}),
    ])

    const patientRows = requireData(patientResult.data, patientResult.error, 'Não foi possível carregar os pacientes.')
    const clinicalRows = requireData(clinicalResult.data, clinicalResult.error, 'Não foi possível carregar os dados clínicos.')
    const assessmentRows = requireData(assessmentResult.data, assessmentResult.error, 'Não foi possível carregar as avaliações.')
    const planRows = requireData(planResult.data, planResult.error, 'Não foi possível carregar os planos alimentares.')
    const versionRows = requireData(versionResult.data, versionResult.error, 'Não foi possível carregar as versões dos planos.')
    const diaryRows = requireData(diaryResult.data, diaryResult.error, 'Não foi possível carregar o diário alimentar.')
    const goalRows = requireData(goalResult.data, goalResult.error, 'Não foi possível carregar as metas de hábitos.')
    const checkInRows = requireData(checkInResult.data, checkInResult.error, 'Não foi possível carregar o acompanhamento de hábitos.')
    const privateNoteRows = requireData(privateNoteResult.data, privateNoteResult.error, 'Não foi possível carregar as observações profissionais.')
    const evaluationRows = requireData(evaluationResult.data, evaluationResult.error, 'Não foi possível carregar as avaliações nutricionais.')
    const recallRows = requireData(recallResult.data, recallResult.error, 'Não foi possível carregar os recordatórios de 24 horas.')
    const serviceRows=requireData(serviceResult.data,serviceResult.error,'Não foi possível carregar os serviços.')
    const appointmentRows=requireData(appointmentResult.data,appointmentResult.error,'Não foi possível carregar a agenda.')
    const seriesRows=requireData(seriesResult.data,seriesResult.error,'Não foi possível carregar as recorrências.')
    const appointmentPrivateRows=requireData(appointmentPrivateResult.data,appointmentPrivateResult.error,'Não foi possível carregar os detalhes particulares.')
    const chargeRows=requireData(chargeResult.data,chargeResult.error,'Não foi possível carregar as cobranças.')
    const paymentRows=requireData(paymentResult.data,paymentResult.error,'Não foi possível carregar os recebimentos.')
    const expenseCategoryRows=requireData(expenseCategoryResult.data,expenseCategoryResult.error,'Não foi possível carregar as categorias de despesa.')
    const expenseRows=requireData(expenseResult.data,expenseResult.error,'Não foi possível carregar as despesas.')
    const privateNote = (field: 'food_diary_entry_id' | 'habit_goal_id' | 'habit_check_in_id', id: unknown) => String(privateNoteRows.find((row) => row[field] === id)?.content ?? '')

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
      foodHistory: String(row.food_history ?? ''),
      habits: String(row.habits ?? ''),
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

    const foodDiaryEntries: FoodDiaryEntry[] = diaryRows.map((row) => ({
      id: String(row.id), patientId: String(row.patient_id), entryDate: String(row.entry_date), mealTime: String(row.meal_time).slice(0, 5),
      mealType: fromDatabaseMealType(String(row.meal_type)), foods: decodeMeals([{ foods: row.foods }])[0].foods,
      notes: String(row.notes ?? ''), eatingContext: String(row.eating_context ?? ''), hungerBefore: String(row.hunger_before ?? ''), satietyAfter: String(row.satiety_after ?? ''), routineChanges: String(row.routine_changes ?? ''),
      source: row.source === 'patient' ? 'patient' : 'professional', sharedWithPatient: Boolean(row.shared_with_patient_at), professionalPrivateNote: privateNote('food_diary_entry_id', row.id),
      submissionKey: String(row.submission_key), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }))
    const habitGoals: HabitGoal[] = goalRows.map((row) => ({
      id: String(row.id), patientId: String(row.patient_id), title: String(row.title), description: String(row.description ?? ''), status: row.status as HabitGoal['status'],
      sharedWithPatient: Boolean(row.shared_with_patient_at), professionalPrivateNote: privateNote('habit_goal_id', row.id), submissionKey: String(row.submission_key), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }))
    const habitCheckIns: HabitCheckIn[] = checkInRows.map((row) => ({
      id: String(row.id), goalId: String(row.habit_goal_id), patientId: String(row.patient_id), recordedOn: String(row.recorded_on), progress: fromDatabaseProgress(String(row.progress)),
      notes: String(row.notes ?? ''), difficulties: String(row.difficulties ?? ''), nextStep: String(row.next_step ?? ''), source: row.source === 'patient' ? 'patient' : 'professional',
      sharedWithPatient: Boolean(row.shared_with_patient_at), professionalPrivateNote: privateNote('habit_check_in_id', row.id), submissionKey: String(row.submission_key), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }))

    const nutritionEvaluations: NutritionEvaluation[] = evaluationRows.map((row) => ({
      id:String(row.id),patientId:String(row.patient_id),evaluatedOn:String(row.evaluated_on),consultationReason:String(row.consultation_reason??''),healthHistory:String(row.health_history??''),reportedAllergies:String(row.reported_allergies??''),reportedMedications:String(row.reported_medications??''),previousNutritionCare:String(row.previous_nutrition_care??''),foodRestrictionsAndPreferences:String(row.food_restrictions_and_preferences??''),usualMealSchedule:String(row.usual_meal_schedule??''),usualMealsCount:String(row.usual_meals_count??''),mealEnvironment:String(row.meal_environment??''),foodAccess:String(row.food_access??''),hydration:String(row.hydration??''),reportedDifficulties:String(row.reported_difficulties??''),professionalObservations:String(row.professional_observations??''),authorLabel:`Profissional · ${String(row.created_by).slice(0,8)}`,submissionKey:String(row.submission_key),createdAt:String(row.created_at),updatedAt:String(row.updated_at),
    }))
    const dietaryRecalls24h: DietaryRecall24h[] = recallRows.map((row) => ({
      id:String(row.id),evaluationId:String(row.nutrition_evaluation_id),patientId:String(row.patient_id),recallDate:String(row.recall_date),
      meals:Array.isArray(row.meals) ? row.meals.map((meal, index) => { const item=meal as Record<string,unknown>; return { id:String(item.id??`recall-meal-${index}`),name:String(item.name??''),time:String(item.time??''),context:String(item.context??''),notes:String(item.notes??''),foods:decodeMeals([{foods:item.foods}])[0].foods } }) : [],
      complementaryNotes:String(row.complementary_notes??''),authorLabel:`Profissional · ${String(row.created_by).slice(0,8)}`,submissionKey:String(row.submission_key),createdAt:String(row.created_at),updatedAt:String(row.updated_at),
    }))
    const professionalServices:ProfessionalService[]=serviceRows.map((row)=>({id:String(row.id),name:String(row.name),defaultDurationMinutes:Number(row.default_duration_minutes),priceCents:row.price_cents===null?undefined:Number(row.price_cents),active:Boolean(row.active),createdAt:String(row.created_at),updatedAt:String(row.updated_at)}))
    const appointments:Appointment[]=appointmentRows.map((row)=>{const series=seriesRows.find((item)=>item.id===row.series_id);return{id:String(row.id),seriesId:row.series_id?String(row.series_id):undefined,patientId:row.patient_id?String(row.patient_id):undefined,serviceId:row.service_id?String(row.service_id):undefined,professionalId:String(row.professional_user_id),professionalLabel:`Profissional · ${String(row.professional_user_id).slice(0,8)}`,category:String(row.category).replaceAll('_','-') as Appointment['category'],status:String(row.status).replaceAll('_','-') as Appointment['status'],title:String(row.title),privateTitle:String(appointmentPrivateRows.find((item)=>item.appointment_id===row.id)?.private_title??''),administrativeNote:String(row.administrative_note??''),startsAt:String(row.starts_at),endsAt:String(row.ends_at),recurrenceFrequency:(series?String(series.recurrence):'none') as Appointment['recurrenceFrequency'],recurrenceEndsOn:series?.recurrence_ends_on?String(series.recurrence_ends_on):undefined,createdAt:String(row.created_at),updatedAt:String(row.updated_at)}})
    const financialCharges:FinancialCharge[]=chargeRows.map((row)=>({id:String(row.id),patientId:String(row.patient_id),professionalId:String(row.professional_user_id),appointmentId:row.appointment_id?String(row.appointment_id):undefined,serviceId:row.service_id?String(row.service_id):undefined,description:String(row.description),amountCents:Number(row.amount_cents),dueDate:String(row.due_date),administrativeNote:String(row.administrative_note??''),canceledAt:row.canceled_at?String(row.canceled_at):undefined,createdAt:String(row.created_at),updatedAt:String(row.updated_at)}))
    const financialPayments:FinancialPayment[]=paymentRows.map((row)=>({id:String(row.id),chargeId:String(row.charge_id),kind:String(row.kind) as FinancialPayment['kind'],amountCents:Number(row.amount_cents),method:String(row.method).replaceAll('_','-') as FinancialPayment['method'],receivedAt:String(row.received_at),administrativeNote:String(row.administrative_note??''),idempotencyKey:String(row.idempotency_key),reversesPaymentId:row.reverses_payment_id?String(row.reverses_payment_id):undefined,installmentNumber:row.installment_number===null?undefined:Number(row.installment_number),installmentCount:row.installment_count===null?undefined:Number(row.installment_count),createdAt:String(row.created_at),createdByLabel:`Profissional · ${String(row.created_by).slice(0,8)}`}))
    const expenseCategories=expenseCategoryRows.map((row)=>({id:String(row.id),name:String(row.name),active:Boolean(row.active)}))
    const financialExpenses:FinancialExpense[]=expenseRows.map((row)=>({id:String(row.id),categoryId:String(row.category_id),description:String(row.description),amountCents:Number(row.amount_cents),competenceDate:String(row.competence_date),dueDate:String(row.due_date),paidAt:row.paid_at?String(row.paid_at):undefined,status:String(row.status) as FinancialExpense['status'],administrativeNote:String(row.administrative_note??''),createdAt:String(row.created_at),updatedAt:String(row.updated_at)}))

    return { patients, clinicalProfiles, assessments, mealPlans, foodDiaryEntries, habitGoals, habitCheckIns, nutritionEvaluations, dietaryRecalls24h, professionalServices, appointments, financialCharges, financialPayments, expenseCategories, financialExpenses }
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

  async saveClinicalProfile(patientId: string, input: ClinicalProfileInput, expectedUpdatedAt?: string): Promise<PatientClinical> {
    if (!patientId) throw new Error('Selecione um paciente para registrar a anamnese.')
    const values = {
      goal: input.goal,
      food_history: input.foodHistory,
      habits: input.habits,
      professional_notes: input.professionalNotes,
    }
    const select = 'patient_id,goal,food_history,habits,professional_notes,updated_at'
    let result
    if (expectedUpdatedAt) {
      result = await this.client.from('patient_clinical_profiles')
        .update(values)
        .eq('organization_id', this.organizationId)
        .eq('patient_id', patientId)
        .eq('updated_at', expectedUpdatedAt)
        .select(select).maybeSingle()
      if (!result.error && !result.data) {
        throw new RepositoryConflictError('A anamnese foi alterada em outra sessão. Recarregue antes de salvar.')
      }
    } else {
      const actor = await this.userId()
      result = await this.client.from('patient_clinical_profiles')
        .insert({ ...values, organization_id: this.organizationId, patient_id: patientId, created_by: actor })
        .select(select).single()
    }
    const row = requireData(result.data, result.error, 'A anamnese não foi confirmada pelo servidor.')
    if (String(row.patient_id) !== patientId || !row.updated_at) throw new Error('O servidor não confirmou a anamnese.')
    return {
      patientId: String(row.patient_id),
      goal: String(row.goal ?? ''),
      foodHistory: String(row.food_history ?? ''),
      habits: String(row.habits ?? ''),
      professionalNotes: String(row.professional_notes ?? ''),
      updatedAt: String(row.updated_at),
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

  async saveFoodDiaryEntry(input: FoodDiaryEntryInput, entryId?: string, expectedUpdatedAt?: string) {
    const { data, error } = await this.client.rpc('save_food_diary_entry', {
      p_organization_id: this.organizationId, p_patient_id: input.patientId, p_entry_date: input.entryDate, p_meal_time: input.mealTime,
      p_meal_type: toDatabaseMealType(input.mealType), p_foods: input.foods, p_notes: input.notes, p_eating_context: input.eatingContext,
      p_hunger_before: input.hungerBefore, p_satiety_after: input.satietyAfter, p_routine_changes: input.routineChanges,
      p_shared_with_patient: input.sharedWithPatient, p_private_note: input.professionalPrivateNote, p_submission_key: input.submissionKey,
      p_entry_id: entryId ?? null, p_expected_updated_at: expectedUpdatedAt ?? null,
    })
    const confirmation = requireData(Array.isArray(data) ? data[0] : data, error, 'O diário alimentar não foi confirmado pelo servidor.')
    if (!confirmation?.saved_id || !confirmation.saved_updated_at) throw new Error('O servidor não confirmou o registro do diário.')
    return { ...structuredClone(input), id: String(confirmation.saved_id), source: 'professional' as const, createdAt: expectedUpdatedAt ? '' : String(confirmation.saved_updated_at), updatedAt: String(confirmation.saved_updated_at) }
  }

  async saveHabitGoal(input: HabitGoalInput, goalId?: string, expectedUpdatedAt?: string) {
    const { data, error } = await this.client.rpc('save_habit_goal', {
      p_organization_id: this.organizationId, p_patient_id: input.patientId, p_title: input.title, p_description: input.description,
      p_status: input.status, p_shared_with_patient: input.sharedWithPatient, p_private_note: input.professionalPrivateNote,
      p_submission_key: input.submissionKey, p_goal_id: goalId ?? null, p_expected_updated_at: expectedUpdatedAt ?? null,
    })
    const confirmation = requireData(Array.isArray(data) ? data[0] : data, error, 'A meta de hábito não foi confirmada pelo servidor.')
    if (!confirmation?.saved_id || !confirmation.saved_updated_at) throw new Error('O servidor não confirmou a meta de hábito.')
    return { ...structuredClone(input), id: String(confirmation.saved_id), createdAt: expectedUpdatedAt ? '' : String(confirmation.saved_updated_at), updatedAt: String(confirmation.saved_updated_at) }
  }

  async saveHabitCheckIn(input: HabitCheckInInput, checkInId?: string, expectedUpdatedAt?: string) {
    const { data, error } = await this.client.rpc('save_habit_check_in', {
      p_organization_id: this.organizationId, p_patient_id: input.patientId, p_habit_goal_id: input.goalId, p_recorded_on: input.recordedOn,
      p_progress: toDatabaseProgress(input.progress), p_notes: input.notes, p_difficulties: input.difficulties, p_next_step: input.nextStep,
      p_shared_with_patient: input.sharedWithPatient, p_private_note: input.professionalPrivateNote, p_submission_key: input.submissionKey,
      p_check_in_id: checkInId ?? null, p_expected_updated_at: expectedUpdatedAt ?? null,
    })
    const confirmation = requireData(Array.isArray(data) ? data[0] : data, error, 'O acompanhamento de hábito não foi confirmado pelo servidor.')
    if (!confirmation?.saved_id || !confirmation.saved_updated_at) throw new Error('O servidor não confirmou o acompanhamento de hábito.')
    return { ...structuredClone(input), id: String(confirmation.saved_id), source: 'professional' as const, createdAt: expectedUpdatedAt ? '' : String(confirmation.saved_updated_at), updatedAt: String(confirmation.saved_updated_at) }
  }

  async saveNutritionEvaluation(input: NutritionEvaluationInput, evaluationId?: string, expectedUpdatedAt?: string) {
    const { data,error }=await this.client.rpc('save_nutrition_evaluation',{p_organization_id:this.organizationId,p_patient_id:input.patientId,p_evaluated_on:input.evaluatedOn,p_consultation_reason:input.consultationReason,p_health_history:input.healthHistory,p_reported_allergies:input.reportedAllergies,p_reported_medications:input.reportedMedications,p_previous_nutrition_care:input.previousNutritionCare,p_food_restrictions_and_preferences:input.foodRestrictionsAndPreferences,p_usual_meal_schedule:input.usualMealSchedule,p_usual_meals_count:input.usualMealsCount,p_meal_environment:input.mealEnvironment,p_food_access:input.foodAccess,p_hydration:input.hydration,p_reported_difficulties:input.reportedDifficulties,p_professional_observations:input.professionalObservations,p_submission_key:input.submissionKey,p_evaluation_id:evaluationId??null,p_expected_updated_at:expectedUpdatedAt??null})
    const result=requireData(Array.isArray(data)?data[0]:data,error,'A avaliação nutricional não foi confirmada pelo servidor.')
    if(!result?.saved_id||!result.saved_updated_at) throw new Error('O servidor não confirmou a avaliação nutricional.')
    return {...structuredClone(input),id:String(result.saved_id),authorLabel:'Profissional responsável',createdAt:String(result.saved_updated_at),updatedAt:String(result.saved_updated_at)}
  }

  async saveDietaryRecall24h(input: DietaryRecall24hInput, recallId?: string, expectedUpdatedAt?: string) {
    const {data,error}=await this.client.rpc('save_dietary_recall_24h',{p_organization_id:this.organizationId,p_patient_id:input.patientId,p_nutrition_evaluation_id:input.evaluationId,p_recall_date:input.recallDate,p_meals:input.meals,p_complementary_notes:input.complementaryNotes,p_submission_key:input.submissionKey,p_recall_id:recallId??null,p_expected_updated_at:expectedUpdatedAt??null})
    const result=requireData(Array.isArray(data)?data[0]:data,error,'O recordatório de 24 horas não foi confirmado pelo servidor.')
    if(!result?.saved_id||!result.saved_updated_at) throw new Error('O servidor não confirmou o recordatório de 24 horas.')
    return {...structuredClone(input),id:String(result.saved_id),authorLabel:'Profissional responsável',createdAt:String(result.saved_updated_at),updatedAt:String(result.saved_updated_at)}
  }

  async saveProfessionalService(input:ProfessionalServiceInput,serviceId?:string){const {data,error}=await this.client.rpc('save_professional_service',{p_organization_id:this.organizationId,p_name:input.name,p_duration:input.defaultDurationMinutes,p_price_cents:input.priceCents??null,p_active:input.active,p_service_id:serviceId??null});const result=requireData(Array.isArray(data)?data[0]:data,error,'O serviço não foi confirmado pelo servidor.');if(!result?.saved_id||!result.saved_updated_at)throw new Error('O servidor não confirmou o serviço.');return{...structuredClone(input),id:String(result.saved_id),createdAt:String(result.saved_updated_at),updatedAt:String(result.saved_updated_at)} }

  async saveAppointment(input:AppointmentInput,appointmentId?:string,scope:AppointmentChangeScope='occurrence',expectedUpdatedAt?:string){
    if(appointmentId){const {data,error}=await this.client.rpc('update_appointment',{p_appointment_id:appointmentId,p_expected_updated_at:expectedUpdatedAt,p_scope:scope,p_patient_id:input.patientId??null,p_service_id:input.serviceId??null,p_category:input.category.replaceAll('-','_'),p_status:input.status.replaceAll('-','_'),p_title:input.title,p_private_title:input.privateTitle,p_administrative_note:input.administrativeNote,p_starts_at:input.startsAt,p_ends_at:input.endsAt});const result=requireData(Array.isArray(data)?data[0]:data,error,'O agendamento não foi confirmado pelo servidor.');if(!result?.saved_id||!result.saved_updated_at)throw new Error('O servidor não confirmou o agendamento.');return{...structuredClone(input),id:String(result.saved_id),professionalId:input.professionalId??'',professionalLabel:'Profissional responsável',createdAt:String(result.saved_updated_at),updatedAt:String(result.saved_updated_at)}}
    const actor=input.professionalId??await this.userId();const local=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(input.startsAt));const part=(type:string)=>local.find((item)=>item.type===type)?.value;const localStart=`${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:00`;const duration=Math.round((new Date(input.endsAt).getTime()-new Date(input.startsAt).getTime())/60000);const {data,error}=await this.client.rpc('create_appointment_series',{p_organization_id:this.organizationId,p_professional_user_id:actor,p_patient_id:input.patientId??null,p_service_id:input.serviceId??null,p_category:input.category.replaceAll('-','_'),p_status:input.status.replaceAll('-','_'),p_title:input.title,p_private_title:input.privateTitle,p_administrative_note:input.administrativeNote,p_local_start:localStart,p_duration_minutes:duration,p_timezone:'America/Bahia',p_recurrence:input.recurrenceFrequency,p_recurrence_ends_on:input.recurrenceEndsOn??null});const result=requireData(Array.isArray(data)?data[0]:data,error,'O agendamento não foi confirmado pelo servidor.');if(!result?.saved_id||!result.saved_updated_at)throw new Error('O servidor não confirmou o agendamento.');return{...structuredClone(input),id:String(result.saved_id),seriesId:result.saved_series_id?String(result.saved_series_id):undefined,professionalId:actor,professionalLabel:'Profissional responsável',createdAt:String(result.saved_updated_at),updatedAt:String(result.saved_updated_at)}
  }
  async cancelAppointment(appointmentId:string,scope:AppointmentChangeScope,expectedUpdatedAt:string){const {error}=await this.client.rpc('cancel_appointment',{p_appointment_id:appointmentId,p_expected_updated_at:expectedUpdatedAt,p_scope:scope});if(error)throw repositoryError(error,'O cancelamento não foi confirmado pelo servidor.')}

  async saveFinancialCharge(input:FinancialChargeInput){const {data,error}=await this.client.rpc('create_financial_charge',{p_organization_id:this.organizationId,p_patient_id:input.patientId,p_professional_user_id:input.professionalId,p_appointment_id:input.appointmentId??null,p_service_id:input.serviceId??null,p_description:input.description,p_amount_cents:input.amountCents,p_due_date:input.dueDate,p_administrative_note:input.administrativeNote});const row=requireData(Array.isArray(data)?data[0]:data,error,'A cobrança não foi confirmada pelo servidor.');if(!row?.saved_id||!row.saved_updated_at)throw new Error('O servidor não confirmou a cobrança.');return{...structuredClone(input),id:String(row.saved_id),createdAt:String(row.saved_updated_at),updatedAt:String(row.saved_updated_at)}}
  async cancelFinancialCharge(chargeId:string,expectedUpdatedAt:string){const {error}=await this.client.rpc('cancel_financial_charge',{p_charge_id:chargeId,p_expected_updated_at:expectedUpdatedAt});if(error)throw repositoryError(error,'O cancelamento da cobrança não foi confirmado pelo servidor.')}
  async recordFinancialPayment(input:FinancialPaymentInput){const {data,error}=await this.client.rpc('record_financial_payment',{p_charge_id:input.chargeId,p_amount_cents:input.amountCents,p_method:input.method.replaceAll('-','_'),p_received_at:input.receivedAt,p_administrative_note:input.administrativeNote,p_idempotency_key:input.idempotencyKey,p_installment_number:input.installmentNumber??null,p_installment_count:input.installmentCount??null});const row=requireData(Array.isArray(data)?data[0]:data,error,'O recebimento não foi confirmado pelo servidor.');if(!row?.saved_id||!row.saved_at)throw new Error('O servidor não confirmou o recebimento.');return{...structuredClone(input),id:String(row.saved_id),kind:'receipt' as const,createdAt:String(row.saved_at),createdByLabel:'Profissional responsável'}}
  async reverseFinancialPayment(paymentId:string,idempotencyKey:string,note:string){const {data,error}=await this.client.rpc('reverse_financial_payment',{p_payment_id:paymentId,p_idempotency_key:idempotencyKey,p_administrative_note:note});const row=requireData(Array.isArray(data)?data[0]:data,error,'O estorno não foi confirmado pelo servidor.');if(!row?.saved_id||!row.saved_at)throw new Error('O servidor não confirmou o estorno.');return{id:String(row.saved_id),chargeId:String(row.charge_id),kind:'reversal' as const,amountCents:Number(row.amount_cents),method:String(row.method).replaceAll('_','-') as FinancialPayment['method'],receivedAt:String(row.received_at),administrativeNote:note,idempotencyKey,reversesPaymentId:paymentId,createdAt:String(row.saved_at),createdByLabel:'Profissional responsável'}}
  async saveFinancialExpense(input:FinancialExpenseInput,expenseId?:string,expectedUpdatedAt?:string){const {data,error}=await this.client.rpc('save_financial_expense',{p_organization_id:this.organizationId,p_expense_id:expenseId??null,p_expected_updated_at:expectedUpdatedAt??null,p_category_id:input.categoryId,p_description:input.description,p_amount_cents:input.amountCents,p_competence_date:input.competenceDate,p_due_date:input.dueDate,p_paid_at:input.paidAt??null,p_status:input.status,p_administrative_note:input.administrativeNote});const row=requireData(Array.isArray(data)?data[0]:data,error,'A despesa não foi confirmada pelo servidor.');if(!row?.saved_id||!row.saved_updated_at)throw new Error('O servidor não confirmou a despesa.');return{...structuredClone(input),id:String(row.saved_id),createdAt:String(row.saved_updated_at),updatedAt:String(row.saved_updated_at)}}
  async saveExpenseCategory(name:string,categoryId?:string){const {data,error}=await this.client.rpc('save_expense_category',{p_organization_id:this.organizationId,p_name:name,p_category_id:categoryId??null});const row=requireData(Array.isArray(data)?data[0]:data,error,'A categoria não foi confirmada pelo servidor.');if(!row?.saved_id)throw new Error('O servidor não confirmou a categoria.');return{id:String(row.saved_id),name:String(row.saved_name),active:true}}
}
