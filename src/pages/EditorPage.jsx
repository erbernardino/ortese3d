import { useRef, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ThreeViewer } from '../components/ThreeViewer'
import { ZonePainter } from '../components/ZonePainter'
import { useCase } from '../hooks/useCase'
import { useModelHistory } from '../hooks/useModelHistory'
import { pythonApi } from '../services/pythonApi'
import { storageService } from '../services/storageService'
import { caseService } from '../services/caseService'

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
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)
  const [sculptActive, setSculptActive] = useState(false)
  const [sculptRadius, setSculptRadius] = useState(8)
  const [sculptStrength, setSculptStrength] = useState(0.5)
  const [sculptMode, setSculptMode] = useState('push')

  function toggleSculpt() {
    const next = !sculptActive
    setSculptActive(next)
    viewerRef.current?.setSculptMode({ active: next, radius: sculptRadius, strength: sculptStrength, mode: sculptMode })
  }

  function commitSculpt() {
    const stlB64 = viewerRef.current?.exportStlBase64()
    if (stlB64) push(stlB64)
  }

  async function importScan(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    setError('')
    try {
      const result = await pythonApi.importScan(file)
      viewerRef.current?.loadStlBase64(result.stl_b64)
      push(result.stl_b64)
      setModelMeta({
        stl_b64: result.stl_b64,
        vertex_count: result.vertex_count,
        face_count: result.face_count,
        is_watertight: true,
        volume_cm3: 0,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

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

  const [historyTick, setHistoryTick] = useState(0)

  function handleUndo() {
    undo()
    setHistoryTick(t => t + 1)
  }

  function handleRedo() {
    redo()
    setHistoryTick(t => t + 1)
  }

  useEffect(() => {
    if (historyTick === 0) return
    if (currentStl) viewerRef.current?.loadStlBase64(currentStl)
  }, [historyTick])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', height: '100vh' }}>
      <ThreeViewer ref={viewerRef} onSculptCommit={commitSculpt} />

      <div style={{ padding: 16, borderLeft: '1px solid #333', overflowY: 'auto', background: '#0f0f1a', color: '#e2e8f0' }}>
        <button onClick={() => navigate(`/case/${caseId}`)}
          style={{ marginBottom: 16, background: 'none', border: 'none', color: '#63b3ed', cursor: 'pointer' }}>
          ← Voltar ao caso
        </button>

        <h3 style={{ margin: '0 0 16px' }}>Editor 3D</h3>

        <button onClick={generateModel} disabled={generating || importing}
          style={{ width: '100%', padding: '10px', marginBottom: 8, cursor: generating ? 'wait' : 'pointer' }}>
          {generating ? 'Gerando...' : '🔄 Gerar Modelo'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".stl,.obj,.ply"
          onChange={importScan}
          style={{ display: 'none' }}
        />
        <button onClick={() => fileInputRef.current?.click()} disabled={generating || importing}
          style={{ width: '100%', padding: '10px', marginBottom: 8, cursor: importing ? 'wait' : 'pointer' }}>
          {importing ? 'Processando scan...' : '📁 Importar Scan 3D'}
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
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', opacity: 0.6 }}>Sculpt</h4>
            <button onClick={toggleSculpt}
              style={{
                width: '100%', padding: '8px', marginBottom: 8,
                background: sculptActive ? '#fc8181' : '#48c78e',
                color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer',
              }}>
              {sculptActive ? '⏸ Sair do Sculpt' : '✋ Ativar Sculpt'}
            </button>
            {sculptActive && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button onClick={() => { setSculptMode('push'); viewerRef.current?.setSculptMode({ active: true, mode: 'push' }) }}
                    style={{ flex: 1, padding: '6px', fontSize: 12, opacity: sculptMode === 'push' ? 1 : 0.5 }}>
                    Push
                  </button>
                  <button onClick={() => { setSculptMode('pull'); viewerRef.current?.setSculptMode({ active: true, mode: 'pull' }) }}
                    style={{ flex: 1, padding: '6px', fontSize: 12, opacity: sculptMode === 'pull' ? 1 : 0.5 }}>
                    Pull
                  </button>
                </div>
                <label style={{ display: 'block', fontSize: 11, opacity: 0.7 }}>Raio: {sculptRadius}mm</label>
                <input type="range" min="3" max="25" step="1" value={sculptRadius}
                  onChange={e => { const r = Number(e.target.value); setSculptRadius(r); viewerRef.current?.setSculptMode({ active: true, radius: r }) }}
                  style={{ width: '100%', marginBottom: 6 }} />
                <label style={{ display: 'block', fontSize: 11, opacity: 0.7 }}>Força: {sculptStrength}</label>
                <input type="range" min="0.1" max="2" step="0.1" value={sculptStrength}
                  onChange={e => { const s = Number(e.target.value); setSculptStrength(s); viewerRef.current?.setSculptMode({ active: true, strength: s }) }}
                  style={{ width: '100%' }} />
              </>
            )}
          </div>
        )}

        {currentStl && (
          <div style={{ marginTop: 16 }}>
            <button onClick={async () => {
              setUploading(true)
              try {
                const path = await storageService.uploadStl(caseId, currentStl)
                await caseService.update(caseId, { modelStoragePath: path })
                navigate(`/validation/${caseId}`)
              } catch (e) {
                setError(`Falha ao salvar modelo: ${e.message}`)
              } finally {
                setUploading(false)
              }
            }}
              disabled={uploading}
              style={{ width: '100%', padding: '10px', background: '#48c78e', color: 'white', border: 'none', borderRadius: 6, cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? 'Salvando modelo...' : 'Validar e Exportar →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
