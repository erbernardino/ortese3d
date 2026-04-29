import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCase } from '../hooks/useCase'
import { ValidationChecklist } from '../components/ValidationChecklist'

const PYTHON_BASE = 'http://localhost:8765'

export default function ValidationPage() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const { caseData } = useCase(caseId)
  const [validating, setValidating] = useState(false)
  const [exporting, setExporting] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const stlB64 = caseData?.modelStlB64 || localStorage.getItem(`stl_${caseId}`)

  async function validate() {
    if (!stlB64) {
      setError('Gere o modelo no editor antes de validar.')
      return
    }
    setValidating(true)
    setError('')
    try {
      const res = await fetch(`${PYTHON_BASE}/model/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stl_b64: stlB64 }),
      })
      setResult(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setValidating(false)
    }
  }

  async function downloadBinary(endpoint, filename, body) {
    setExporting(filename)
    try {
      const res = await fetch(`${PYTHON_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.message)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24 }}>
      <button onClick={() => navigate(`/editor/${caseId}`)}
        style={{ marginBottom: 16, background: 'none', border: 'none', color: '#63b3ed', cursor: 'pointer' }}>
        ← Voltar ao editor
      </button>

      <h2>Validação e Exportação</h2>

      <button onClick={validate} disabled={validating}
        style={{ padding: '10px 20px', marginBottom: 24, cursor: validating ? 'wait' : 'pointer' }}>
        {validating ? 'Validando...' : '🔍 Executar Validação'}
      </button>

      {error && <p style={{ color: '#fc8181', marginBottom: 16 }}>{error}</p>}

      <ValidationChecklist result={result} />

      {result?.is_valid && (
        <div style={{ marginTop: 32 }}>
          <h3>Exportar</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <ExportButton
              label="📦 STL (Impressão 3D)"
              disabled={exporting === 'ortese.stl'}
              loading={exporting === 'ortese.stl'}
              onClick={() => downloadBinary('/export/stl', 'ortese.stl', { stl_b64: stlB64 })}
            />
            <ExportButton
              label="⚙️ G-code (CNC)"
              disabled={exporting === 'ortese.gcode'}
              loading={exporting === 'ortese.gcode'}
              onClick={() => downloadBinary('/export/gcode', 'ortese.gcode', { stl_b64: stlB64 })}
            />
            <ExportButton
              label="📄 PDF Clínico"
              disabled={exporting === 'ortese_clinical.pdf'}
              loading={exporting === 'ortese_clinical.pdf'}
              onClick={() => downloadBinary('/export/pdf', 'ortese_clinical.pdf', {
                type: 'clinical',
                patient: caseData?.patient || {},
                measurements: caseData?.measurements || {},
                model_meta: { volume_cm3: result.volume_cm3, weight_g: result.weight_g },
              })}
            />
            <ExportButton
              label="📋 PDF Técnico"
              disabled={exporting === 'ortese_technical.pdf'}
              loading={exporting === 'ortese_technical.pdf'}
              onClick={() => downloadBinary('/export/pdf', 'ortese_technical.pdf', {
                type: 'technical',
                patient: caseData?.patient || {},
                measurements: caseData?.measurements || {},
                model_meta: { volume_cm3: result.volume_cm3, weight_g: result.weight_g },
              })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ExportButton({ label, disabled, loading, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: '10px 16px', cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.7 : 1 }}>
      {loading ? 'Exportando...' : label}
    </button>
  )
}
