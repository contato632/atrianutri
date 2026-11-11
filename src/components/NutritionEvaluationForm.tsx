import { LoaderCircle, Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { NutritionEvaluation, NutritionEvaluationInput, PatientClinical } from '../domain/models'
import { nutritionEvaluationSchema } from '../domain/validation'
import { currentDateInBahia } from '../lib/format'

const groups = [
  { title:'Histórico e contexto', fields:[['consultationReason','Motivo da consulta',4000],['healthHistory','Histórico de saúde relevante',8000],['reportedAllergies','Alergias e intolerâncias relatadas',4000],['reportedMedications','Medicamentos e suplementos informados',4000],['previousNutritionCare','Histórico de acompanhamento nutricional',4000],['foodRestrictionsAndPreferences','Restrições, preferências e contexto alimentar',8000]] },
  { title:'Rotina alimentar', fields:[['usualMealSchedule','Horários habituais',4000],['usualMealsCount','Número de refeições relatado',200],['mealEnvironment','Ambiente das refeições',4000],['foodAccess','Acesso e disponibilidade de alimentos',4000],['hydration','Hidratação relatada',2000],['reportedDifficulties','Dificuldades relatadas',8000]] },
] as const

export function NutritionEvaluationForm({patientId,profile,evaluation,onCancel,onSubmit}:{patientId:string;profile?:PatientClinical;evaluation?:NutritionEvaluation;onCancel:()=>void;onSubmit:(input:NutritionEvaluationInput)=>Promise<void>}) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState('')
  const today = currentDateInBahia()
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setError('');const data=new FormData(event.currentTarget);const values=Object.fromEntries(groups.flatMap((group)=>group.fields.map(([name])=>[name,String(data.get(name)??'')])));const parsed=nutritionEvaluationSchema.safeParse({patientId,evaluatedOn:data.get('evaluatedOn'),...values,professionalObservations:data.get('professionalObservations'),submissionKey:evaluation?.submissionKey??crypto.randomUUID()});if(!parsed.success){setError(parsed.error.issues[0]?.message??'Revise os campos.');return}setBusy(true);try{await onSubmit(parsed.data)}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível salvar.')}finally{setBusy(false)}}
  return <form className="form-stack evaluation-form" onSubmit={submit}>
    <div className="evaluation-existing"><strong>Objetivo já registrado na anamnese</strong><p>{profile?.goal||'Sem informação. Edite a anamnese no prontuário para registrar o objetivo.'}</p></div>
    <label className="field"><span>Data da avaliação</span><input type="date" name="evaluatedOn" defaultValue={evaluation?.evaluatedOn??today} max={today} required /></label>
    {groups.map((group)=><details className="evaluation-group" key={group.title} open><summary>{group.title}</summary><div className="evaluation-group__fields">{group.fields.map(([name,label,max])=><label className="field" key={name}><span>{label} <small>opcional</small></span><textarea name={name} defaultValue={evaluation?.[name]??''} maxLength={max} rows={name==='usualMealsCount'?2:3} /></label>)}</div></details>)}
    <details className="evaluation-group" open><summary>Observações profissionais</summary><label className="field"><span>Contexto e interpretação do nutricionista <small>sem diagnóstico automático</small></span><textarea name="professionalObservations" defaultValue={evaluation?.professionalObservations??''} maxLength={8000} rows={4}/></label></details>
    {error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button button--ghost" type="button" onClick={onCancel}>Cancelar</button><button className="button button--primary" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Save size={16}/>}Salvar avaliação</button></div>
  </form>
}
