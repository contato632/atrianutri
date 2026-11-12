import { AlertTriangle, LoaderCircle, Save, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import type { Appointment, AppointmentCategory, AppointmentChangeScope, AppointmentInput, NutritionWorkspace, RecurrenceFrequency } from '../domain/models'
import { addMinutes, hasAppointmentConflict, localScheduleToIso, timeInScheduleTimeZone, dateInScheduleTimeZone } from '../domain/scheduling'
import { appointmentSchema } from '../domain/validation'

const categories = [
  ['nutrition-consultation', 'Consulta nutricional'], ['follow-up', 'Retorno'],
  ['lunch-break', 'Horário de almoço'], ['personal', 'Compromisso particular'],
] as const

type Props = {
  workspace: NutritionWorkspace
  appointment?: Appointment
  initialDate: string
  initialTime: string
  initialPatientId?: string
  professionalId?: string
  onClose: () => void
  onSave: (input: AppointmentInput, scope: AppointmentChangeScope) => Promise<void>
  onCancelAppointment?: (scope: AppointmentChangeScope) => Promise<void>
}

export function AppointmentForm({ workspace, appointment, initialDate, initialTime, initialPatientId, professionalId, onClose, onSave, onCancelAppointment }: Props) {
  const [category, setCategory] = useState<AppointmentCategory>(appointment?.category ?? 'nutrition-consultation')
  const [patientId, setPatientId] = useState(appointment?.patientId ?? initialPatientId ?? '')
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? '')
  const [scope, setScope] = useState<AppointmentChangeScope>('occurrence')
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>(appointment?.recurrenceFrequency ?? 'none')
  const [date, setDate] = useState(appointment ? dateInScheduleTimeZone(appointment.startsAt) : initialDate)
  const [time, setTime] = useState(appointment ? timeInScheduleTimeZone(appointment.startsAt) : initialTime)
  const [duration, setDuration] = useState(appointment ? Math.round((new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) / 60_000) : 60)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const requestClose = () => { if (!dirty || window.confirm('Descartar as alterações deste agendamento?')) onClose() }
  const service = workspace.professionalServices.find((item) => item.id === serviceId)
  const requiresPatient = category === 'nutrition-consultation' || category === 'follow-up'
  const patient = workspace.patients.find((item) => item.id === patientId)
  const activeServices = useMemo(() => workspace.professionalServices.filter((item) => item.active || item.id === appointment?.serviceId), [workspace.professionalServices, appointment])
  const effectiveProfessionalId = professionalId ?? appointment?.professionalId
  const scheduleProfessionals = Array.from(new Set(workspace.appointments.map((item) => item.professionalId)))
  const conflictProfessionalId = effectiveProfessionalId ?? (scheduleProfessionals.length === 1 ? scheduleProfessionals[0] : undefined)
  const conflict = useMemo(() => {
    try {
      const startsAt = localScheduleToIso(date, time)
      return conflictProfessionalId ? hasAppointmentConflict(workspace.appointments, { startsAt, endsAt: addMinutes(startsAt, duration) }, conflictProfessionalId, appointment ? [appointment.id] : []) : false
    } catch { return false }
  }, [workspace.appointments, date, time, duration, conflictProfessionalId, appointment])

  function selectService(id: string) {
    setServiceId(id)
    const selected = workspace.professionalServices.find((item) => item.id === id)
    if (selected) setDuration(selected.defaultDurationMinutes)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const data = new FormData(event.currentTarget)
    try {
      const startsAt = localScheduleToIso(date, time)
      const input = {
        professionalId: effectiveProfessionalId,
        patientId: requiresPatient ? patientId : undefined,
        serviceId: requiresPatient && serviceId ? serviceId : undefined,
        category,
        status: String(data.get('status')) as AppointmentInput['status'],
        title: category === 'personal' ? 'Compromisso particular' : category === 'lunch-break' ? 'Horário de almoço' : category === 'follow-up' ? 'Retorno nutricional' : 'Consulta nutricional',
        privateTitle: category === 'personal' ? String(data.get('privateTitle') ?? '') : '',
        administrativeNote: String(data.get('administrativeNote') ?? ''),
        startsAt,
        endsAt: addMinutes(startsAt, duration),
        recurrenceFrequency: appointment ? appointment.recurrenceFrequency : recurrence,
        recurrenceEndsOn: !appointment && recurrence !== 'none' && data.get('recurrenceEndsOn') ? String(data.get('recurrenceEndsOn')) : undefined,
      }
      const parsed = appointmentSchema.safeParse(input)
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise os dados.'); return }
      if (conflict) { setError('Conflito de horário com outro compromisso deste profissional.'); return }
      setBusy(true)
      await onSave(parsed.data, scope)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.')
    } finally { setBusy(false) }
  }

  return <form className="appointment-form" onSubmit={submit} onChange={() => setDirty(true)}>
    <header><div><span className="eyebrow">{appointment ? 'Editar compromisso' : 'Novo compromisso'}</span><h2>{appointment ? 'Configurar agendamento' : 'Adicionar à agenda'}</h2></div><button type="button" aria-label="Fechar" className="icon-button" onClick={requestClose}>×</button></header>
    <div className="appointment-form__body">
      <label className="field"><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value as AppointmentCategory)}>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      {requiresPatient && <><label className="field"><span>Paciente</span><select value={patientId} onChange={(event) => setPatientId(event.target.value)} required><option value="">Selecionar paciente</option>{workspace.patients.map((item) => <option value={item.id} key={item.id}>{item.fullName}</option>)}</select></label>{patient && <p className="appointment-patient"><strong>{patient.fullName}</strong><span>{patient.email} · {patient.phone}</span></p>}<label className="field"><span>Serviço</span><select value={serviceId} onChange={(event) => selectService(event.target.value)}><option value="">Sem serviço associado</option>{activeServices.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.defaultDurationMinutes} min</option>)}</select></label></>}
      {category === 'personal' && <label className="field private-field"><span>Nome privado do compromisso</span><input name="privateTitle" defaultValue={appointment?.privateTitle ?? ''} placeholder={appointment && !appointment.privateTitle ? 'Detalhe protegido' : undefined} maxLength={200} required={!appointment} /><small>Visível somente para o profissional responsável.</small></label>}
      <div className="field-grid field-grid--2"><label className="field"><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className="field"><span>Horário</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label></div>
      <div className="field-grid field-grid--2"><label className="field"><span>Duração</span><input type="number" min="15" max="480" step="5" value={duration} onChange={(event) => setDuration(Number(event.target.value))} required /></label><label className="field"><span>Estado</span><select name="status" defaultValue={appointment?.status ?? 'scheduled'}><option value="scheduled">Agendada</option><option value="confirmed">Confirmada</option><option value="completed">Realizada</option><option value="canceled">Cancelada</option><option value="no-show">Não compareceu</option></select></label></div>
      {conflict && <p className="schedule-conflict" role="alert"><AlertTriangle size={15} />Este horário conflita com outro compromisso. Escolha outro horário ou profissional.</p>}
      <label className="field"><span>Observação administrativa <small>opcional</small></span><textarea name="administrativeNote" defaultValue={appointment?.administrativeNote ?? ''} rows={3} /></label>
      {!appointment && <div className="field-grid field-grid--2"><label className="field"><span>Recorrência</span><select value={recurrence} onChange={(event) => setRecurrence(event.target.value as RecurrenceFrequency)}><option value="none">Compromisso único</option><option value="weekly">Semanal</option><option value="biweekly">Quinzenal</option><option value="monthly">Mensal</option></select></label>{recurrence !== 'none' && <label className="field"><span>Data final <small>opcional</small></span><input type="date" name="recurrenceEndsOn" min={date} /></label>}</div>}
      {appointment?.seriesId && <fieldset className="scope-choice"><legend>Aplicar alteração</legend><label><input type="radio" checked={scope === 'occurrence'} onChange={() => setScope('occurrence')} />Somente esta ocorrência</label><label><input type="radio" checked={scope === 'series'} onChange={() => setScope('series')} />Toda a série</label></fieldset>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
    <footer>{appointment && onCancelAppointment ? <button type="button" className="button button--danger" disabled={busy} onClick={async () => { if (!window.confirm(scope === 'series' ? 'Cancelar todas as ocorrências desta série?' : 'Cancelar somente esta ocorrência?')) return; setBusy(true); try { await onCancelAppointment(scope) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao cancelar.') } finally { setBusy(false) } }}><Trash2 size={15} />Cancelar</button> : <span />}<div><button type="button" className="button button--ghost" onClick={requestClose}>Fechar</button><button className="button button--primary" disabled={busy || conflict}>{busy ? <LoaderCircle className="spin" /> : <Save size={15} />}Salvar</button></div></footer>
  </form>
}
