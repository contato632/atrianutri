import { z } from 'zod'

export const patientSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome completo.').max(160),
  birthDate: z.string().date('Informe uma data válida.').refine((value) => new Date(`${value}T12:00:00`) <= new Date(), 'A data não pode estar no futuro.'),
  phone: z.string().trim().min(10, 'Informe um telefone com DDD.').max(24),
  email: z.string().trim().email('Informe um e-mail válido.').max(320),
  status: z.enum(['active', 'follow-up', 'paused']),
  nextAppointment: z.string().optional(),
})

export const clinicalProfileSchema = z.object({
  goal: z.string().trim().max(4000, 'O objetivo deve ter no máximo 4.000 caracteres.'),
  foodHistory: z.string().trim().max(12000, 'O histórico deve ter no máximo 12.000 caracteres.'),
  habits: z.string().trim().max(12000, 'O registro de hábitos deve ter no máximo 12.000 caracteres.'),
  professionalNotes: z.string().trim().max(12000, 'As observações devem ter no máximo 12.000 caracteres.'),
})

export const assessmentSchema = z.object({
  patientId: z.string().min(1, 'Selecione um paciente.'),
  assessedAt: z.string().date('Informe uma data válida.'),
  weightKg: z.number().min(1, 'Peso inválido.').max(500, 'Peso inválido.'),
  heightCm: z.number().min(50, 'Altura inválida.').max(250, 'Altura inválida.'),
  waistCm: z.number().positive().max(300).optional(),
  hipCm: z.number().positive().max(300).optional(),
  armCm: z.number().positive().max(100).optional(),
  bodyFatPercentage: z.number().min(1).max(80).optional(),
  notes: z.string().trim().max(2000),
})

const diaryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Informe o alimento ou preparação.').max(300),
  quantity: z.string().trim().max(200),
})

export const foodDiaryEntrySchema = z.object({
  patientId: z.string().min(1),
  entryDate: z.string().date('Informe uma data válida.'),
  mealTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe um horário válido.'),
  mealType: z.enum(['breakfast', 'morning-snack', 'lunch', 'afternoon-snack', 'dinner', 'evening-snack', 'other']),
  foods: z.array(diaryItemSchema).min(1, 'Adicione pelo menos um alimento ou preparação.').max(50),
  notes: z.string().trim().max(4000),
  eatingContext: z.string().trim().max(2000),
  hungerBefore: z.string().trim().max(500),
  satietyAfter: z.string().trim().max(500),
  routineChanges: z.string().trim().max(4000),
  sharedWithPatient: z.boolean(),
  professionalPrivateNote: z.string().trim().max(4000),
  submissionKey: z.string().uuid(),
})

export const habitGoalSchema = z.object({
  patientId: z.string().min(1),
  title: z.string().trim().min(3, 'Descreva o hábito individualizado.').max(200),
  description: z.string().trim().max(4000),
  status: z.enum(['active', 'paused', 'completed']),
  sharedWithPatient: z.boolean(),
  professionalPrivateNote: z.string().trim().max(4000),
  submissionKey: z.string().uuid(),
})

export const habitCheckInSchema = z.object({
  goalId: z.string().min(1),
  patientId: z.string().min(1),
  recordedOn: z.string().date('Informe uma data válida.'),
  progress: z.enum(['progressing', 'maintaining', 'difficulty', 'not-observed']),
  notes: z.string().trim().max(4000),
  difficulties: z.string().trim().max(4000),
  nextStep: z.string().trim().max(2000),
  sharedWithPatient: z.boolean(),
  professionalPrivateNote: z.string().trim().max(4000),
  submissionKey: z.string().uuid(),
})

const optionalClinicalText = (maximum: number) => z.string().trim().max(maximum)

export const nutritionEvaluationSchema = z.object({
  patientId: z.string().min(1),
  evaluatedOn: z.string().date('Informe uma data válida.').refine((value) => new Date(`${value}T12:00:00`) <= new Date(), 'A data não pode estar no futuro.'),
  consultationReason: optionalClinicalText(4000), healthHistory: optionalClinicalText(8000), reportedAllergies: optionalClinicalText(4000),
  reportedMedications: optionalClinicalText(4000), previousNutritionCare: optionalClinicalText(4000), foodRestrictionsAndPreferences: optionalClinicalText(8000),
  usualMealSchedule: optionalClinicalText(4000), usualMealsCount: optionalClinicalText(200), mealEnvironment: optionalClinicalText(4000),
  foodAccess: optionalClinicalText(4000), hydration: optionalClinicalText(2000), reportedDifficulties: optionalClinicalText(8000),
  professionalObservations: optionalClinicalText(8000), submissionKey: z.string().uuid(),
})

const recallMealSchema = z.object({
  id: z.string().min(1), name: z.string().trim().min(1, 'Informe a refeição.').max(200),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe um horário válido.'),
  foods: z.array(diaryItemSchema).min(1, 'Adicione ao menos um alimento relatado.').max(50),
  context: optionalClinicalText(2000), notes: optionalClinicalText(2000),
})

export const dietaryRecall24hSchema = z.object({
  evaluationId: z.string().min(1), patientId: z.string().min(1),
  recallDate: z.string().date('Informe uma data válida.').refine((value) => new Date(`${value}T12:00:00`) <= new Date(), 'A data não pode estar no futuro.'),
  meals: z.array(recallMealSchema).min(1, 'Adicione ao menos uma refeição recordada.').max(20),
  complementaryNotes: optionalClinicalText(4000), submissionKey: z.string().uuid(),
})

export const professionalServiceSchema=z.object({name:z.string().trim().min(2,'Informe o nome do serviço.').max(160),defaultDurationMinutes:z.number().int().min(15).max(480),priceCents:z.number().int().min(0).max(100000000).optional(),active:z.boolean()})
export const appointmentSchema=z.object({professionalId:z.string().optional(),patientId:z.string().optional(),serviceId:z.string().optional(),category:z.enum(['nutrition-consultation','follow-up','lunch-break','personal']),status:z.enum(['scheduled','confirmed','completed','canceled','no-show']),title:z.string().trim().max(200),privateTitle:z.string().trim().max(200),administrativeNote:z.string().trim().max(2000),startsAt:z.string().datetime(),endsAt:z.string().datetime(),recurrenceFrequency:z.enum(['none','weekly','biweekly','monthly']),recurrenceEndsOn:z.string().date().optional()}).superRefine((value,context)=>{if(['nutrition-consultation','follow-up'].includes(value.category)&&!value.patientId)context.addIssue({code:'custom',path:['patientId'],message:'Selecione o paciente.'});if(new Date(value.endsAt)<=new Date(value.startsAt))context.addIssue({code:'custom',path:['endsAt'],message:'A duração deve ser positiva.'});if(value.recurrenceEndsOn&&new Date(`${value.recurrenceEndsOn}T12:00:00Z`)<new Date(value.startsAt))context.addIssue({code:'custom',path:['recurrenceEndsOn'],message:'A data final deve ser igual ou posterior ao início.'})})
