import { BrainCircuit, CalendarDays, ClipboardList, FileText, UserRound, Utensils, X } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { initials } from '../lib/format'
import { useWorkspace } from '../state/WorkspaceContext'

const journeyLinks = [
  { to: (id: string) => `/pacientes/${id}`, label: 'Resumo', icon: UserRound },
  { to: () => '/avaliacoes', label: 'Avaliações', icon: ClipboardList },
  { to: () => '/planos', label: 'Plano', icon: Utensils },
  { to: () => '/intelligence', label: 'Evolução', icon: BrainCircuit },
  { to: () => '/documentos', label: 'Documentos', icon: FileText },
  { to: () => '/agenda', label: 'Agenda', icon: CalendarDays },
]

export function PatientJourneyBar() {
  const { workspace, selectedPatientId, selectPatient } = useWorkspace()
  const location = useLocation()
  const patient = workspace.patients.find((item) => item.id === selectedPatientId)
  if (!patient || location.pathname === '/' || location.pathname.startsWith('/portal')) return null

  return <section className="patient-journey" aria-label="Contexto clínico atual">
    <div className="patient-journey__patient"><span className="avatar avatar--sm">{initials(patient.fullName)}</span><div><small>Paciente em contexto</small><strong>{patient.fullName}</strong></div></div>
    <nav aria-label="Atalhos clínicos">{journeyLinks.map(({ to, label, icon: Icon }) => <NavLink key={label} to={to(patient.id)} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={15} /><span>{label}</span></NavLink>)}</nav>
    <label className="patient-journey__switch"><span>Trocar paciente</span><select value={patient.id} onChange={(event) => selectPatient(event.target.value)} aria-label="Trocar contexto clínico">{workspace.patients.map((item) => <option value={item.id} key={item.id}>{item.fullName}</option>)}</select></label>
    <button className="icon-button" type="button" onClick={() => selectPatient('')} aria-label="Encerrar contexto clínico"><X size={16} /></button>
  </section>
}
