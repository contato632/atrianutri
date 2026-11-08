import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { PatientsPage } from './pages/PatientsPage'
import { PatientDetailPage } from './pages/PatientDetailPage'
import { AssessmentsPage } from './pages/AssessmentsPage'
import { MealPlansPage } from './pages/MealPlansPage'
import { ManagementPage } from './pages/ManagementPage'
import { WorkspaceProvider } from './state/WorkspaceContext'

export function App() {
  return (
    <WorkspaceProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="pacientes" element={<PatientsPage />} />
            <Route path="pacientes/:patientId" element={<PatientDetailPage />} />
            <Route path="avaliacoes" element={<AssessmentsPage />} />
            <Route path="planos" element={<MealPlansPage />} />
            <Route path="gestao" element={<ManagementPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WorkspaceProvider>
  )
}
