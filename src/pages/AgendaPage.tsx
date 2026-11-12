import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AppointmentForm } from '../components/AppointmentForm'
import type { Appointment } from '../domain/models'
import { dateInScheduleTimeZone, timeInScheduleTimeZone } from '../domain/scheduling'
import { formatDate } from '../lib/format'
import { useWorkspace } from '../state/WorkspaceContext'

const categoryLabel = { 'nutrition-consultation': 'Consulta', 'follow-up': 'Retorno', 'lunch-break': 'Almoço', personal: 'Particular' } as const
const statusLabel = { scheduled: 'Agendada', confirmed: 'Confirmada', completed: 'Realizada', canceled: 'Cancelada', 'no-show': 'Não compareceu' } as const
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const today = () => dateInScheduleTimeZone(new Date().toISOString())
const hours = Array.from({ length: 14 }, (_, index) => index + 7)

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return isoDate(value)
}

function addMonths(date: string, months: number) {
  const current = new Date(`${date}T12:00:00Z`)
  const desiredDay = current.getUTCDate()
  const target = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + months, 1, 12))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate()
  target.setUTCDate(Math.min(desiredDay, lastDay))
  return isoDate(target)
}

function eventsOverlap(left: Appointment, right: Appointment) {
  return left.id !== right.id && left.professionalId === right.professionalId && left.status !== 'canceled' && right.status !== 'canceled'
    && new Date(left.startsAt) < new Date(right.endsAt) && new Date(left.endsAt) > new Date(right.startsAt)
}

