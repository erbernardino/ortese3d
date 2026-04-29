import { useAuth } from '../hooks/useAuth'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
      <h1>OrteseCAD</h1>
      <p>Olá, {user?.name} ({user?.role === 'doctor' ? 'Médico' : 'Ortesista'})</p>
      <button onClick={logout}>Sair</button>
    </div>
  )
}
