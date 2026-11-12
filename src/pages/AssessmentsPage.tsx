import { ClipboardPlus, Info, Plus, Ruler, TrendingDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AssessmentForm } from '../components/AssessmentForm'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { Modal } from '../components/Modal'
import { interpretAdultBmi } from '../domain/nutrition'
import { formatDate } from '../lib/format'
import { useWorkspace } from '../state/WorkspaceContext'

export function AssessmentsPage() {
  const { workspace, loading, createAssessment, selectedPatientId, selectPatient } = useWorkspace()
  const firstWithAssessment = workspace.assessments[0]?.patientId ?? workspace.patients[0]?.id ?? ''
  const [patientId, setPatientId] = useState(selectedPatientId || firstWithAssessment)
  const [modalOpen, setModalOpen] = useState(false)
  const patient = workspace.patients.find((item) => item.id === patientId)
  const assessments = useMemo(() => workspace.assessments.filter((item) => item.patientId === patientId).sort((a, b) => a.assessedAt.localeCompare(b.assessedAt)), [workspace.assessments, patientId])
  const latest = assessments.at(-1)
  const previous = assessments.at(-2)
  const chart = assessments.map((assessment) => ({ date: formatDate(assessment.assessedAt).replace(' de ', ' '), peso: assessment.weightKg, cintura: assessment.waistCm }))
  useEffect(() => {
    if (selectedPatientId && selectedPatientId !== patientId) setPatientId(selectedPatientId)
    else if (!patientId && workspace.patients.length) setPatientId(workspace.assessments[0]?.patientId ?? workspace.patients[0].id)
  }, [patientId, selectedPatientId, workspace.assessments, workspace.patients])
  if (loading) return <LoadingState lines={7} />

  return (
    <div className="page-stack">
      <section className="section-intro"><div><h2>Avaliação antropométrica</h2><p>Registre medidas aferidas e acompanhe a evolução com contexto.</p></div><button className="button button--primary" type="button" onClick={() => setModalOpen(true)}><Plus size={17} /> Nova avaliação</button></section>
      <section className="panel assessment-filter"><div><span className="eyebrow">Paciente selecionado</span><select value={patientId} onChange={(event) => { setPatientId(event.target.value); selectPatient(event.target.value) }} aria-label="Selecionar paciente">{workspace.patients.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></div><span className="tag tag--subtle">{assessments.length} {assessments.length === 1 ? 'registro' : 'registros'}</span></section>

      {latest ? <>
        <section className="assessment-metrics">
          <article className="mini-metric"><span><Ruler size={17} /> Peso atual</span><strong>{latest.weightKg.toLocaleString('pt-BR')} <small>kg</small></strong><em className={previous && latest.weightKg < previous.weightKg ? 'down' : ''}>{previous ? `${(latest.weightKg - previous.weightKg).toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'always' })} kg desde a anterior` : 'Primeira medida'}</em></article>
          <article className="mini-metric"><span><TrendingDown size={17} /> IMC</span><strong>{latest.bmi.toFixed(1)}</strong><em>{interpretAdultBmi(latest.bmi).label}</em></article>
          <article className="mini-metric"><span><Ruler size={17} /> Cintura</span><strong>{latest.waistCm?.toLocaleString('pt-BR') ?? '—'} <small>{latest.waistCm ? 'cm' : ''}</small></strong><em>{previous?.waistCm && latest.waistCm ? `${(latest.waistCm - previous.waistCm).toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'always' })} cm desde a anterior` : 'Sem comparativo'}</em></article>
        </section>

        <div className="assessment-layout">
          <section className="panel chart-panel"><header className="panel__header"><div><span className="eyebrow">Evolução</span><h3>Peso ao longo do tempo</h3></div><span className="chart-legend"><i /> Peso (kg)</span></header><div className="chart-wrap" aria-label="Gráfico de evolução de peso"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf2" /><XAxis dataKey="date" tick={{ fill: '#738394', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fill: '#738394', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ border: '1px solid #e2e8ee', borderRadius: 10, boxShadow: '0 8px 24px rgba(20, 45, 65, .08)' }} /><Line type="monotone" dataKey="peso" stroke="#176fa5" strokeWidth={2.5} dot={{ fill: '#fff', stroke: '#176fa5', strokeWidth: 2, r: 4 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div></section>
          <section className="panel history-panel"><header className="panel__header"><div><span className="eyebrow">Histórico</span><h3>Avaliações registradas</h3></div></header><div className="timeline">{[...assessments].reverse().map((assessment, index) => <article key={assessment.id} className="timeline-item"><span className={index === 0 ? 'current' : ''} /><div><header><strong>{formatDate(assessment.assessedAt)}</strong>{index === 0 && <em>Mais recente</em>}</header><p>{assessment.weightKg.toLocaleString('pt-BR')} kg · IMC {assessment.bmi.toFixed(1)} · Cintura {assessment.waistCm?.toLocaleString('pt-BR') ?? '—'} cm</p><small>{assessment.notes || 'Sem observações.'}</small></div></article>)}</div></section>
        </div>
        <div className="clinical-caution"><Info size={16} /><p><strong>Interpretação responsável:</strong> indicadores antropométricos apoiam a avaliação profissional, mas não constituem diagnóstico isolado. Considere idade, composição corporal, histórico e objetivos individualizados.</p></div>
      </> : <section className="panel"><EmptyState icon={ClipboardPlus} title={`Nenhuma avaliação para ${patient?.fullName ?? 'este paciente'}`} description="Registre a primeira avaliação antropométrica usando apenas dados fictícios nesta demonstração." action={<button type="button" className="button button--primary" onClick={() => setModalOpen(true)}>Nova avaliação</button>} /></section>}

      {modalOpen && <Modal title="Nova avaliação" eyebrow="Antropometria" onClose={() => setModalOpen(false)} size="large"><AssessmentForm patients={workspace.patients} initialPatientId={patientId} onCancel={() => setModalOpen(false)} onSubmit={async (input) => { await createAssessment(input); setPatientId(input.patientId); selectPatient(input.patientId); setModalOpen(false) }} /></Modal>}
    </div>
  )
}
