import { LoaderCircle, LockKeyhole, Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { ClinicalProfileInput, PatientClinical } from '../domain/models'
import { clinicalProfileSchema } from '../domain/validation'

type FieldName = keyof ClinicalProfileInput
const fields = [
  { name: 'goal', label: 'Objetivos do acompanhamento', limit: 4000, placeholder: 'Objetivos relatados pela pessoa e prioridades combinadas na consulta.' },
  { name: 'foodHistory', label: 'Histórico alimentar', limit: 12000, placeholder: 'Padrões alimentares, preferências, restrições relatadas e informações relevantes para a avaliação.' },
  { name: 'habits', label: 'Hábitos e rotina', limit: 12000, placeholder: 'Horários, acesso aos alimentos, sono, rotina de trabalho, atividades e contexto das refeições.' },
  { name: 'professionalNotes', label: 'Observações profissionais', limit: 12000, placeholder: 'Hipóteses e observações clínicas registradas e revisadas pelo nutricionista.' },
] as const

export function AnamnesisForm({
  profile, onSubmit, onCancel,
}: {
  profile?: PatientClinical
  onSubmit: (value: ClinicalProfileInput, expectedUpdatedAt?: string) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<ClinicalProfileInput>({
    goal: profile?.goal ?? '',
    foodHistory: profile?.foodHistory ?? '',
    habits: profile?.habits ?? '',
    professionalNotes: profile?.professionalNotes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({})

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const parsed = clinicalProfileSchema.safeParse(form)
    if (!parsed.success) {
      const errors: Partial<Record<FieldName, string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName
        if (field) errors[field] ??= issue.message
      }
      setFieldErrors(errors)
      return
    }
    setSaving(true)
    setError('')
    setFieldErrors({})
    try {
      await onSubmit(parsed.data, profile?.updatedAt)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível confirmar a anamnese.')
    } finally {
      setSaving(false)
    }
  }

  function field(name: FieldName) {
    const config = fields.find((item) => item.name === name)!
    return (
      <label key={config.name} className="anamnesis-field">
        <span>{config.label}</span>
        <textarea name={config.name} rows={3} maxLength={config.limit}
          aria-invalid={Boolean(fieldErrors[name])} value={form[name]}
          onChange={(event) => { setForm((current) => ({ ...current, [name]: event.target.value })); setFieldErrors((current) => ({ ...current, [name]: undefined })) }}
          placeholder={config.placeholder} />
        <span className="anamnesis-field__meta"><span>{fieldErrors[name] ? <span className="field-error">{fieldErrors[name]}</span> : 'Preenchimento opcional, conforme avaliação profissional'}</span><span>{form[name].length.toLocaleString('pt-BR')}/{config.limit.toLocaleString('pt-BR')}</span></span>
      </label>
    )
  }
  return (
    <form className="anamnesis-form" onSubmit={(event) => void save(event)}>
      <section className="anamnesis-section">
        <div className="anamnesis-section__title"><strong>Objetivos e histórico</strong><small>Informações obtidas na entrevista nutricional.</small></div>
        {field('goal')}
        {field('foodHistory')}
      </section>
      <section className="anamnesis-section">
        <div className="anamnesis-section__title"><strong>Hábitos e acompanhamento</strong><small>Registre apenas informações pertinentes ao cuidado.</small></div>
        {field('habits')}
        {field('professionalNotes')}
      </section>
      <p className="anamnesis-private-note"><LockKeyhole size={15} /> Registro clínico restrito. Evite dados excessivos. Nenhuma interpretação ou prescrição é produzida automaticamente.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <footer className="form-actions"><button type="button" className="button button--ghost" disabled={saving} onClick={onCancel}>Cancelar</button><button type="submit" className="button button--primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{saving ? 'Salvando…' : 'Salvar anamnese'}</button></footer>
    </form>
  )
}
