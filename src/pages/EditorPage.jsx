import { useRef, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ThreeViewer } from '../components/ThreeViewer'
import { ZonePainter } from '../components/ZonePainter'
import { useCase } from '../hooks/useCase'
import { useModelHistory } from '../hooks/useModelHistory'
import { pythonApi } from '../services/pythonApi'
import { storageService } from '../services/storageService'
import { caseService } from '../services/caseService'
import { analyticsService } from '../services/analyticsService'

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
  const [convertingScan, setConvertingScan] = useState(false)
  const [isScanRaw, setIsScanRaw] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const fileInputRef = useRef(null)
  const [sculptActive, setSculptActive] = useState(false)
  const [sculptRadius, setSculptRadius] = useState(8)
  const [sculptStrength, setSculptStrength] = useState(0.5)
  const [sculptMode, setSculptMode] = useState('push')
  const [sculptSymmetry, setSculptSymmetry] = useState('none')

  function toggleSculpt() {
    const next = !sculptActive
    setSculptActive(next)
    viewerRef.current?.setSculptMode({
      active: next, radius: sculptRadius, strength: sculptStrength,
      mode: sculptMode, symmetry: sculptSymmetry,
    })
  }

  function commitSculpt() {
    const stlB64 = viewerRef.current?.exportStlBase64()
    if (stlB64) {
      push(stlB64)
      analyticsService.track('sculpt_stroke', {
        mode: sculptMode,
        radius: sculptRadius,
        strength: sculptStrength,
      })
    }
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
      setIsScanRaw(true)
      analyticsService.track('scan_imported', {
        vertex_count: result.vertex_count,
        file_size_kb: Math.round(file.size / 1024),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  async function suggestZones() {
    if (!caseData) return
    setSuggesting(true)
    setError('')
    try {
      const result = await pythonApi.suggestZones({
        measurements: caseData.measurements || {},
        diagnosis: caseData.patientDiagnosis || '',
      })
      setSuggestion(result)
      viewerRef.current?.setSuggestionZones(result.zones)
      analyticsService.track('zones_suggested', {
        cvai: result.cvai,
        severity: result.severity,
        affected_side: result.affected_side ?? 'unknown',
        zone_count: result.zones.length,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSuggesting(false)
    }
  }

  async function convertScanToHelmet() {
    if (!modelMeta?.stl_b64) return
    setConvertingScan(true)
    setError('')
    try {
      const result = await pythonApi.generateFromScan({
        stl_b64: modelMeta.stl_b64,
        offset_mm: 4,
        wall_mm: thickness,
      })
      viewerRef.current?.loadStlBase64(result.stl_b64)
      push(result.stl_b64)
      setModelMeta(result)
      setIsScanRaw(false)
      analyticsService.track('model_generated', {
        source: 'scan',
        wall_mm: thickness,
        volume_cm3: result.volume_cm3,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setConvertingScan(false)
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
      analyticsService.track('model_generated', {
        source: 'parametric',
        wall_mm: thickness,
        volume_cm3: result.volume_cm3,
      })
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

        {isScanRaw && (
          <button onClick={convertScanToHelmet} disabled={convertingScan}
            style={{ width: '100%', padding: '10px', marginBottom: 8,
              background: '#4299e1', color: 'white', border: 'none', borderRadius: 6,
              cursor: convertingScan ? 'wait' : 'pointer' }}>
            {convertingScan ? 'Construindo capacete...' : '🏗️ Gerar Capacete a partir do Scan'}
          </button>
        )}

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

        <div style={{ marginTop: 16 }}>
          <button onClick={suggestZones} disabled={suggesting}
            style={{ width: '100%', padding: '10px',
              background: '#9f7aea', color: 'white', border: 'none', borderRadius: 6,
              cursor: suggesting ? 'wait' : 'pointer' }}>
            {suggesting ? 'Analisando...' : '🧠 Sugerir Zonas (IA)'}
          </button>
          {suggestion && (
            <ZoneSuggestion
              s={suggestion}
              onApply={() => {
                viewerRef.current?.applySuggestedZones(suggestion.zones)
                viewerRef.current?.setSuggestionZones(null)
                const stl = viewerRef.current?.exportStlBase64()
                if (stl) push(stl)
                analyticsService.track('zones_applied', {
                  zone_count: suggestion.zones.length,
                  severity: suggestion.severity,
                })
                setSuggestion(null)
              }}
              onClose={() => {
                setSuggestion(null)
                viewerRef.current?.setSuggestionZones(null)
              }}
            />
          )}
        </div>

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
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {['push', 'pull', 'smooth'].map(m => (
                    <button key={m}
                      onClick={() => { setSculptMode(m); viewerRef.current?.setSculptMode({ active: true, mode: m }) }}
                      style={{ flex: 1, padding: '6px', fontSize: 12,
                        opacity: sculptMode === m ? 1 : 0.5,
                        textTransform: 'capitalize' }}>
                      {m}
                    </button>
                  ))}
                </div>
                <label style={{ display: 'block', fontSize: 11, opacity: 0.7 }}>Raio: {sculptRadius}mm</label>
                <input type="range" min="3" max="25" step="1" value={sculptRadius}
                  onChange={e => { const r = Number(e.target.value); setSculptRadius(r); viewerRef.current?.setSculptMode({ active: true, radius: r }) }}
                  style={{ width: '100%', marginBottom: 6 }} />
                <label style={{ display: 'block', fontSize: 11, opacity: 0.7 }}>Força: {sculptStrength}</label>
                <input type="range" min="0.1" max="2" step="0.1" value={sculptStrength}
                  onChange={e => { const s = Number(e.target.value); setSculptStrength(s); viewerRef.current?.setSculptMode({ active: true, strength: s }) }}
                  style={{ width: '100%', marginBottom: 6 }} />
                <label style={{ display: 'block', fontSize: 11, opacity: 0.7 }}>Simetria</label>
                <select value={sculptSymmetry}
                  onChange={e => {
                    const v = e.target.value
                    setSculptSymmetry(v)
                    viewerRef.current?.setSculptMode({ active: true, symmetry: v })
                  }}
                  style={{ width: '100%', padding: 4, fontSize: 12 }}>
                  <option value="none">Sem simetria</option>
                  <option value="x">Eixo X (esq/dir)</option>
                  <option value="y">Eixo Y (ant/post)</option>
                  <option value="z">Eixo Z (sup/inf)</option>
                </select>
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

function ZoneSuggestion({ s, onClose, onApply }) {
  const SEV_COLOR = { mild: '#48c78e', moderate: '#ecc94b', severe: '#fc8181', very_severe: '#e53e3e' }
  const TYPE_COLOR = { pressure: '#fc8181', relief: '#63b3ed', neutral: '#a0aec0' }
  return (
    <div style={{
      marginTop: 12, padding: 12, background: 'rgba(159,122,234,0.08)',
      border: '1px solid rgba(159,122,234,0.4)', borderRadius: 8, fontSize: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong style={{ color: '#9f7aea' }}>Análise IA · v1 heurística</strong>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: SEV_COLOR[s.severity], fontWeight: 600 }}>CVAI {s.cvai}%</span>
        {' · '}confiança {Math.round(s.confidence * 100)}%
      </div>
      <p style={{ margin: '0 0 8px', opacity: 0.9 }}>{s.summary}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {s.zones.map((z, i) => (
          <div key={i} style={{
            padding: '6px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            borderLeft: `3px solid ${TYPE_COLOR[z.type]}`,
          }}>
            <div style={{ color: TYPE_COLOR[z.type], fontWeight: 600 }}>{z.label}</div>
            <div style={{ opacity: 0.7, fontSize: 11 }}>
              raio {z.radius_mm}mm · intensidade {Math.round(z.intensity * 100)}%
            </div>
            <div style={{ opacity: 0.6, fontSize: 11, marginTop: 2 }}>{z.rationale}</div>
          </div>
        ))}
      </div>
      <button onClick={onApply}
        style={{
          marginTop: 10, width: '100%', padding: '8px',
          background: '#9f7aea', color: 'white', border: 'none',
          borderRadius: 6, cursor: 'pointer', fontWeight: 600,
        }}>
        ✨ Aplicar Zonas no Capacete
      </button>
    </div>
  )
}
