import { LoaderCircle, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { PatientAdministrative, PatientInput } from '../domain/models'
import { patientSchema } from '../domain/validation'

type FieldErrors = Partial<Record<keyof PatientInput, string>>

function toLocalDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

export function PatientForm({ patient, onSubmit, onCancel }: { patient?: PatientAdministrative; onSubmit: (input: PatientInput) => Promise<void>; onCancel: () => void }) {
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty])
  const cancel = () => { if (!dirty || window.confirm('Descartar as alterações deste cadastro?')) onCancel() }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const nextAppointmentValue = String(data.get('nextAppointment') ?? '')
    const candidate = {
      fullName: String(data.get('fullName') ?? ''),
      birthDate: String(data.get('birthDate') ?? ''),
      phone: String(data.get('phone') ?? ''),
      email: String(data.get('email') ?? '').toLowerCase(),
      status: String(data.get('status') ?? 'active'),
      nextAppointment: nextAppointmentValue ? new Date(nextAppointmentValue).toISOString() : undefined,
    }
    const parsed = patientSchema.safeParse(candidate)
    if (!parsed.success) {
      const nextErrors: FieldErrors = {}
      parsed.error.issues.forEach((issue) => { nextErrors[issue.path[0] as keyof PatientInput] ??= issue.message })
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    setErrors({})
    setFormError('')
    try {
      await onSubmit(parsed.data)
      setDirty(false)
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Não foi possível salvar o paciente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={submit} onChange={() => setDirty(true)} noValidate>
      <div className="form-section-heading"><span>Dados administrativos</span><p>Informações de identificação e contato. Dados clínicos ficam em área separada.</p></div>
      <div className="field-grid field-grid--2">
        <label className="field field--wide"><span>Nome completo <b aria-hidden="true">*</b></span><input name="fullName" required defaultValue={patient?.fullName} placeholder="Ex.: Mariana da Silva" autoComplete="name" aria-invalid={!!errors.fullName} />{errors.fullName && <small className="field-error">{errors.fullName}</small>}</label>
        <label className="field"><span>Data de nascimento <b aria-hidden="true">*</b></span><input type="date" name="birthDate" required defaultValue={patient?.birthDate} aria-invalid={!!errors.birthDate} />{errors.birthDate && <small className="field-error">{errors.birthDate}</small>}</label>
        <label className="field"><span>Telefone <b aria-hidden="true">*</b></span><input name="phone" required defaultValue={patient?.phone} placeholder="(00) 00000-0000" autoComplete="tel" aria-invalid={!!errors.phone} />{errors.phone && <small className="field-error">{errors.phone}</small>}</label>
        <label className="field"><span>E-mail <b aria-hidden="true">*</b></span><input type="email" name="email" required defaultValue={patient?.email} placeholder="paciente@exemplo.com" autoComplete="email" aria-invalid={!!errors.email} />{errors.email && <small className="field-error">{errors.email}</small>}</label>
        <label className="field"><span>Status</span><select name="status" defaultValue={patient?.status ?? 'active'}><option value="active">Em acompanhamento</option><option value="follow-up">Em retorno</option><option value="paused">Pausado</option></select></label>
        <label className="field"><span>Próxima consulta <em>opcional</em></span><input type="datetime-local" name="nextAppointment" defaultValue={toLocalDateTime(patient?.nextAppointment)} /></label>
      </div>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <small className="required-hint">* Campos obrigatórios. {dirty ? 'Há alterações não salvas.' : 'Nenhuma alteração pendente.'}</small>
      <footer className="form-actions"><button type="button" className="button button--ghost" onClick={cancel}>Cancelar</button><button type="submit" className="button button--primary" disabled={saving || Boolean(patient && !dirty)}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{patient ? 'Salvar alterações' : 'Cadastrar paciente'}</button></footer>
    </form>
  )
}
