import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PatientFormPage from './pages/PatientFormPage'
import CasePage from './pages/CasePage'
import EditorPage from './pages/EditorPage'
import ValidationPage from './pages/ValidationPage'
import EvolutionPage from './pages/EvolutionPage'
import StudyDashboardPage from './pages/StudyDashboardPage'

function AuthGuard({ children }) {
  const { user } = useAuth()
  if (user === undefined) return <div style={{ padding: 40 }}>Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AuthGuard><DashboardPage /></AuthGuard>} />
        <Route path="/patient/new" element={<AuthGuard><PatientFormPage /></AuthGuard>} />
        <Route path="/case/new" element={<AuthGuard><CasePage /></AuthGuard>} />
        <Route path="/case/:caseId" element={<AuthGuard><CasePage /></AuthGuard>} />
        <Route path="/editor/:caseId" element={<AuthGuard><EditorPage /></AuthGuard>} />
        <Route path="/validation/:caseId" element={<AuthGuard><ValidationPage /></AuthGuard>} />
        <Route path="/evolution/:caseId" element={<AuthGuard><EvolutionPage /></AuthGuard>} />
        <Route path="/study" element={<AuthGuard><StudyDashboardPage /></AuthGuard>} />
      </Routes>
    </BrowserRouter>
  )
}
