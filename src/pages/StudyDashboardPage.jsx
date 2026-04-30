import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../hooks/useAuth'

const STATUS_LABEL = {
  draft: 'Rascunho', sent: 'Enviado', in_progress: 'Em andamento',
  review: 'Em revisão', approved: 'Aprovado', exported: 'Exportado',
}

export default function StudyDashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [cases, setCases] = useState([])
  const [evalsByCase, setEvalsByCase] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState({ status: '', minCvai: '', maxCvai: '' })

  useEffect(() => {
    if (!user) return
    if (user.role !== 'study_coordinator') {
      navigate('/')
      return
    }
    setLoading(true)
    ;(async () => {
      try {
        const cs = await getDocs(collection(db, 'cases'))
        const list = cs.docs.map(d => ({ id: d.id, ...d.data() }))
        setCases(list)
        // Busca evaluations de cada caso em paralelo (collectionGroup foi
        // descartado por compatibilidade com Storage rules cross-service)
        const map = {}
        await Promise.all(list.map(async c => {
          try {
            const q = query(collection(db, 'cases', c.id, 'evaluations'), orderBy('date', 'asc'))
            const snap = await getDocs(q)
            map[c.id] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          } catch {
            map[c.id] = []
          }
        }))
        setEvalsByCase(map)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  const enriched = useMemo(() => cases.map(c => {
    const evals = evalsByCase[c.id] || []
    const initialCvai = c.measurements?.cvai ?? null
    const lastCvai = evals.length ? evals[evals.length - 1].measurements?.cvai : initialCvai
    const delta = initialCvai != null && lastCvai != null
      ? Number(lastCvai) - Number(initialCvai) : null
    return { ...c, evals, initialCvai, lastCvai, delta }
  }), [cases, evalsByCase])

  const filtered = useMemo(() => enriched.filter(c => {
    if (filter.status && c.status !== filter.status) return false
    if (filter.minCvai && (c.initialCvai ?? -Infinity) < Number(filter.minCvai)) return false
    if (filter.maxCvai && (c.initialCvai ?? Infinity) > Number(filter.maxCvai)) return false
    return true
  }), [enriched, filter])

  const metrics = useMemo(() => {
    if (!filtered.length) return null
    const valid = filtered.filter(c => c.initialCvai != null)
    const meanInitial = valid.reduce((s, c) => s + Number(c.initialCvai), 0) / (valid.length || 1)
    const withDelta = filtered.filter(c => c.delta != null)
    const meanDelta = withDelta.length
      ? withDelta.reduce((s, c) => s + c.delta, 0) / withDelta.length
      : null
    const completed = filtered.filter(c => ['approved', 'exported'].includes(c.status)).length
    return {
      total: filtered.length,
      meanInitialCvai: meanInitial.toFixed(2),
      meanDeltaCvai: meanDelta != null ? meanDelta.toFixed(2) : '—',
      completed,
      activeStudy: filtered.length - completed,
    }
  }, [filtered])

  function exportCsv() {
    const header = [
      'case_id', 'patient_name', 'birth_date', 'diagnosis', 'status',
      'initial_cvai', 'last_cvai', 'delta_cvai', 'evaluation_count',
      'volume_cm3', 'weight_g', 'created_at',
    ].join(',')
    const lines = filtered.map(c => [
      c.id,
      JSON.stringify(c.patientName ?? ''),
      c.patientBirthDate ?? '',
      JSON.stringify(c.patientDiagnosis ?? ''),
      c.status,
      c.initialCvai ?? '',
      c.lastCvai ?? '',
      c.delta ?? '',
      (c.evals || []).length,
      c.measurements?.volume_cm3 ?? '',
      c.measurements?.weight_g ?? '',
      c.createdAt?.toDate ? c.createdAt.toDate().toISOString() : '',
    ].join(','))
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `estudo-ortesecad-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!user || user.role !== 'study_coordinator') return null

  return (
    <div style={{ maxWidth: 1100, margin: '40px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>OrteseCAD · Estudo</h1>
          <p style={{ color: '#666', margin: '4px 0 0' }}>Visão de cohort para o coordenador do estudo</p>
        </div>
        <div>
          <span style={{ color: '#666' }}>{user.name} — Coordenador</span>
          <button onClick={logout} style={{ marginLeft: 16 }}>Sair</button>
        </div>
      </div>

      {loading && <p>Carregando…</p>}
      {error && <p style={{ color: '#c53030' }}>{error}</p>}

      {!loading && !error && (
        <>
          {metrics && <MetricsRow m={metrics} />}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '24px 0' }}>
            <select value={filter.status}
              onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
              style={{ padding: 8 }}>
              <option value="">Todos status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) =>
                <option key={k} value={k}>{v}</option>
              )}
            </select>
            <input placeholder="CVAI mín."
              value={filter.minCvai}
              onChange={e => setFilter(f => ({ ...f, minCvai: e.target.value }))}
              style={{ padding: 8, width: 100 }} />
            <input placeholder="CVAI máx."
              value={filter.maxCvai}
              onChange={e => setFilter(f => ({ ...f, maxCvai: e.target.value }))}
              style={{ padding: 8, width: 100 }} />
            <div style={{ flex: 1 }} />
            <button onClick={exportCsv}
              style={{ padding: '8px 16px', background: '#48c78e', color: 'white', border: 'none', borderRadius: 6 }}>
              ⬇ Exportar CSV
            </button>
          </div>

          <CasesTable rows={filtered} />
        </>
      )}
    </div>
  )
}

function MetricsRow({ m }) {
  const cards = [
    { label: 'Casos no recorte', value: m.total },
    { label: 'CVAI inicial médio', value: `${m.meanInitialCvai}%` },
    { label: 'Δ CVAI médio', value: `${m.meanDeltaCvai}%`,
      tone: m.meanDeltaCvai !== '—' && Number(m.meanDeltaCvai) <= 0 ? 'good' : 'warn' },
    { label: 'Concluídos', value: `${m.completed}/${m.total}` },
    { label: 'Ativos', value: m.activeStudy },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
      {cards.map(c => (
        <div key={c.label} style={{
          background: '#f8fafc', borderRadius: 8, padding: 12,
          borderTop: `3px solid ${c.tone === 'good' ? '#48c78e' : c.tone === 'warn' ? '#ffa032' : '#9f7aea'}`,
        }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{c.value}</div>
          <div style={{ color: '#666', fontSize: 12 }}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

function CasesTable({ rows }) {
  if (!rows.length) return <p style={{ color: '#666' }}>Nenhum caso no recorte.</p>
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead style={{ background: '#edf2f7' }}>
          <tr>
            <Th>Paciente</Th><Th>Diagnóstico</Th><Th>Status</Th>
            <Th>CVAI inicial</Th><Th>CVAI último</Th><Th>Δ</Th><Th>Avaliações</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <Td><strong>{c.patientName ?? '—'}</strong></Td>
              <Td style={{ color: '#666', fontSize: 13 }}>{c.patientDiagnosis ?? '—'}</Td>
              <Td>{STATUS_LABEL[c.status] ?? c.status}</Td>
              <Td>{c.initialCvai != null ? `${c.initialCvai}%` : '—'}</Td>
              <Td>{c.lastCvai != null ? `${c.lastCvai}%` : '—'}</Td>
              <Td style={{ color: c.delta != null && c.delta <= 0 ? '#2f855a' : '#c53030' }}>
                {c.delta != null ? `${c.delta > 0 ? '+' : ''}${c.delta.toFixed(2)}` : '—'}
              </Td>
              <Td>{(c.evals || []).length}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }) {
  return <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>{children}</th>
}
function Td({ children, style }) {
  return <td style={{ padding: '8px 12px', ...style }}>{children}</td>
}
