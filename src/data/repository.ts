import { calculateBmi } from '../domain/nutrition'
import type { Appointment, AppointmentChangeScope, AppointmentInput, Assessment, AssessmentInput, ClinicalProfileInput, DietaryRecall24h, DietaryRecall24hInput, FoodDiaryEntry, FoodDiaryEntryInput, HabitCheckIn, HabitCheckInInput, HabitGoal, HabitGoalInput, NutritionEvaluation, NutritionEvaluationInput, PatientClinical, MealPlan, NutritionWorkspace, PatientAdministrative, PatientInput, ProfessionalService, ProfessionalServiceInput } from '../domain/models'
import { hasAppointmentConflict, recurrenceDates } from '../domain/scheduling'
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
  saveNutritionEvaluation(input: NutritionEvaluationInput, evaluationId?: string, expectedUpdatedAt?: string): Promise<NutritionEvaluation>
  saveDietaryRecall24h(input: DietaryRecall24hInput, recallId?: string, expectedUpdatedAt?: string): Promise<DietaryRecall24h>
  saveProfessionalService(input: ProfessionalServiceInput, serviceId?: string): Promise<ProfessionalService>
  saveAppointment(input: AppointmentInput, appointmentId?: string, scope?: AppointmentChangeScope, expectedUpdatedAt?: string): Promise<Appointment>
  cancelAppointment(appointmentId: string, scope: AppointmentChangeScope, expectedUpdatedAt: string): Promise<void>
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

  async saveNutritionEvaluation(input: NutritionEvaluationInput, evaluationId?: string, expectedUpdatedAt?: string) {
    if (!this.data.patients.some((patient) => patient.id === input.patientId)) throw new Error('Paciente não encontrado.')
    const index = evaluationId ? this.data.nutritionEvaluations.findIndex((item) => item.id === evaluationId) : -1
    const previous = index >= 0 ? this.data.nutritionEvaluations[index] : null
    if (evaluationId && !previous) throw new Error('Avaliação nutricional não encontrada.')
    if (previous && previous.updatedAt !== expectedUpdatedAt) throw new Error('A avaliação foi alterada em outra sessão. Atualize antes de salvar.')
    const timestamp = new Date().toISOString()
    const saved: NutritionEvaluation = { ...clone(input), id: previous?.id ?? id('evaluation'), authorLabel: previous?.authorLabel ?? 'Dra. Marina Costa', createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp }
    if (index >= 0) this.data.nutritionEvaluations[index] = saved
    else this.data.nutritionEvaluations.unshift(saved)
    return clone(saved)
  }

  async saveDietaryRecall24h(input: DietaryRecall24hInput, recallId?: string, expectedUpdatedAt?: string) {
    if (!this.data.nutritionEvaluations.some((item) => item.id === input.evaluationId && item.patientId === input.patientId)) throw new Error('Avaliação nutricional não encontrada para este paciente.')
    const index = recallId ? this.data.dietaryRecalls24h.findIndex((item) => item.id === recallId) : -1
    const previous = index >= 0 ? this.data.dietaryRecalls24h[index] : null
    if (recallId && !previous) throw new Error('Recordatório de 24 horas não encontrado.')
    if (previous && previous.updatedAt !== expectedUpdatedAt) throw new Error('O recordatório foi alterado em outra sessão. Atualize antes de salvar.')
    const timestamp = new Date().toISOString()
    const saved: DietaryRecall24h = { ...clone(input), id: previous?.id ?? id('recall'), authorLabel: previous?.authorLabel ?? 'Dra. Marina Costa', createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp }
    if (index >= 0) this.data.dietaryRecalls24h[index] = saved
    else this.data.dietaryRecalls24h.unshift(saved)
    return clone(saved)
  }

  private refreshNextAppointments(){const now=Date.now();this.data.patients=this.data.patients.map((patient)=>{const next=this.data.appointments.filter((item)=>item.patientId===patient.id&&!['canceled','completed','no-show'].includes(item.status)&&new Date(item.startsAt).getTime()>=now).sort((a,b)=>a.startsAt.localeCompare(b.startsAt))[0];return {...patient,nextAppointment:next?.startsAt}})}

  async saveProfessionalService(input:ProfessionalServiceInput,serviceId?:string){const index=serviceId?this.data.professionalServices.findIndex((item)=>item.id===serviceId):-1;const previous=index>=0?this.data.professionalServices[index]:null;if(serviceId&&!previous)throw new Error('Serviço não encontrado.');const timestamp=new Date().toISOString();const saved:ProfessionalService={...clone(input),id:previous?.id??id('service'),createdAt:previous?.createdAt??timestamp,updatedAt:timestamp};if(index>=0)this.data.professionalServices[index]=saved;else this.data.professionalServices.push(saved);return clone(saved)}

  async saveAppointment(input:AppointmentInput,appointmentId?:string,scope:AppointmentChangeScope='occurrence',expectedUpdatedAt?:string){
    const previous=appointmentId?this.data.appointments.find((item)=>item.id===appointmentId):undefined;if(appointmentId&&!previous)throw new Error('Agendamento não encontrado.');if(previous&&previous.updatedAt!==expectedUpdatedAt)throw new Error('O agendamento foi alterado em outra sessão. Atualize antes de salvar.');
    if(input.patientId&&!this.data.patients.some((item)=>item.id===input.patientId))throw new Error('Paciente não encontrado.');const professionalId=input.professionalId??previous?.professionalId??'demo-professional-marina';const excluded=previous?(scope==='series'&&previous.seriesId?this.data.appointments.filter((item)=>item.seriesId===previous.seriesId).map((item)=>item.id):[previous.id]):[];
    const timestamp=new Date().toISOString();if(previous){const targets=scope==='series'&&previous.seriesId?this.data.appointments.filter((item)=>item.seriesId===previous.seriesId):[previous];const delta=new Date(input.startsAt).getTime()-new Date(previous.startsAt).getTime();const shiftedTargets=targets.map((target)=>({target,shifted:target.id===previous.id?input:{...input,startsAt:new Date(new Date(target.startsAt).getTime()+delta).toISOString(),endsAt:new Date(new Date(target.endsAt).getTime()+delta).toISOString()}}));if(shiftedTargets.some(({shifted})=>hasAppointmentConflict(this.data.appointments,shifted,professionalId,excluded)))throw new Error('Conflito de horário com outro compromisso deste profissional.');for(const {target,shifted} of shiftedTargets){const index=this.data.appointments.findIndex((item)=>item.id===target.id);this.data.appointments[index]={...target,...clone(shifted),updatedAt:timestamp}}this.refreshNextAppointments();return clone(this.data.appointments.find((item)=>item.id===previous.id)!) }
    const seriesId=input.recurrenceFrequency==='none'?undefined:id('series');const date=input.startsAt.slice(0,10);const timePart=input.startsAt.slice(11);const duration=new Date(input.endsAt).getTime()-new Date(input.startsAt).getTime();const dates=recurrenceDates(date,input.recurrenceFrequency,input.recurrenceEndsOn);const occurrences=dates.map((occurrenceDate)=>{const startsAt=`${occurrenceDate}T${timePart}`;return{...clone(input),id:id('appointment'),seriesId,professionalId,professionalLabel:professionalId==='demo-professional-marina'?'Dra. Marina':'Profissional',startsAt,endsAt:new Date(new Date(startsAt).getTime()+duration).toISOString(),createdAt:timestamp,updatedAt:timestamp}});if(occurrences.some((occurrence)=>hasAppointmentConflict(this.data.appointments,occurrence,occurrence.professionalId)))throw new Error('Conflito de horário em uma ocorrência da série.');this.data.appointments.push(...occurrences);this.refreshNextAppointments();return clone(occurrences[0])
  }

  async cancelAppointment(appointmentId:string,scope:AppointmentChangeScope,expectedUpdatedAt:string){const previous=this.data.appointments.find((item)=>item.id===appointmentId);if(!previous)throw new Error('Agendamento não encontrado.');if(previous.updatedAt!==expectedUpdatedAt)throw new Error('O agendamento foi alterado em outra sessão.');const timestamp=new Date().toISOString();this.data.appointments=this.data.appointments.map((item)=>(item.id===appointmentId||(scope==='series'&&previous.seriesId&&item.seriesId===previous.seriesId))?{...item,status:'canceled',updatedAt:timestamp}:item);this.refreshNextAppointments()}
}
