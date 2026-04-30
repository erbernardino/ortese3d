import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { caseService } from '../services/caseService'
import { notificationService } from '../services/notificationService'
import { cacheService } from '../services/cacheService'

const STATUS_LABEL = {
  draft: 'Rascunho', sent: 'Enviado', in_progress: 'Em andamento',
  review: 'Em revisão', approved: 'Aprovado', exported: 'Exportado',
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [notifications, setNotifications] = useState([])
  const [online, setOnline] = useState(cacheService.isOnline())
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!user) return
    if (user.role === 'study_coordinator') {
      navigate('/study', { replace: true })
      return
    }
    return notificationService.subscribe(user.uid, setNotifications)
  }, [user])

  useEffect(() => {
    function updateStatus() { setOnline(cacheService.isOnline()) }
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    async function refreshPending() {
      const ops = await cacheService.pendingOps()
      setPendingCount(ops.length)
    }
    refreshPending()
    const unsub = cacheService.subscribe(refreshPending)
    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
      unsub()
    }
  }, [])

  useEffect(() => {
    if (!user) return
    caseService.listForUser(user.uid, user.role).then(setCases)
  }, [user])

  const active = cases.filter(c => !['approved', 'exported'].includes(c.status))
  const done = cases.filter(c => ['approved', 'exported'].includes(c.status))
  const pending = cases.filter(c => c.status === 'review')

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
      {(!online || pendingCount > 0) && (
        <div style={{
          padding: '8px 12px', marginBottom: 16, borderRadius: 6, fontSize: 13,
          background: online ? '#fefcbf' : '#fed7d7',
          color: online ? '#744210' : '#742a2a',
          border: `1px solid ${online ? '#f6e05e' : '#fc8181'}`,
        }}>
          {!online && '⚠️ Sem conexão — alterações serão sincronizadas quando voltar a internet. '}
          {pendingCount > 0 && `${pendingCount} operação(ões) na fila de sincronização.`}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>OrteseCAD</h1>
        <div>
          <span>{user?.name} — {user?.role === 'doctor' ? 'Médico' : 'Ortesista'}</span>
          {notifications.length > 0 && (
            <span style={{
              background: '#fc8181', color: 'white', borderRadius: '50%',
              padding: '2px 7px', fontSize: 12, marginLeft: 8, fontWeight: 700,
            }}>
              {notifications.length}
            </span>
          )}
          <button onClick={logout} style={{ marginLeft: 16 }}>Sair</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 32 }}>
        <StatCard label="Casos ativos" value={active.length} color="#63b3ed" />
        <StatCard label="Prontos" value={done.length} color="#48c78e" />
        <StatCard label="Aguardando revisão" value={pending.length} color="#ffa032" />
      </div>

      {user?.role === 'doctor' && (
        <button onClick={() => navigate('/patient/new')} style={{ marginBottom: 24 }}>
          + Novo Paciente
        </button>
      )}

      <h2>Casos Recentes</h2>
      {cases.length === 0 && <p style={{ color: '#666' }}>Nenhum caso encontrado.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {cases.map(c => (
          <li key={c.id}
            onClick={() => navigate(`/case/${c.id}`)}
            style={{
              cursor: 'pointer', padding: '12px 16px',
              border: '1px solid #e2e8f0', borderRadius: 8,
              marginBottom: 8, display: 'flex', justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <strong>{c.patientName ?? '...'}</strong>
            <span style={{ fontSize: 13, color: '#666' }}>{STATUS_LABEL[c.status]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: '#f8fafc', borderRadius: 8, padding: 16,
      textAlign: 'center', borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 32, fontWeight: 700 }}>{value}</div>
      <div style={{ color: '#666', fontSize: 14 }}>{label}</div>
    </div>
  )
}
