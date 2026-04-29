import { useState, useEffect } from 'react'
import { caseService } from '../services/caseService'

export function useCase(caseId) {
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!caseId) return
    const unsub = caseService.subscribeToCase(caseId, data => {
      setCaseData(data)
      setLoading(false)
    })
    return unsub
  }, [caseId])

  return { caseData, loading }
}
