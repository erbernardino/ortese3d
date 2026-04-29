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
    caseService.create(patientId, user.uid).then(newCaseId => {
      setCurrentCaseId(newCaseId)
    })
  }, [user])

  useEffect(() => {
    if (caseData?.patientId) {
      patientService.get(caseData.patientId).then(setPatient)
    }
  }, [caseData?.patientId])

  if (loading || !currentCaseId) return <div style={{ padding: 40 }}>Carregando caso...</div>

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <button onClick={() => navigate('/')}
        style={{ marginBottom: 16, background: 'none', border: 'none', color: '#63b3ed', cursor: 'pointer' }}>
        ← Voltar ao dashboard
      </button>
      <h2>Caso — {patient?.name ?? '...'}</h2>
      <p>Status: <strong>{STATUS_LABEL[caseData?.status] ?? caseData?.status}</strong></p>
      <p>Diagnóstico: {patient?.diagnosis}</p>

      {user?.role === 'doctor' && caseData?.status === 'draft' && (
        <div style={{ marginTop: 24 }}>
          <h3>Próximas ações</h3>
          <button onClick={() => navigate(`/editor/${currentCaseId}`)}
            style={{ marginRight: 12 }}>
            ✏️ Editar modelo 3D
          </button>
          <AssignToOrthotist caseId={currentCaseId} patientName={patient?.name} />
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
    </div>
  )
}

function AssignToOrthotist({ caseId, patientName }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function assign() {
    if (!email.trim()) return
    setSending(true)
    try {
      // For now assign by email as orthotistUid placeholder
      // In production, look up UID by email via a cloud function or Firestore index
      await caseService.assign(caseId, email.trim())
      await notificationService.send(
        email.trim(),
        'Novo caso recebido',
        `Caso de ${patientName ?? 'paciente'} enviado para revisão.`,
        caseId,
      )
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  if (sent) return <p style={{ color: '#48c78e', marginTop: 12 }}>✅ Caso enviado para o ortesista.</p>

  return (
    <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        placeholder="E-mail ou UID do ortesista"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ flex: 1, padding: '8px 12px' }}
      />
      <button onClick={assign} disabled={sending}>
        {sending ? 'Enviando...' : '📤 Enviar'}
      </button>
    </div>
  )
}
