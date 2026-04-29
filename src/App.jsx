import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

function AuthGuard({ children }) {
  const { user } = useAuth()
  if (user === undefined) return <div>Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <AuthGuard><DashboardPage /></AuthGuard>
        } />
      </Routes>
    </BrowserRouter>
  )
}
