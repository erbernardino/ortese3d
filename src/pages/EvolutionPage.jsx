import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCase } from '../hooks/useCase'
import { evaluationService } from '../services/evaluationService'

export default function EvolutionPage() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { caseData } = useCase(caseId)
  const [evals, setEvals] = useState([])
  const [showForm, setShowForm] = useState(false)

  async function refresh() {
    setEvals(await evaluationService.list(caseId))
  }

  useEffect(() => {
    if (caseId) refresh()
  }, [caseId])

  // Inclui as medidas iniciais do caso como evaluation #0 ("Inicial")
  const baseline = caseData?.measurements && caseData.createdAt
    ? {
        id: '_baseline',
        date: caseData.createdAt?.toDate
          ? caseData.createdAt.toDate().toISOString().slice(0, 10)
          : null,
        measurements: caseData.measurements,
        notes: 'Avaliação inicial (cadastro do caso).',
        _baseline: true,
      }
    : null

  const series = baseline ? [baseline, ...evals] : evals

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
      <button onClick={() => navigate(`/case/${caseId}`)}
        style={{ marginBottom: 16, background: 'none', border: 'none', color: '#63b3ed', cursor: 'pointer' }}>
        ← Voltar ao caso
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Evolução · {caseData?.patientName}</h2>
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '8px 16px', background: '#48c78e', color: 'white', border: 'none', borderRadius: 6 }}>
          {showForm ? 'Cancelar' : '+ Nova Avaliação'}
        </button>
      </div>

      {showForm && (
        <NewEvaluationForm
          caseId={caseId}
          uid={user?.uid}
          onSaved={() => { setShowForm(false); refresh() }}
        />
      )}

      {series.length === 0 && (
        <p style={{ color: '#666' }}>Nenhuma avaliação registrada ainda.</p>
      )}

      {series.length > 0 && (
        <>
          <CvaiChart series={series} />
          <EvolutionTable series={series} />
        </>
      )}
    </div>
  )
}

function NewEvaluationForm({ caseId, uid, onSaved }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: today,
    circOccipital: '', circFrontal: '',
    diagA: '', diagB: '', cvai: '', height: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Auto-calcula CVAI se diagA e diagB estão preenchidos
  const computedCvai = form.diagA && form.diagB && Number(form.diagB) > 0
    ? (((Number(form.diagA) - Number(form.diagB)) / Number(form.diagB)) * 100).toFixed(2)
    : null

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const cvai = form.cvai || computedCvai
      await evaluationService.create(caseId, { ...form, cvai }, uid)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} style={{
      background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 24,
      border: '1px solid #e2e8f0',
    }}>
      <h3 style={{ marginTop: 0 }}>Nova Avaliação</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Data"><input type="date" value={form.date} onChange={e => set('date', e.target.value)} required /></Field>
        <Field label="Circ. Occipital (mm)"><input type="number" step="0.1" value={form.circOccipital} onChange={e => set('circOccipital', e.target.value)} /></Field>
        <Field label="Circ. Frontal (mm)"><input type="number" step="0.1" value={form.circFrontal} onChange={e => set('circFrontal', e.target.value)} /></Field>
        <Field label="Diagonal A (mm)"><input type="number" step="0.1" value={form.diagA} onChange={e => set('diagA', e.target.value)} /></Field>
        <Field label="Diagonal B (mm)"><input type="number" step="0.1" value={form.diagB} onChange={e => set('diagB', e.target.value)} /></Field>
        <Field label={`CVAI (%)${computedCvai ? ` · auto: ${computedCvai}` : ''}`}>
          <input type="number" step="0.01" value={form.cvai}
            placeholder={computedCvai ?? ''}
            onChange={e => set('cvai', e.target.value)} />
        </Field>
        <Field label="Altura (mm)"><input type="number" step="0.1" value={form.height} onChange={e => set('height', e.target.value)} /></Field>
      </div>
      <div style={{ marginTop: 12 }}>
        <Field label="Observações">
          <textarea rows="2" value={form.notes} onChange={e => set('notes', e.target.value)}
            style={{ width: '100%', padding: 8 }} />
        </Field>
      </div>
      {error && <p style={{ color: '#e53e3e' }}>{error}</p>}
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <button type="submit" disabled={saving}
          style={{ padding: '8px 20px', background: '#48c78e', color: 'white', border: 'none', borderRadius: 6 }}>
          {saving ? 'Salvando...' : 'Salvar Avaliação'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: '#666' }}>{label}</span>
      {children}
    </label>
  )
}

