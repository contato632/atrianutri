import { ArrowRight, CalendarCheck2, CheckCircle2, ClipboardPlus, Clock3, ListTodo, Plus, TrendingDown, Users, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LoadingState } from '../components/LoadingState'
import { APP_TIME_ZONE, currentDateInBahia, formatDate, initials, relativeDateLabel } from '../lib/format'
import { useWorkspace } from '../state/WorkspaceContext'

export function DashboardPage() {
  const { workspace, loading } = useWorkspace()
  if (loading) return <LoadingState lines={6} />

  const activePatients = workspace.patients.filter((patient) => patient.status !== 'paused')
  const today = currentDateInBahia()
  const upcoming = workspace.patients.filter((patient) => patient.nextAppointment && currentDateInBahia(new Date(patient.nextAppointment)) >= today).sort((a, b) => (a.nextAppointment ?? '').localeCompare(b.nextAppointment ?? '')).slice(0, 3)
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
        <article className="metric-card"><span className="metric-card__icon teal"><CalendarCheck2 /></span><div><span>Consultas próximas</span><strong>{upcoming.length}</strong><small>Nos próximos dias</small></div></article>
        <article className="metric-card"><span className="metric-card__icon violet"><TrendingDown /></span><div><span>Avaliações registradas</span><strong>{workspace.assessments.length}</strong><small>Evolução longitudinal disponível</small></div></article>
        <article className="metric-card"><span className="metric-card__icon amber"><ListTodo /></span><div><span>Planos em rascunho</span><strong>{draftPlans.length}</strong><small>{draftPlans.length ? 'Requer revisão profissional' : 'Tudo revisado'}</small></div></article>
      </section>

      <div className="dashboard-grid">
        <section className="panel dashboard-schedule">
          <header className="panel__header"><div><span className="eyebrow">Agenda</span><h3>Próximas consultas</h3></div><Link to="/agenda" className="text-button">Ver agenda <ArrowRight size={15} /></Link></header>
          <div className="appointment-list">
            {upcoming.map((patient) => { const appointment = workspace.appointments.find((item) => item.patientId === patient.id && item.startsAt === patient.nextAppointment); const duration = appointment ? Math.round((new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) / 60_000) : 50; return <article className="appointment-item" key={patient.id}>
              <div className="appointment-time"><strong>{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE }).format(new Date(patient.nextAppointment!))}</strong><span>{relativeDateLabel(patient.nextAppointment!)}</span></div>
              <span className="avatar avatar--sm">{initials(patient.fullName)}</span>
              <div className="appointment-person"><strong>{patient.fullName}</strong><span>{appointment?.category === 'follow-up' ? 'Retorno nutricional' : 'Acompanhamento'}</span></div>
              <span className="tag tag--subtle"><Clock3 size={13} /> {duration} min</span>
            </article>})}
          </div>
        </section>

        <section className="panel attention-panel">
          <header className="panel__header"><div><span className="eyebrow">Acompanhamento</span><h3>Pendências</h3></div></header>
          <div className="task-list">
            <Link to="/planos" className="task-item"><span className="task-icon amber"><UtensilsCrossed size={17} /></span><div><strong>Revisar plano de Ana</strong><span>Rascunho atualizado recentemente</span></div><ArrowRight size={16} /></Link>
            <Link to="/avaliacoes" className="task-item"><span className="task-icon blue"><ClipboardPlus size={17} /></span><div><strong>Avaliação de Luiza</strong><span>Primeira avaliação pendente</span></div><ArrowRight size={16} /></Link>
            <div className="task-item task-item--done"><span className="task-icon green"><CheckCircle2 size={17} /></span><div><strong>Feedback de Rafael</strong><span>Registrado nesta semana</span></div></div>
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
