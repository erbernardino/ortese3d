import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { caseService } from '../services/caseService'
import { patientService } from '../services/patientService'

const STATUS_LABEL = {
  draft: 'Rascunho', sent: 'Enviado', in_progress: 'Em andamento',
  review: 'Em revisão', approved: 'Aprovado', exported: 'Exportado',
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [patients, setPatients] = useState({})

  useEffect(() => {
    if (!user) return
    caseService.listForUser(user.uid, user.role).then(async (list) => {
      setCases(list)
      const ids = [...new Set(list.map(c => c.patientId))]
      const pats = await Promise.all(ids.map(id => patientService.get(id)))
      const map = {}
      pats.forEach(p => { if (p) map[p.id] = p })
      setPatients(map)
    })
  }, [user])

  const active = cases.filter(c => !['approved', 'exported'].includes(c.status))
  const done = cases.filter(c => ['approved', 'exported'].includes(c.status))
  const pending = cases.filter(c => c.status === 'review')

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>OrteseCAD</h1>
        <div>
          <span>{user?.name} — {user?.role === 'doctor' ? 'Médico' : 'Ortesista'}</span>
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
            <strong>{patients[c.patientId]?.name ?? '...'}</strong>
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
