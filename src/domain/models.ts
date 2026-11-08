export type PatientStatus = 'active' | 'follow-up' | 'paused'

export interface PatientAdministrative {
  id: string
  fullName: string
  birthDate: string
  phone: string
  email: string
  status: PatientStatus
  nextAppointment?: string
  createdAt: string
}

export interface PatientClinical {
  patientId: string
  goal: string
  foodHistory: string
  habits: string
  professionalNotes: string
  updatedAt: string
}

export interface Assessment {
  id: string
  patientId: string
  assessedAt: string
  weightKg: number
  heightCm: number
  waistCm?: number
  hipCm?: number
  armCm?: number
  bodyFatPercentage?: number
  bmi: number
  notes: string
  createdAt: string
}

export interface FoodItem {
  id: string
  name: string
  quantity: string
}

export interface Meal {
  id: string
  name: string
  time: string
  guidance: string
  foods: FoodItem[]
}

export interface PlanRevision {
  version: number
  savedAt: string
  summary: string
}

export interface MealPlan {
  id: string
  patientId: string
  title: string
  status: 'draft' | 'active'
  version: number
  updatedAt: string
  meals: Meal[]
  revisions: PlanRevision[]
}

export type FoodDiaryMealType = 'breakfast' | 'morning-snack' | 'lunch' | 'afternoon-snack' | 'dinner' | 'evening-snack' | 'other'
export type ClinicalRecordSource = 'patient' | 'professional'

export interface FoodDiaryItem {
  id: string
  name: string
  quantity: string
}

export interface FoodDiaryEntry {
  id: string
  patientId: string
  entryDate: string
  mealTime: string
  mealType: FoodDiaryMealType
  foods: FoodDiaryItem[]
  notes: string
  eatingContext: string
  hungerBefore: string
  satietyAfter: string
  routineChanges: string
  source: ClinicalRecordSource
  sharedWithPatient: boolean
  professionalPrivateNote: string
  submissionKey: string
  createdAt: string
  updatedAt: string
}

export type HabitGoalStatus = 'active' | 'paused' | 'completed'
export type HabitProgress = 'progressing' | 'maintaining' | 'difficulty' | 'not-observed'

export interface HabitGoal {
  id: string
  patientId: string
  title: string
  description: string
  status: HabitGoalStatus
  sharedWithPatient: boolean
  professionalPrivateNote: string
  submissionKey: string
  createdAt: string
  updatedAt: string
}

export interface HabitCheckIn {
  id: string
  goalId: string
  patientId: string
  recordedOn: string
  progress: HabitProgress
  notes: string
  difficulties: string
  nextStep: string
  source: ClinicalRecordSource
  sharedWithPatient: boolean
  professionalPrivateNote: string
  submissionKey: string
  createdAt: string
  updatedAt: string
}

export interface NutritionEvaluation {
  id: string
  patientId: string
  evaluatedOn: string
  consultationReason: string
  healthHistory: string
  reportedAllergies: string
  reportedMedications: string
  previousNutritionCare: string
  foodRestrictionsAndPreferences: string
  usualMealSchedule: string
  usualMealsCount: string
  mealEnvironment: string
  foodAccess: string
  hydration: string
  reportedDifficulties: string
  professionalObservations: string
  authorLabel: string
  submissionKey: string
  createdAt: string
  updatedAt: string
}

export interface DietaryRecallMeal {
  id: string
  name: string
  time: string
  foods: FoodDiaryItem[]
  context: string
  notes: string
}

export interface DietaryRecall24h {
  id: string
  evaluationId: string
  patientId: string
  recallDate: string
  meals: DietaryRecallMeal[]
  complementaryNotes: string
  authorLabel: string
  submissionKey: string
  createdAt: string
  updatedAt: string
}

export interface NutritionWorkspace {
  patients: PatientAdministrative[]
  clinicalProfiles: PatientClinical[]
  assessments: Assessment[]
  mealPlans: MealPlan[]
  foodDiaryEntries: FoodDiaryEntry[]
  habitGoals: HabitGoal[]
  habitCheckIns: HabitCheckIn[]
  nutritionEvaluations: NutritionEvaluation[]
  dietaryRecalls24h: DietaryRecall24h[]
}

export type PatientInput = Omit<PatientAdministrative, 'id' | 'createdAt'>
export type ClinicalProfileInput = Pick<PatientClinical, 'goal' | 'foodHistory' | 'habits' | 'professionalNotes'>
export type AssessmentInput = Omit<Assessment, 'id' | 'bmi' | 'createdAt'>
export type FoodDiaryEntryInput = Omit<FoodDiaryEntry, 'id' | 'source' | 'createdAt' | 'updatedAt'>
export type HabitGoalInput = Omit<HabitGoal, 'id' | 'createdAt' | 'updatedAt'>
export type HabitCheckInInput = Omit<HabitCheckIn, 'id' | 'source' | 'createdAt' | 'updatedAt'>
export type NutritionEvaluationInput = Omit<NutritionEvaluation, 'id' | 'authorLabel' | 'createdAt' | 'updatedAt'>
export type DietaryRecall24hInput = Omit<DietaryRecall24h, 'id' | 'authorLabel' | 'createdAt' | 'updatedAt'>
