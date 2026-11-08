import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AppointmentForm } from '../components/AppointmentForm'
import type { Appointment } from '../domain/models'
import { formatDate } from '../lib/format'
import { useWorkspace } from '../state/WorkspaceContext'

const categoryLabel = { 'nutrition-consultation': 'Consulta', 'follow-up': 'Retorno', 'lunch-break': 'Almoço', personal: 'Particular' } as const
const statusLabel = { scheduled: 'Agendada', confirmed: 'Confirmada', completed: 'Realizada', canceled: 'Cancelada', 'no-show': 'Não compareceu' } as const
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return isoDate(value)
}
const localDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
const localTime = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
const today = () => localDate(new Date().toISOString())

export function AgendaPage() {
  const { workspace, saveAppointment, cancelAppointment } = useWorkspace()
  const [view, setView] = useState<'day' | 'week' | 'month'>('week')
  const [selectedDate, setSelectedDate] = useState('2026-11-09')
  const [editor, setEditor] = useState<{ appointment?: Appointment; date: string; time: string } | null>(null)
  const [professional, setProfessional] = useState('all')
  const professionals = useMemo(() => Array.from(new Map(workspace.appointments.map((item) => [item.professionalId, item.professionalLabel])).entries()), [workspace.appointments])
  const visible = workspace.appointments.filter((item) => professional === 'all' || item.professionalId === professional)
  const weekStart = (() => {
    const date = new Date(`${selectedDate}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
    return isoDate(date)
  })()
  const days = view === 'day' ? [selectedDate] : view === 'week'
    ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
    : (() => {
      const start = new Date(`${selectedDate.slice(0, 7)}-01T12:00:00Z`)
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
      return Array.from({ length: 42 }, (_, index) => addDays(isoDate(start), index))
    })()
  const eventsFor = (date: string) => visible.filter((item) => localDate(item.startsAt) === date).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const patientName = (id?: string) => workspace.patients.find((item) => item.id === id)?.fullName
  const shift = view === 'day' ? 1 : view === 'week' ? 7 : 30

  return <div className="page-stack agenda-page">
    <section className="agenda-heading">
      <div><h2>Agenda profissional</h2><p>Consultas, bloqueios e compromissos operacionais por profissional.</p></div>
      <button className="button button--primary" onClick={() => setEditor({ date: selectedDate, time: '09:00' })}><Plus size={16} />Novo agendamento</button>
    </section>
    <section className="panel agenda-toolbar">
      <div className="agenda-navigation">
        <button className="icon-button" onClick={() => setSelectedDate(addDays(selectedDate, -shift))}><ChevronLeft /></button>
        <button className="button button--ghost" onClick={() => setSelectedDate(today())}>Hoje</button>
        <button className="icon-button" onClick={() => setSelectedDate(addDays(selectedDate, shift))}><ChevronRight /></button>
        <strong>{formatDate(selectedDate)}</strong>
      </div>
      <div className="agenda-controls">
        <select value={professional} onChange={(event) => setProfessional(event.target.value)} aria-label="Filtrar profissional"><option value="all">Todos os profissionais</option>{professionals.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
        <div className="view-switch">{(['day', 'week', 'month'] as const).map((item) => <button className={view === item ? 'active' : ''} onClick={() => setView(item)} key={item}>{item === 'day' ? 'Dia' : item === 'week' ? 'Semana' : 'Mês'}</button>)}</div>
      </div>
    </section>
    <section className={`panel calendar-grid calendar-grid--${view}`}>
      <header>{days.map((day) => <div key={day} className={day === selectedDate ? 'selected' : ''}><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))}</span><strong>{day.slice(8)}</strong></div>)}</header>
      <div className="calendar-grid__body">{days.map((day) => <div className={`calendar-day ${day.slice(0, 7) !== selectedDate.slice(0, 7) && view === 'month' ? 'outside' : ''}`} key={day} onClick={() => setSelectedDate(day)}>
        {view !== 'month' && <button className="calendar-free-slot" onClick={(event) => { event.stopPropagation(); setSelectedDate(day); setEditor({ date: day, time: '09:00' }) }}>+ horário livre</button>}
        {eventsFor(day).map((item) => <button key={item.id} className={`calendar-event event--${item.category} ${item.status === 'canceled' ? 'is-canceled' : ''}`} onClick={(event) => { event.stopPropagation(); setSelectedDate(day); setEditor({ appointment: item, date: day, time: localTime(item.startsAt) }) }}><time>{localTime(item.startsAt)}</time><strong>{item.category === 'personal' ? item.privateTitle || item.title : patientName(item.patientId) || item.title}</strong><span>{categoryLabel[item.category]} · {statusLabel[item.status]}</span></button>)}
      </div>)}</div>
    </section>
    <div className="agenda-legend">{Object.entries(categoryLabel).map(([key, label]) => <span key={key}><i className={`event--${key}`} />{label}</span>)}</div>
    {editor && <div className="schedule-drawer-backdrop" onClick={() => setEditor(null)}><aside className="schedule-drawer" onClick={(event) => event.stopPropagation()}><AppointmentForm workspace={workspace} appointment={editor.appointment} initialDate={editor.date} initialTime={editor.time} onClose={() => setEditor(null)} onSave={async (input, scope) => { await saveAppointment(professional === 'all' ? input : { ...input, professionalId: professional }, editor.appointment, scope); setEditor(null) }} onCancelAppointment={editor.appointment ? async (scope) => { await cancelAppointment(editor.appointment!, scope); setEditor(null) } : undefined} /></aside></div>}
  </div>
}
