import { collection, doc, addDoc, updateDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { analyticsService } from './analyticsService'
import { storageService } from './storageService'

function evalCol(caseId) {
  return collection(db, 'cases', caseId, 'evaluations')
}

export const evaluationService = {
  async create(caseId, data, createdBy, photoFiles = []) {
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
      photos: [],
      createdBy,
      createdAt: serverTimestamp(),
    })

    if (photoFiles.length) {
      const uploads = await Promise.all(
        photoFiles.map((f, i) => storageService.uploadEvaluationPhoto(caseId, ref.id, f, i))
      )
      await updateDoc(doc(db, 'cases', caseId, 'evaluations', ref.id), {
        photos: uploads,
      })
    }

    analyticsService.track('evaluation_added', {
      case_id: caseId,
      cvai: Number(data.cvai) || null,
      photo_count: photoFiles.length,
    })
    return ref.id
  },

  async list(caseId) {
    const q = query(evalCol(caseId), orderBy('date', 'asc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },
}
