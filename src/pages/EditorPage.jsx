import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ThreeViewer } from '../components/ThreeViewer'
import { ZonePainter } from '../components/ZonePainter'
import { useCase } from '../hooks/useCase'
import { useModelHistory } from '../hooks/useModelHistory'
import { pythonApi } from '../services/pythonApi'

export default function EditorPage() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const { caseData } = useCase(caseId)
  const viewerRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [modelMeta, setModelMeta] = useState(null)
  const [error, setError] = useState('')
  const [activeZone, setActiveZone] = useState('neutral')
  const [thickness, setThickness] = useState(3)
  const { current: currentStl, push, undo, redo, canUndo, canRedo } = useModelHistory(null)

  async function generateModel() {
    if (!caseData) return
    setGenerating(true)
    setError('')
    try {
      const m = caseData.measurements || {}
      const result = await pythonApi.generateModel({
        circ_occipital: Number(m.circOccipital) || 380,
        circ_frontal: Number(m.circFrontal) || 370,
        diag_a: Number(m.diagA) || 135,
        diag_b: Number(m.diagB) || 118,
        cvai: Number(m.cvai) || 8.4,
        height: Number(m.height) || 72,
        offset_mm: 4,
        wall_mm: thickness,
      })
      viewerRef.current?.loadStlBase64(result.stl_b64)
      push(result.stl_b64)
      setModelMeta(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  function handleUndo() {
    undo()
  }

  function handleRedo() {
    redo()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', height: '100vh' }}>
      <ThreeViewer ref={viewerRef} />

      <div style={{ padding: 16, borderLeft: '1px solid #333', overflowY: 'auto', background: '#0f0f1a', color: '#e2e8f0' }}>
        <button onClick={() => navigate(`/case/${caseId}`)}
          style={{ marginBottom: 16, background: 'none', border: 'none', color: '#63b3ed', cursor: 'pointer' }}>
          ← Voltar ao caso
        </button>

        <h3 style={{ margin: '0 0 16px' }}>Editor 3D</h3>

        <button onClick={generateModel} disabled={generating}
          style={{ width: '100%', padding: '10px', marginBottom: 8, cursor: generating ? 'wait' : 'pointer' }}>
          {generating ? 'Gerando...' : '🔄 Gerar Modelo'}
        </button>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button onClick={handleUndo} disabled={!canUndo}
            style={{ flex: 1, padding: '6px', fontSize: 13, opacity: canUndo ? 1 : 0.4 }}>
            ↩ Desfazer
          </button>
          <button onClick={handleRedo} disabled={!canRedo}
            style={{ flex: 1, padding: '6px', fontSize: 13, opacity: canRedo ? 1 : 0.4 }}>
            ↪ Refazer
          </button>
        </div>

        {error && <p style={{ color: '#fc8181', fontSize: 13 }}>{error}</p>}

        {modelMeta && (
          <div style={{ fontSize: 13, lineHeight: 1.8, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div>Vértices: {modelMeta.vertex_count?.toLocaleString()}</div>
            <div>Faces: {modelMeta.face_count?.toLocaleString()}</div>
            <div>Volume: {modelMeta.volume_cm3} cm³</div>
            <div>Manifold: {modelMeta.is_watertight ? '✅' : '❌'}</div>
          </div>
        )}

        <ZonePainter
          activeZone={activeZone}
          onZoneChange={zone => { setActiveZone(zone); viewerRef.current?.paintZone(zone) }}
          thickness={thickness}
          onThicknessChange={setThickness}
        />

        {currentStl && (
          <div style={{ marginTop: 16 }}>
            <button onClick={() => navigate(`/validation/${caseId}`)}
              style={{ width: '100%', padding: '10px', background: '#48c78e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              Validar e Exportar →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