export function AgendaPage() {
  const { workspace, saveAppointment, cancelAppointment, selectedPatientId, selectPatient } = useWorkspace()
  const [view, setView] = useState<'day' | 'week' | 'month'>('week')
  const [selectedDate, setSelectedDate] = useState(today)
  const [editor, setEditor] = useState<{ appointment?: Appointment; date: string; time: string } | null>(null)
  const [professional, setProfessional] = useState('all')
  const [patientScope, setPatientScope] = useState(Boolean(selectedPatientId))
  const professionals = useMemo(() => Array.from(new Map(workspace.appointments.map((item) => [item.professionalId, item.professionalLabel])).entries()), [workspace.appointments])
  const visible = workspace.appointments.filter((item) => (professional === 'all' || item.professionalId === professional) && (!patientScope || !selectedPatientId || item.patientId === selectedPatientId))
  const weekStart = useMemo(() => {
    const date = new Date(`${selectedDate}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
    return isoDate(date)
  }, [selectedDate])
  const days = view === 'day' ? [selectedDate] : view === 'week'
    ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
    : (() => {
      const start = new Date(`${selectedDate.slice(0, 7)}-01T12:00:00Z`)
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
      return Array.from({ length: 42 }, (_, index) => addDays(isoDate(start), index))
    })()
  const eventsFor = (date: string) => visible.filter((item) => dateInScheduleTimeZone(item.startsAt) === date).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const patientName = (id?: string) => workspace.patients.find((item) => item.id === id)?.fullName
  const openEvent = (item: Appointment) => {
    const date = dateInScheduleTimeZone(item.startsAt)
    setSelectedDate(date)
    setEditor({ appointment: item, date, time: timeInScheduleTimeZone(item.startsAt) })
    if (item.patientId) selectPatient(item.patientId)
  }
  const eventTitle = (item: Appointment) => item.category === 'personal'
    ? item.privateTitle || 'Compromisso particular'
    : patientName(item.patientId) || item.title
  const move = (direction: -1 | 1) => setSelectedDate(view === 'month' ? addMonths(selectedDate, direction) : addDays(selectedDate, direction * (view === 'week' ? 7 : 1)))

  return <div className="page-stack agenda-page">
    <section className="agenda-heading">
      <div><h2>Agenda profissional</h2><p>Consultas, bloqueios e compromissos operacionais por profissional.</p></div>
      <button className="button button--primary" onClick={() => setEditor({ date: selectedDate, time: '09:00' })}><Plus size={16} />Novo agendamento</button>
    </section>
    <section className="panel agenda-toolbar">
      <div className="agenda-navigation">
        <button className="icon-button" aria-label="Período anterior" onClick={() => move(-1)}><ChevronLeft /></button>
        <button className="button button--ghost" onClick={() => setSelectedDate(today())}>Hoje</button>
        <button className="icon-button" aria-label="Próximo período" onClick={() => move(1)}><ChevronRight /></button>
        <strong>{formatDate(selectedDate)}</strong>
      </div>
      <div className="agenda-controls">
        {selectedPatientId && <button type="button" className={`patient-scope-toggle ${patientScope ? 'active' : ''}`} onClick={() => setPatientScope((value) => !value)}>{patientScope ? 'Somente paciente atual' : 'Toda a agenda'}</button>}
        <select value={professional} onChange={(event) => setProfessional(event.target.value)} aria-label="Filtrar profissional"><option value="all">Todos os profissionais</option>{professionals.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
        <div className="view-switch">{(['day', 'week', 'month'] as const).map((item) => <button className={view === item ? 'active' : ''} onClick={() => setView(item)} key={item}>{item === 'day' ? 'Dia' : item === 'week' ? 'Semana' : 'Mês'}</button>)}</div>
      </div>
    </section>

    {view === 'month' ? <section className="panel calendar-grid calendar-grid--month">
      <header>{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((label) => <div key={label}><span>{label}</span></div>)}</header>
      <div className="calendar-grid__body">{days.map((day) => <button className={`calendar-day month-day ${day.slice(0, 7) !== selectedDate.slice(0, 7) ? 'outside' : ''}`} key={day} onClick={() => { setSelectedDate(day); setView('day') }}>
        <strong className={day === today() ? 'today' : ''}>{Number(day.slice(8))}</strong>
        {eventsFor(day).slice(0, 3).map((item) => <span key={item.id} className={`month-event event--${item.category}`}>{timeInScheduleTimeZone(item.startsAt)} {eventTitle(item)}</span>)}
        {eventsFor(day).length > 3 && <small>+{eventsFor(day).length - 3} compromissos</small>}
      </button>)}</div>
    </section> : <section className={`panel time-calendar calendar-grid--${view}`}>
      <header className="time-calendar__header"><span className="time-gutter" />{days.map((day) => <button key={day} className={day === selectedDate ? 'selected' : ''} onClick={() => setSelectedDate(day)}><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))}</span><strong>{day.slice(8)}</strong></button>)}</header>
      <div className="time-calendar__body">{hours.map((hour) => <div className="time-row" key={hour}><time>{String(hour).padStart(2, '0')}:00</time>{days.map((day) => {
        const slotEvents = eventsFor(day).filter((item) => Number(timeInScheduleTimeZone(item.startsAt).slice(0, 2)) === hour)
        return <div className="time-slot" key={day}><button aria-label={`Criar agendamento em ${day} às ${hour}:00`} onClick={() => { setSelectedDate(day); setEditor({ date: day, time: `${String(hour).padStart(2, '0')}:00` }) }} />
          {slotEvents.map((item) => {
            const conflict = visible.some((other) => eventsOverlap(item, other))
            return <button key={item.id} className={`calendar-event event--${item.category} ${item.status === 'canceled' ? 'is-canceled' : ''} ${conflict ? 'has-conflict' : ''}`} onClick={() => openEvent(item)}>
              <time>{timeInScheduleTimeZone(item.startsAt)}</time><strong>{eventTitle(item)}</strong><span>{categoryLabel[item.category]} · {statusLabel[item.status]}</span>{conflict && <AlertTriangle aria-label="Conflito de horário" size={12} />}
            </button>
          })}
        </div>
      })}</div>)}</div>
    </section>}

    <section className="mobile-day-list" aria-label="Compromissos do dia selecionado"><header><strong>{formatDate(selectedDate)}</strong><span>{eventsFor(selectedDate).length} compromisso(s)</span></header>{eventsFor(selectedDate).length === 0 ? <p>Nenhum compromisso neste dia. Toque em um horário livre para adicionar.</p> : eventsFor(selectedDate).map((item) => <button key={item.id} className={`calendar-event event--${item.category}`} onClick={() => openEvent(item)}><time>{timeInScheduleTimeZone(item.startsAt)}</time><strong>{eventTitle(item)}</strong><span>{statusLabel[item.status]}</span></button>)}</section>
    <div className="agenda-legend">{Object.entries(categoryLabel).map(([key, label]) => <span key={key}><i className={`event--${key}`} />{label}</span>)}</div>
    {editor && <div className="schedule-drawer-backdrop"><aside className="schedule-drawer" aria-label="Configurar agendamento"><AppointmentForm workspace={workspace} appointment={editor.appointment} initialDate={editor.date} initialTime={editor.time} initialPatientId={selectedPatientId} professionalId={professional === 'all' ? undefined : professional} onClose={() => setEditor(null)} onSave={async (input, scope) => { await saveAppointment(input, editor.appointment, scope); if (input.patientId) selectPatient(input.patientId); setEditor(null) }} onCancelAppointment={editor.appointment ? async (scope) => { await cancelAppointment(editor.appointment!, scope); setEditor(null) } : undefined} /></aside></div>}
  </div>
}
