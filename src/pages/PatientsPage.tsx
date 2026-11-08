import { ChevronRight, Mail, Plus, Search, SlidersHorizontal, UserRoundSearch } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { Modal } from '../components/Modal'
import { PatientForm } from '../components/PatientForm'
import type { PatientAdministrative } from '../domain/models'
import { ageFromBirthDate } from '../domain/nutrition'
import { formatDateTime, initials, statusLabel } from '../lib/format'
import { useWorkspace } from '../state/WorkspaceContext'

export function PatientsPage() {
  const { workspace, loading, createPatient, updatePatient } = useWorkspace()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState<PatientAdministrative | null | 'new'>(null)
  const navigate = useNavigate()

  const patients = useMemo(() => workspace.patients.filter((patient) => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    const matchesQuery = !normalized || [patient.fullName, patient.email, patient.phone].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized))
    return matchesQuery && (status === 'all' || patient.status === status)
  }), [workspace.patients, query, status])

  if (loading) return <LoadingState lines={7} />

  return (
    <div className="page-stack">
      <section className="section-intro"><div><h2>Seus pacientes</h2><p>Cadastros administrativos separados dos registros clínicos.</p></div><button className="button button--primary" type="button" onClick={() => setEditing('new')}><Plus size={17} /> Novo paciente</button></section>

      <section className="panel patients-panel">
        <header className="patient-toolbar">
          <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, e-mail ou telefone" aria-label="Buscar pacientes" />{query && <button type="button" onClick={() => setQuery('')}>Limpar</button>}</label>
          <label className="select-field"><SlidersHorizontal size={17} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status"><option value="all">Todos os status</option><option value="active">Em acompanhamento</option><option value="follow-up">Retorno</option><option value="paused">Pausados</option></select></label>
        </header>

        <div className="table-meta"><span>{patients.length} {patients.length === 1 ? 'paciente encontrado' : 'pacientes encontrados'}</span><span>Dados fictícios</span></div>
        {patients.length ? <div className="patient-list" role="list">
          {patients.map((patient) => <article className="patient-row" key={patient.id} role="listitem">
            <Link className="patient-row__main" to={`/pacientes/${patient.id}`}>
              <span className="avatar">{initials(patient.fullName)}</span>
              <div className="patient-identity"><strong>{patient.fullName}</strong><span>{ageFromBirthDate(patient.birthDate)} anos · {patient.phone}</span></div>
            </Link>
            <div className="patient-contact"><Mail size={15} /><span>{patient.email}</span></div>
            <div className="patient-next"><span>Próxima consulta</span><strong>{formatDateTime(patient.nextAppointment)}</strong></div>
            <span className={`status status--${patient.status}`}><i />{statusLabel(patient.status)}</span>
            <div className="patient-row__actions"><button className="text-button" type="button" onClick={() => setEditing(patient)}>Editar</button><Link className="icon-button" to={`/pacientes/${patient.id}`} aria-label={`Abrir ${patient.fullName}`}><ChevronRight size={18} /></Link></div>
          </article>)}
        </div> : <EmptyState icon={UserRoundSearch} title="Nenhum paciente encontrado" description="Ajuste a busca ou cadastre um novo paciente fictício para esta sessão." action={<button className="button button--soft" type="button" onClick={() => { setQuery(''); setStatus('all') }}>Limpar filtros</button>} />}
      </section>

      {editing && <Modal title={editing === 'new' ? 'Novo paciente' : 'Editar paciente'} eyebrow="Cadastro administrativo" onClose={() => setEditing(null)} size="large"><PatientForm patient={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSubmit={async (input) => {
        if (editing === 'new') {
          const newId = await createPatient(input)
          setEditing(null)
          navigate(`/pacientes/${newId}`)
        } else {
          await updatePatient(editing.id, input)
          setEditing(null)
        }
      }} /></Modal>}
    </div>
  )
}
