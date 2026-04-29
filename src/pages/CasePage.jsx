import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCase } from '../hooks/useCase'
import { useAuth } from '../hooks/useAuth'
import { caseService } from '../services/caseService'
import { patientService } from '../services/patientService'

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
      <button onClick={() => navigate('/')} style={{ marginBottom: 16 }}>← Voltar</button>
      <h2>Caso — {patient?.name ?? '...'}</h2>
      <p>Status: <strong>{STATUS_LABEL[caseData?.status] ?? caseData?.status}</strong></p>
      <p>Diagnóstico: {patient?.diagnosis}</p>

      {user?.role === 'doctor' && caseData?.status === 'draft' && (
        <div style={{ marginTop: 24 }}>
          <h3>Abrir no Editor</h3>
          <button onClick={() => navigate(`/editor/${currentCaseId}`)}>
            Editar modelo 3D →
          </button>
        </div>
      )}
    </div>
  )
}
