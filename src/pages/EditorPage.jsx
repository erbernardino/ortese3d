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
  const [annotateActive, setAnnotateActive] = useState(false)
  const [scanStl, setScanStl] = useState(null)
  const [showScanOverlay, setShowScanOverlay] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [hoverInfo, setHoverInfo] = useState(null)
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

  // sincroniza anotações do caso com o viewer
  useEffect(() => {
    viewerRef.current?.setAnnotations(caseData?.annotations ?? [])
  }, [caseData?.annotations, currentStl])

  function toggleAnnotate() {
    const next = !annotateActive
    setAnnotateActive(next)
    viewerRef.current?.setAnnotateMode(next)
  }

  function toggleScanOverlay() {
    const next = !showScanOverlay
    setShowScanOverlay(next)
    viewerRef.current?.setOverlayStl(next ? scanStl : null)
  }

  async function saveVariant() {
    if (!currentStl) return
    const name = window.prompt('Nome da variante (ex: A, B, "ajuste fino"):')
    if (!name) return
    try {
      const path = await storageService.uploadVariantStl(caseId, name, currentStl)
      const next = [...(caseData?.variants ?? []), {
        name,
        storagePath: path,
        createdAt: new Date().toISOString(),
        volumeCm3: modelMeta?.volume_cm3 ?? null,
        weightG: modelMeta?.weight_g ?? null,
      }]
      await caseService.update(caseId, { variants: next })
    } catch (e) {
      setError(`Falha ao salvar variante: ${e.message}`)
    }
  }

  async function loadVariant(v) {
    try {
      const stl = await storageService.downloadStlAsBase64(v.storagePath)
      viewerRef.current?.loadStlBase64(stl)
      push(stl)
      setModelMeta({
        stl_b64: stl,
        volume_cm3: v.volumeCm3,
        weight_g: v.weightG,
        is_watertight: true,
      })
    } catch (e) {
      setError(`Falha ao carregar variante: ${e.message}`)
    }
  }

  function toggleGrid() {
    const next = !showGrid
    setShowGrid(next)
    viewerRef.current?.setGridVisible(next)
  }

  async function handleAnnotationCreate(position) {
    const text = window.prompt('Anotação clínica:')
    if (!text) return
    const next = [...(caseData?.annotations ?? []), {
      position, text, createdAt: new Date().toISOString(),
    }]
    await caseService.update(caseId, { annotations: next })
    viewerRef.current?.setAnnotations(next)
  }

  async function handleDeleteAnnotation(index) {
    const list = caseData?.annotations ?? []
    const next = list.filter((_, i) => i !== index)
    await caseService.update(caseId, { annotations: next })
    viewerRef.current?.setAnnotations(next)
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
      setScanStl(result.stl_b64)        // memoriza para overlay futuro
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
      const side = detectAffectedSide(caseData?.patientDiagnosis)
      viewerRef.current?.setAsymmetryHint(side)
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
      const side = detectAffectedSide(caseData?.patientDiagnosis)
      viewerRef.current?.setAsymmetryHint(side)
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
      <div style={{ position: 'relative' }}>
        <ThreeViewer
          ref={viewerRef}
          onSculptCommit={commitSculpt}
          onAnnotationCreate={handleAnnotationCreate}
          onHover={setHoverInfo}
        />
        <ViewControls onView={p => viewerRef.current?.setView(p)} />
        {annotateActive && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(252,191,36,0.95)', color: '#1a202c',
            padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
          }}>📝 Modo anotação — clique no modelo</div>
        )}
        {hoverInfo && (
          <div style={{
            position: 'fixed', left: hoverInfo.clientX + 16, top: hoverInfo.clientY + 16,
            background: 'rgba(15,15,26,0.92)', color: '#cbd5e0',
            padding: '6px 10px', borderRadius: 4, fontSize: 11,
            fontFamily: 'ui-monospace, monospace', pointerEvents: 'none',
            border: '1px solid rgba(255,255,255,0.1)', zIndex: 1000,
          }}>
            <div>X: {hoverInfo.x.toFixed(1)} mm</div>
            <div>Y: {hoverInfo.y.toFixed(1)} mm</div>
            <div>Z: {hoverInfo.z.toFixed(1)} mm</div>
            <div style={{ color: '#fbbf24', marginTop: 2 }}>
              dist origem: {hoverInfo.distance.toFixed(1)} mm
            </div>
          </div>
        )}
      </div>

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
          <button onClick={toggleGrid} disabled={!currentStl}
            style={{ marginTop: 8, width: '100%', padding: '8px',
              background: showGrid ? '#3182ce' : 'rgba(255,255,255,0.06)',
              color: showGrid ? 'white' : '#cbd5e0',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
              cursor: currentStl ? 'pointer' : 'not-allowed', fontSize: 12 }}>
            {showGrid ? '📐 Ocultar régua (10mm)' : '📐 Mostrar régua (10mm)'}
          </button>

          {scanStl && (
            <button onClick={toggleScanOverlay} disabled={!currentStl}
              style={{ marginTop: 8, width: '100%', padding: '8px',
                background: showScanOverlay ? '#fbbf24' : 'rgba(255,255,255,0.06)',
                color: showScanOverlay ? '#1a202c' : '#cbd5e0',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                cursor: currentStl ? 'pointer' : 'not-allowed', fontSize: 12 }}>
              {showScanOverlay ? '👁 Ocultar scan original' : '👁 Mostrar scan original'}
            </button>
          )}

          <button onClick={toggleAnnotate} disabled={!currentStl}
            style={{ marginTop: 8, width: '100%', padding: '8px',
              background: annotateActive ? '#fbbf24' : 'rgba(255,255,255,0.06)',
              color: annotateActive ? '#1a202c' : '#cbd5e0',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
              cursor: currentStl ? 'pointer' : 'not-allowed', fontSize: 12 }}>
            {annotateActive ? '📝 Modo anotação ativo (sair)' : '📝 Adicionar anotação'}
          </button>

          <AnnotationsList
            list={caseData?.annotations ?? []}
            onDelete={handleDeleteAnnotation}
          />

          <button onClick={saveVariant} disabled={!currentStl}
            style={{ marginTop: 8, width: '100%', padding: '8px',
              background: 'rgba(255,255,255,0.06)', color: '#cbd5e0',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
              cursor: currentStl ? 'pointer' : 'not-allowed', fontSize: 12 }}>
            💾 Salvar como variante
          </button>

          <VariantsList list={caseData?.variants ?? []} onLoad={loadVariant} />

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
                  {['push', 'pull', 'smooth', 'grab'].map(m => (
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

function VariantsList({ list, onLoad }) {
  if (!list.length) return null
  return (
    <div style={{ marginTop: 10, padding: 10,
      background: 'rgba(99,179,237,0.08)', borderRadius: 6,
      border: '1px solid rgba(99,179,237,0.25)' }}>
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6,
        textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Variantes ({list.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {list.map((v, i) => (
          <button key={i} onClick={() => onLoad(v)}
            style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '6px 8px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,179,237,0.2)',
              borderRadius: 4, color: '#cbd5e0', cursor: 'pointer',
              fontSize: 12, textAlign: 'left' }}>
            <span style={{ color: '#63b3ed', fontWeight: 600 }}>{v.name}</span>
            <span style={{ fontSize: 10, opacity: 0.6 }}>
              {v.volumeCm3 != null ? `${v.volumeCm3} cm³` : '—'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function AnnotationsList({ list, onDelete }) {
  if (!list.length) return null
  return (
    <div style={{ marginTop: 10, padding: 10,
      background: 'rgba(251,191,36,0.08)', borderRadius: 6,
      border: '1px solid rgba(251,191,36,0.25)' }}>
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6,
        textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Anotações ({list.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {list.map((a, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 8px', background: 'rgba(255,255,255,0.04)',
            borderRadius: 4, fontSize: 12,
          }}>
            <span style={{ flex: 1, color: '#fbbf24', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.text}
            </span>
            <button onClick={() => onDelete(i)}
              style={{ background: 'none', border: 'none', color: '#888',
                cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
              title="Remover anotação">✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function detectAffectedSide(diagnosis) {
  if (!diagnosis) return null
  const d = diagnosis.toLowerCase()
  if (/\b(direit|right)/.test(d)) return 'right'
  if (/\b(esquer|left)/.test(d)) return 'left'
  return null
}

function ViewControls({ onView }) {
  const VIEWS = [
    ['front', 'Frente'],
    ['back', 'Trás'],
    ['left', 'Esq.'],
    ['right', 'Dir.'],
    ['top', 'Topo'],
    ['bottom', 'Base'],
    ['iso', 'Iso'],
  ]
  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, display: 'flex', gap: 4,
      background: 'rgba(15,15,26,0.85)', padding: 6, borderRadius: 6,
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {VIEWS.map(([id, label]) => (
        <button key={id} onClick={() => onView(id)}
          style={{
            padding: '5px 9px', fontSize: 11, background: 'rgba(255,255,255,0.06)',
            color: '#cbd5e0', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4, cursor: 'pointer',
          }}>
          {label}
        </button>
      ))}
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
