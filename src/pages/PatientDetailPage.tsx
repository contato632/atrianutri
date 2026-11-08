import { ArrowLeft, CalendarDays, ClipboardList, Edit3, LockKeyhole, Mail, Phone, Ruler, Utensils } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { LoadingState } from '../components/LoadingState'
import { Modal } from '../components/Modal'
import { AnamnesisForm } from '../components/AnamnesisForm'
import { FoodDiaryPanel } from '../components/FoodDiaryPanel'
import { PatientForm } from '../components/PatientForm'
import { ageFromBirthDate, interpretAdultBmi } from '../domain/nutrition'
import { formatDate, formatDateTime, initials, statusLabel } from '../lib/format'
import { useWorkspace } from '../state/WorkspaceContext'

export function PatientDetailPage() {
  const { patientId } = useParams()
  const { workspace, loading, updatePatient, saveClinicalProfile } = useWorkspace()
  const [editing, setEditing] = useState(false)
  const [editingClinical, setEditingClinical] = useState(false)
  if (loading) return <LoadingState lines={6} />
  const patient = workspace.patients.find((item) => item.id === patientId)
  if (!patient) return <Navigate to="/pacientes" replace />

  const clinical = workspace.clinicalProfiles.find((item) => item.patientId === patient.id)
  const assessments = workspace.assessments.filter((item) => item.patientId === patient.id).sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))
  const latest = assessments[0]
  const plan = workspace.mealPlans.find((item) => item.patientId === patient.id)
  const bmi = latest ? interpretAdultBmi(latest.bmi) : null

  return (
    <div className="page-stack">
      <Link className="back-link" to="/pacientes"><ArrowLeft size={16} /> Voltar para pacientes</Link>
      <section className="patient-hero panel">
        <div className="patient-hero__identity"><span className="avatar avatar--xl">{initials(patient.fullName)}</span><div><div className="patient-hero__name"><h2>{patient.fullName}</h2><span className={`status status--${patient.status}`}><i />{statusLabel(patient.status)}</span></div><p>{ageFromBirthDate(patient.birthDate)} anos · Paciente desde {formatDate(patient.createdAt)}</p></div></div>
        <button type="button" className="button button--soft" onClick={() => setEditing(true)}><Edit3 size={16} /> Editar cadastro</button>
      </section>

      <div className="detail-grid">
        <section className="panel detail-card">
          <header><span className="detail-icon"><Mail size={17} /></span><div><span className="eyebrow">Administrativo</span><h3>Contato e agenda</h3></div></header>
          <dl className="detail-list"><div><dt>E-mail</dt><dd>{patient.email}</dd></div><div><dt>Telefone</dt><dd><Phone size={14} /> {patient.phone}</dd></div><div><dt>Próxima consulta</dt><dd><CalendarDays size={14} /> {formatDateTime(patient.nextAppointment)}</dd></div></dl>
        </section>

        <section className="panel detail-card clinical-card">
          <header><span className="detail-icon"><LockKeyhole size={17} /></span><div><span className="eyebrow">Acesso clínico restrito</span><h3>Contexto nutricional</h3></div></header>
          <dl className="detail-list">
            <div><dt>Objetivo do acompanhamento</dt><dd className="anamnesis-preview">{clinical?.goal || 'Ainda não informado'}</dd></div>
            <div><dt>Histórico alimentar</dt><dd className="anamnesis-preview">{clinical?.foodHistory || 'Ainda não registrado'}</dd></div>
            <div><dt>Hábitos e rotina</dt><dd className="anamnesis-preview">{clinical?.habits || 'Ainda não registrado'}</dd></div>
            <div><dt>Observações profissionais</dt><dd className="anamnesis-preview">{clinical?.professionalNotes || 'Nenhuma observação registrada'}</dd></div>
          </dl>
          <button type="button" className="button button--soft anamnesis-open" onClick={() => setEditingClinical(true)}><ClipboardList size={16} /> {clinical ? 'Editar anamnese' : 'Registrar anamnese'}</button>
          <p className="privacy-note"><LockKeyhole size={13} /> Registros clínicos acessíveis somente a profissionais autorizados.</p>
        </section>

        <section className="panel detail-card">
          <header><span className="detail-icon"><Ruler size={17} /></span><div><span className="eyebrow">Última avaliação</span><h3>Antropometria</h3></div></header>
          {latest ? <><div className="measure-row"><div><span>Peso</span><strong>{latest.weightKg.toLocaleString('pt-BR')} <small>kg</small></strong></div><div><span>IMC</span><strong>{latest.bmi.toFixed(1)}</strong></div><div><span>Cintura</span><strong>{latest.waistCm?.toLocaleString('pt-BR') ?? '—'} <small>cm</small></strong></div></div><div className="bmi-inline"><span className={`bmi-dot bmi-dot--${bmi?.tone}`} /> <div><strong>{bmi?.label}</strong><span>{bmi?.description}</span></div></div></> : <p className="muted-copy">Nenhuma avaliação registrada.</p>}
          <Link className="text-button detail-link" to="/avaliacoes"><ClipboardList size={15} /> Ver histórico completo</Link>
        </section>

        <section className="panel detail-card">
          <header><span className="detail-icon"><Utensils size={17} /></span><div><span className="eyebrow">Planejamento</span><h3>Plano alimentar</h3></div></header>
          {plan ? <div className="plan-summary"><span className="status status--follow-up"><i />Versão {plan.version} · Rascunho</span><strong>{plan.title}</strong><p>{plan.meals.length} refeições organizadas · Atualizado {formatDate(plan.updatedAt)}</p></div> : <p className="muted-copy">Nenhum plano iniciado para este paciente.</p>}
          <Link className="text-button detail-link" to="/planos"><Utensils size={15} /> {plan ? 'Abrir plano' : 'Criar plano manual'}</Link>
        </section>
      </div>

      <FoodDiaryPanel patientId={patient.id} />

      {editingClinical && <Modal title="Anamnese nutricional" eyebrow="Registro clínico restrito" onClose={() => setEditingClinical(false)} size="large">
        <AnamnesisForm profile={clinical} onCancel={() => setEditingClinical(false)} onSubmit={async (input, expectedUpdatedAt) => {
          await saveClinicalProfile(patient.id, input, expectedUpdatedAt)
          setEditingClinical(false)
        }} />
      </Modal>}
      {editing && <Modal title="Editar paciente" eyebrow="Cadastro administrativo" onClose={() => setEditing(false)} size="large"><PatientForm patient={patient} onCancel={() => setEditing(false)} onSubmit={async (input) => { await updatePatient(patient.id, input); setEditing(false) }} /></Modal>}
    </div>
  )
}
