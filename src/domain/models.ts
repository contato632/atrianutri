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

export interface NutritionWorkspace {
  patients: PatientAdministrative[]
  clinicalProfiles: PatientClinical[]
  assessments: Assessment[]
  mealPlans: MealPlan[]
}

export type PatientInput = Omit<PatientAdministrative, 'id' | 'createdAt'>
export type AssessmentInput = Omit<Assessment, 'id' | 'bmi' | 'createdAt'>