function EvolutionTable({ series }) {
  const baseline = series[0]
  const baselineCvai = baseline?.measurements?.cvai
  return (
    <div style={{ overflowX: 'auto', marginTop: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#edf2f7' }}>
          <tr>
            <Th>Data</Th><Th>Diag A</Th><Th>Diag B</Th><Th>CVAI</Th>
            <Th>Δ CVAI</Th><Th>Observações</Th>
          </tr>
        </thead>
        <tbody>
          {series.map(e => {
            const delta = baselineCvai != null && e.measurements?.cvai != null
              ? (e.measurements.cvai - baselineCvai).toFixed(2)
              : null
            const positive = delta != null && Number(delta) <= 0
            return (
              <tr key={e.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <Td><strong>{e.date}</strong>{e._baseline && ' (inicial)'}</Td>
                <Td>{e.measurements?.diagA ?? '—'}</Td>
                <Td>{e.measurements?.diagB ?? '—'}</Td>
                <Td>{e.measurements?.cvai != null ? `${e.measurements.cvai}%` : '—'}</Td>
                <Td>
                  {delta != null && (
                    <span style={{ color: positive ? '#2f855a' : '#c53030' }}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  )}
                </Td>
                <Td style={{ fontSize: 12, color: '#666' }}>{e.notes ?? ''}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }) {
  return <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>{children}</th>
}
function Td({ children, style }) {
  return <td style={{ padding: '8px 12px', fontSize: 14, ...style }}>{children}</td>
}

function CvaiChart({ series }) {
  const points = series
    .filter(e => e.measurements?.cvai != null && e.date)
    .map(e => ({ date: e.date, cvai: Number(e.measurements.cvai) }))

  if (points.length < 2) {
    return (
      <div style={{ padding: 16, color: '#666', fontSize: 13 }}>
        Ao menos 2 avaliações com CVAI são necessárias para gerar o gráfico.
      </div>
    )
  }

  const W = 700, H = 250, M = { top: 20, right: 20, bottom: 40, left: 40 }
  const xs = points.map(p => new Date(p.date).getTime())
  const ys = points.map(p => p.cvai)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = 0, yMax = Math.max(8.75, Math.max(...ys) * 1.1)
  const xScale = t => M.left + ((t - xMin) / (xMax - xMin || 1)) * (W - M.left - M.right)
  const yScale = v => H - M.bottom - ((v - yMin) / (yMax - yMin)) * (H - M.top - M.bottom)

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(new Date(p.date).getTime())} ${yScale(p.cvai)}`)
    .join(' ')

  // Bandas de severidade
  const SEV = [
    { from: 0, to: 3.5, color: '#c6f6d5', label: 'leve' },
    { from: 3.5, to: 6.5, color: '#fefcbf', label: 'moderada' },
    { from: 6.5, to: 8.75, color: '#fed7d7', label: 'grave' },
    { from: 8.75, to: yMax, color: '#fed7d7', label: 'muito grave' },
  ]

  return (
    <div style={{ marginTop: 24, background: 'white', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
      <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 14 }}>Evolução do CVAI</h3>
      <svg width={W} height={H} style={{ maxWidth: '100%' }}>
        {SEV.map(b => b.from < yMax && (
          <rect key={b.label}
            x={M.left} y={yScale(Math.min(b.to, yMax))}
            width={W - M.left - M.right}
            height={yScale(b.from) - yScale(Math.min(b.to, yMax))}
            fill={b.color} opacity="0.4" />
        ))}
        <path d={path} stroke="#3182ce" strokeWidth="2" fill="none" />
        {points.map(p => (
          <g key={p.date}>
            <circle cx={xScale(new Date(p.date).getTime())} cy={yScale(p.cvai)} r="4" fill="#3182ce" />
            <text x={xScale(new Date(p.date).getTime())} y={yScale(p.cvai) - 8}
              fontSize="11" fill="#2d3748" textAnchor="middle">{p.cvai}%</text>
          </g>
        ))}
        <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="#cbd5e0" />
        <line x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom} stroke="#cbd5e0" />
        {points.map(p => (
          <text key={p.date}
            x={xScale(new Date(p.date).getTime())}
            y={H - M.bottom + 14}
            fontSize="10" fill="#666" textAnchor="middle">{p.date.slice(5)}</text>
        ))}
      </svg>
    </div>
  )
}
