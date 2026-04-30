import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCase } from '../hooks/useCase'
import { useAuth } from '../hooks/useAuth'
import { caseService } from '../services/caseService'
import { patientService } from '../services/patientService'
import { notificationService } from '../services/notificationService'

const STATUS_LABEL = {
  draft: 'Rascunho', sent: 'Enviado', in_progress: 'Em andamento',
  review: 'Em revisão', approved: 'Aprovado', exported: 'Exportado',
}

export default function CasePage() {
  const { caseId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [patient, setPatient] = useState(null)
  const [currentCaseId, setCurrentCaseId] = useState(caseId)
  const { caseData, loading } = useCase(currentCaseId)

  useEffect(() => {
    if (caseId) return
    const patientId = searchParams.get('patientId')
    if (!patientId || !user) return
    patientService.get(patientId).then(p => {
      if (!p) return
      caseService.create(p, user.uid).then(setCurrentCaseId)
    })
  }, [user])

  useEffect(() => {
    if (caseData?.patientId && user?.role === 'doctor') {
      patientService.get(caseData.patientId).then(setPatient)
    }
  }, [caseData?.patientId, user?.role])

  const patientName = caseData?.patientName ?? patient?.name
  const patientDiagnosis = caseData?.patientDiagnosis ?? patient?.diagnosis

  if (loading || !currentCaseId) return <div style={{ padding: 40 }}>Carregando caso...</div>

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <button onClick={() => navigate('/')}
        style={{ marginBottom: 16, background: 'none', border: 'none', color: '#63b3ed', cursor: 'pointer' }}>
        ← Voltar ao dashboard
      </button>
      <h2>Caso — {patientName ?? '...'}</h2>
      <p>Status: <strong>{STATUS_LABEL[caseData?.status] ?? caseData?.status}</strong></p>
      <p>Diagnóstico: {patientDiagnosis}</p>

      {user?.role === 'doctor' && caseData?.status === 'draft' && (
        <div style={{ marginTop: 24 }}>
          <h3>Próximas ações</h3>
          <button onClick={() => navigate(`/editor/${currentCaseId}`)}
            style={{ marginRight: 12 }}>
            ✏️ Editar modelo 3D
          </button>
          <AssignToOrthotist caseId={currentCaseId} patientName={patientName} />
        </div>
      )}

      {caseData?.status !== 'draft' && (
        <div style={{ marginTop: 24 }}>
          <button onClick={() => navigate(`/editor/${currentCaseId}`)}>
            ✏️ Abrir editor
          </button>
          {' '}
          <button onClick={() => navigate(`/validation/${currentCaseId}`)}>
            🔍 Validar e exportar
          </button>
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
        <button onClick={() => navigate(`/evolution/${currentCaseId}`)}
          style={{ background: '#9f7aea', color: 'white', border: 'none',
            borderRadius: 6, padding: '8px 16px' }}>
          📊 Acompanhamento de Evolução
        </button>
        <button onClick={async () => {
          await caseService.setArchived(currentCaseId, !caseData?.archived)
        }}
          style={{ background: caseData?.archived ? '#ed8936' : '#a0aec0',
            color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px' }}>
          {caseData?.archived ? '📂 Desarquivar' : '📁 Arquivar caso'}
        </button>
      </div>
    </div>
  )
}

function AssignToOrthotist({ caseId, patientName }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function assign() {
    if (!email.trim()) return
    setSending(true)
    setError('')
    try {
      const uid = await caseService.resolveUidByEmail(email.trim())
      await caseService.assign(caseId, uid)
      await notificationService.send(
        uid,
        'Novo caso recebido',
        `Caso de ${patientName ?? 'paciente'} enviado para revisão.`,
        caseId,
      )
      setSent(true)
    } catch (err) {
      setError(err.message || 'Erro ao atribuir ortesista')
    } finally {
      setSending(false)
    }
  }

  if (sent) return <p style={{ color: '#48c78e', marginTop: 12 }}>✅ Caso enviado para o ortesista.</p>

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          placeholder="E-mail do ortesista"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ flex: 1, padding: '8px 12px' }}
        />
        <button onClick={assign} disabled={sending}>
          {sending ? 'Enviando...' : '📤 Enviar'}
        </button>
      </div>
      {error && <p style={{ color: '#e53e3e', marginTop: 8, fontSize: 13 }}>{error}</p>}
    </div>
  )
}
