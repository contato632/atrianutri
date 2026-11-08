import { Info, LoaderCircle, Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { AssessmentInput, PatientAdministrative } from '../domain/models'
import { calculateBmi, interpretAdultBmi } from '../domain/nutrition'
import { assessmentSchema } from '../domain/validation'

const numberOrUndefined = (value: FormDataEntryValue | null) => value === null || value === '' ? undefined : Number(value)

export function AssessmentForm({ patients, initialPatientId, onSubmit, onCancel }: { patients: PatientAdministrative[]; initialPatientId?: string; onSubmit: (input: AssessmentInput) => Promise<void>; onCancel: () => void }) {
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  let bmi: number | null = null
  try { if (weight && height) bmi = calculateBmi(Number(weight), Number(height)) } catch { bmi = null }
  const interpretation = bmi ? interpretAdultBmi(bmi) : null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const candidate = {
      patientId: String(data.get('patientId') ?? ''),
      assessedAt: String(data.get('assessedAt') ?? ''),
      weightKg: Number(data.get('weightKg')),
      heightCm: Number(data.get('heightCm')),
      waistCm: numberOrUndefined(data.get('waistCm')),
      hipCm: numberOrUndefined(data.get('hipCm')),
      armCm: numberOrUndefined(data.get('armCm')),
      bodyFatPercentage: numberOrUndefined(data.get('bodyFatPercentage')),
      notes: String(data.get('notes') ?? ''),
    }
    const parsed = assessmentSchema.safeParse(candidate)
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}
      parsed.error.issues.forEach((issue) => { nextErrors[String(issue.path[0])] ??= issue.message })
      setErrors(nextErrors)
      return
    }
    setSaving(true); setErrors({}); setFormError('')
    try { await onSubmit(parsed.data) } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Não foi possível salvar a avaliação.') } finally { setSaving(false) }
  }

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      <div className="field-grid field-grid--2">
        <label className="field"><span>Paciente</span><select name="patientId" defaultValue={initialPatientId ?? ''}><option value="" disabled>Selecione</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select>{errors.patientId && <small className="field-error">{errors.patientId}</small>}</label>
        <label className="field"><span>Data da avaliação</span><input name="assessedAt" type="date" defaultValue="2026-11-08" />{errors.assessedAt && <small className="field-error">{errors.assessedAt}</small>}</label>
      </div>
      <div className="form-section-heading"><span>Medidas principais</span><p>Use valores aferidos e revise antes de salvar.</p></div>
      <div className="field-grid field-grid--4">
        <label className="field"><span>Peso <em>kg</em></span><input name="weightKg" type="number" inputMode="decimal" step="0.1" min="1" max="500" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="00,0" />{errors.weightKg && <small className="field-error">{errors.weightKg}</small>}</label>
        <label className="field"><span>Altura <em>cm</em></span><input name="heightCm" type="number" inputMode="decimal" step="0.1" min="50" max="250" value={height} onChange={(event) => setHeight(event.target.value)} placeholder="000" />{errors.heightCm && <small className="field-error">{errors.heightCm}</small>}</label>
        <label className="field"><span>Cintura <em>cm</em></span><input name="waistCm" type="number" inputMode="decimal" step="0.1" min="1" max="300" placeholder="Opcional" /></label>
        <label className="field"><span>Quadril <em>cm</em></span><input name="hipCm" type="number" inputMode="decimal" step="0.1" min="1" max="300" placeholder="Opcional" /></label>
        <label className="field"><span>Braço <em>cm</em></span><input name="armCm" type="number" inputMode="decimal" step="0.1" min="1" max="100" placeholder="Opcional" /></label>
        <label className="field"><span>Gordura corporal <em>%</em></span><input name="bodyFatPercentage" type="number" inputMode="decimal" step="0.1" min="1" max="80" placeholder="Opcional" /></label>
      </div>
      <div className={`bmi-preview ${bmi ? 'bmi-preview--ready' : ''}`}><div><span>IMC calculado</span><strong>{bmi?.toFixed(1) ?? '—'}</strong></div><p>{interpretation ? <><b>{interpretation.label}.</b> {interpretation.description}</> : 'Preencha peso e altura para visualizar o cálculo.'}</p></div>
      <div className="clinical-caution"><Info size={16} /><p>O IMC é um indicador de triagem e não avalia composição corporal, distribuição de gordura, faixa etária ou contexto clínico isoladamente.</p></div>
      <label className="field"><span>Observações profissionais</span><textarea name="notes" rows={3} placeholder="Contexto da aferição, condições relevantes e próximos passos…" maxLength={2000} /></label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <footer className="form-actions"><button type="button" className="button button--ghost" onClick={onCancel}>Cancelar</button><button type="submit" className="button button--primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}Salvar avaliação</button></footer>
    </form>
  )
}
