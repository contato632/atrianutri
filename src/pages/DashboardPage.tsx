import { ArrowRight, CalendarCheck2, CheckCircle2, ClipboardPlus, Clock3, ListTodo, Plus, TrendingDown, Users, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LoadingState } from '../components/LoadingState'
import { APP_TIME_ZONE, currentDateInBahia, formatDate, initials, relativeDateLabel } from '../lib/format'
import { useWorkspace } from '../state/WorkspaceContext'

export function DashboardPage() {
  const { workspace, loading, selectPatient } = useWorkspace()
  if (loading) return <LoadingState lines={6} />

  const activePatients = workspace.patients.filter((patient) => patient.status !== 'paused')
  const today = currentDateInBahia()
  const upcomingAppointments = workspace.appointments.filter((appointment) => appointment.patientId && appointment.status !== 'canceled' && currentDateInBahia(new Date(appointment.startsAt)) >= today).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const upcoming = upcomingAppointments.slice(0, 3)
  const recentAssessments = [...workspace.assessments].sort((a, b) => b.assessedAt.localeCompare(a.assessedAt)).slice(0, 3)
  const draftPlans = workspace.mealPlans.filter((plan) => plan.status === 'draft')

  return (
    <div className="page-stack">
      <section className="welcome-row">
        <div><h2>Bom dia, Marina.</h2><p>Acompanhe o que merece sua atenção hoje.</p></div>
        <div className="welcome-actions"><Link to="/avaliacoes" className="button button--soft"><ClipboardPlus size={17} /> Nova avaliação</Link><Link to="/pacientes" className="button button--primary"><Plus size={17} /> Novo paciente</Link></div>
      </section>

      <section className="metric-grid" aria-label="Indicadores do consultório">
        <article className="metric-card"><span className="metric-card__icon blue"><Users /></span><div><span>Pacientes acompanhados</span><strong>{activePatients.length}</strong><small><span className="positive-dot" /> {activePatients.filter((p) => p.status === 'active').length} em acompanhamento ativo</small></div></article>
        <article className="metric-card"><span className="metric-card__icon teal"><CalendarCheck2 /></span><div><span>Consultas próximas</span><strong>{upcomingAppointments.length}</strong><small>Agendamentos futuros registrados</small></div></article>
        <article className="metric-card"><span className="metric-card__icon violet"><TrendingDown /></span><div><span>Avaliações registradas</span><strong>{workspace.assessments.length}</strong><small>Evolução longitudinal disponível</small></div></article>
        <article className="metric-card"><span className="metric-card__icon amber"><ListTodo /></span><div><span>Planos em rascunho</span><strong>{draftPlans.length}</strong><small>{draftPlans.length ? 'Requer revisão profissional' : 'Tudo revisado'}</small></div></article>
      </section>

      <div className="dashboard-grid">
        <section className="panel dashboard-schedule">
          <header className="panel__header"><div><span className="eyebrow">Agenda</span><h3>Próximas consultas</h3></div><Link to="/agenda" className="text-button">Ver agenda <ArrowRight size={15} /></Link></header>
          <div className="appointment-list">
            {upcoming.map((appointment) => { const patient = workspace.patients.find((item) => item.id === appointment.patientId); const duration = Math.round((new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) / 60_000); return <Link to="/agenda" onClick={() => patient && selectPatient(patient.id)} className="appointment-item" key={appointment.id}>
              <div className="appointment-time"><strong>{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE }).format(new Date(appointment.startsAt))}</strong><span>{relativeDateLabel(appointment.startsAt)}</span></div>
              <span className="avatar avatar--sm">{initials(patient?.fullName ?? 'Paciente')}</span>
              <div className="appointment-person"><strong>{patient?.fullName ?? 'Paciente não associado'}</strong><span>{appointment.category === 'follow-up' ? 'Retorno nutricional' : 'Acompanhamento'}</span></div>
              <span className="tag tag--subtle"><Clock3 size={13} /> {duration} min</span>
            </Link>})}
            {!upcoming.length && <p className="dashboard-empty">Nenhuma consulta futura registrada.</p>}
          </div>
        </section>

        <section className="panel attention-panel">
          <header className="panel__header"><div><span className="eyebrow">Acompanhamento</span><h3>Pendências</h3></div></header>
          <div className="task-list">
            {draftPlans.slice(0, 2).map((plan) => { const patient = workspace.patients.find((item) => item.id === plan.patientId); return <Link to="/planos" onClick={() => selectPatient(plan.patientId)} className="task-item" key={plan.id}><span className="task-icon amber"><UtensilsCrossed size={17} /></span><div><strong>Revisar plano de {patient?.fullName ?? 'paciente'}</strong><span>Rascunho registrado em {formatDate(plan.updatedAt)}</span></div><ArrowRight size={16} /></Link> })}
            {activePatients.filter((patient) => !workspace.assessments.some((assessment) => assessment.patientId === patient.id)).slice(0, Math.max(0, 3 - draftPlans.length)).map((patient) => <Link to="/avaliacoes" onClick={() => selectPatient(patient.id)} className="task-item" key={patient.id}><span className="task-icon blue"><ClipboardPlus size={17} /></span><div><strong>Avaliação inicial de {patient.fullName}</strong><span>Nenhuma avaliação antropométrica registrada</span></div><ArrowRight size={16} /></Link>)}
            {!draftPlans.length && activePatients.every((patient) => workspace.assessments.some((assessment) => assessment.patientId === patient.id)) && <div className="task-item task-item--done"><span className="task-icon green"><CheckCircle2 size={17} /></span><div><strong>Nenhuma pendência calculada</strong><span>Os registros atuais não indicam ações administrativas abertas.</span></div></div>}
          </div>
        </section>
      </div>

      <section className="panel">
        <header className="panel__header"><div><span className="eyebrow">Clínico</span><h3>Evoluções recentes</h3></div><Link to="/avaliacoes" className="text-button">Todas as avaliações <ArrowRight size={15} /></Link></header>
        <div className="recent-grid">
          {recentAssessments.map((assessment) => {
            const patient = workspace.patients.find((item) => item.id === assessment.patientId)
            return <article className="recent-card" key={assessment.id}><div className="recent-card__top"><span className="avatar avatar--sm">{initials(patient?.fullName ?? 'Paciente')}</span><div><strong>{patient?.fullName}</strong><span>{formatDate(assessment.assessedAt)}</span></div><span className="tag">IMC {assessment.bmi.toFixed(1)}</span></div><p>{assessment.notes}</p><small>Registro fictício para demonstração</small></article>
          })}
        </div>
      </section>
    </div>
  )
}
