import { lazy, Suspense, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { ProfessionalAuthPanel } from './auth/ProfessionalAuthPanel'
import { SupabaseProfessionalAuthService } from './auth/SupabaseProfessionalAuthService'
import type { ProfessionalIdentity } from './auth/types'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { PatientsPage } from './pages/PatientsPage'
import { PatientDetailPage } from './pages/PatientDetailPage'
import { AssessmentsPage } from './pages/AssessmentsPage'
import { MealPlansPage } from './pages/MealPlansPage'
import { ManagementPage } from './pages/ManagementPage'
import { SecurityPage } from './pages/SecurityPage'
import { AgendaPage } from './pages/AgendaPage'
import { FinancialPage } from './pages/FinancialPage'
import { WorkspaceProvider } from './state/WorkspaceContext'
import { SupabaseNutritionRepository } from './data/SupabaseNutritionRepository'
import type { NutritionRepository } from './data/repository'
import { getSupabaseRuntime, type SupabaseRuntime } from './lib/supabase'

const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then((module) => ({ default: module.DocumentsPage })))

type WorkspaceRoutesProps = {
  repository?: NutritionRepository
  mode?: 'demo' | 'supabase'
  identity?: ProfessionalIdentity
  organizationId?: string
  onOrganizationChange?: (organizationId: string) => void
  onSignOut?: () => Promise<void>
}

function WorkspaceRoutes({ repository, mode = 'demo', identity, organizationId, onOrganizationChange, onSignOut }: WorkspaceRoutesProps) {
  const membership = identity?.memberships.find((item) => item.organizationId === organizationId) ?? identity?.memberships[0]
  const documentsAuthorized = mode === 'demo' || Boolean(membership?.clinicalAccess && membership.role !== 'reception')
  return (
    <WorkspaceProvider repository={repository}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell mode={mode} identity={identity} organizationId={organizationId} onOrganizationChange={onOrganizationChange} onSignOut={onSignOut} />}>
            <Route index element={<DashboardPage />} />
            <Route path="pacientes" element={<PatientsPage />} />
            <Route path="pacientes/:patientId" element={<PatientDetailPage />} />
            <Route path="avaliacoes" element={<AssessmentsPage />} />
            <Route path="planos" element={<MealPlansPage />} />
            <Route path="gestao" element={<ManagementPage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="financeiro" element={<FinancialPage />} />
            <Route path="documentos" element={<Suspense fallback={<div className="skeleton-list"><span className="skeleton" /><span className="skeleton" /></div>}><DocumentsPage authorized={documentsAuthorized} /></Suspense>} />
            {mode === 'supabase' && <Route path="seguranca" element={<SecurityPage />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WorkspaceProvider>
  )
}

function RealDataGate({ runtime, identity, onSignOut }: { runtime: SupabaseRuntime; identity: ProfessionalIdentity; onSignOut: () => Promise<void> }) {
  return <main className="approval-page"><section className="approval-card"><span className="auth-icon">🔒</span><span className="eyebrow">Integração protegida</span><h1>Operação real ainda bloqueada</h1><p>O login foi validado pelo Supabase Auth, mas pacientes e registros clínicos permanecem inacessíveis até a homologação remota de RLS, backup e restauração.</p><dl><div><dt>Projeto</dt><dd>{runtime.projectRef}</dd></div><div><dt>Conta</dt><dd>{identity.email}</dd></div><div><dt>Organizações ativas</dt><dd>{identity.memberships.length}</dd></div></dl><button className="button button--soft" type="button" onClick={() => void onSignOut()}>Encerrar sessão</button></section></main>
}

function SupabaseSession({ runtime }: { runtime: SupabaseRuntime }) {
  const { state, signOut } = useAuth()
  const firstOrganization = state.identity?.memberships[0]?.organizationId ?? ''
  const [selectedOrganization, setSelectedOrganization] = useState(firstOrganization)
  const organizationId = state.identity?.memberships.some((item) => item.organizationId === selectedOrganization) ? selectedOrganization : firstOrganization
  const repository = useMemo(() => organizationId ? new SupabaseNutritionRepository(runtime.client, organizationId) : undefined, [organizationId, runtime.client])

  if (state.status !== 'signed-in') return <ProfessionalAuthPanel />
  if (!runtime.realDataApproved) return <RealDataGate runtime={runtime} identity={state.identity} onSignOut={signOut} />
  if (!repository) return <RealDataGate runtime={runtime} identity={state.identity} onSignOut={signOut} />
  return <WorkspaceRoutes repository={repository} mode="supabase" identity={state.identity} organizationId={organizationId} onOrganizationChange={setSelectedOrganization} onSignOut={signOut} />
}

export function App() {
  const runtime = getSupabaseRuntime()
  if (!runtime) return <WorkspaceRoutes />
  const service = new SupabaseProfessionalAuthService(runtime.client)
  return <AuthProvider service={service}><SupabaseSession runtime={runtime} /></AuthProvider>
}
