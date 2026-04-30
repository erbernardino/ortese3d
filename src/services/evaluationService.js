import { collection, doc, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { analyticsService } from './analyticsService'

function evalCol(caseId) {
  return collection(db, 'cases', caseId, 'evaluations')
}

export const evaluationService = {
  async create(caseId, data, createdBy) {
    const ref = await addDoc(evalCol(caseId), {
      date: data.date,
      measurements: {
        circOccipital: Number(data.circOccipital) || null,
        circFrontal: Number(data.circFrontal) || null,
        diagA: Number(data.diagA) || null,
        diagB: Number(data.diagB) || null,
        cvai: Number(data.cvai) || null,
        height: Number(data.height) || null,
      },
      notes: data.notes || '',
      createdBy,
      createdAt: serverTimestamp(),
    })
    analyticsService.track('evaluation_added', {
      case_id: caseId,
      cvai: Number(data.cvai) || null,
    })
    return ref.id
  },

  async list(caseId) {
    const q = query(evalCol(caseId), orderBy('date', 'asc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },
}
