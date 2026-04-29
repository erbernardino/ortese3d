import { collection, doc, addDoc, updateDoc, getDoc,
         getDocs, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export const caseService = {
  async create(patientId, createdBy) {
    const ref = await addDoc(collection(db, 'cases'), {
      patientId,
      createdBy,
      assignedTo: null,
      status: 'draft',
      measurements: {},
      scanFileUrl: null,
      modelFileUrl: null,
      reportUrl: null,
      history: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },

  async get(caseId) {
    const snap = await getDoc(doc(db, 'cases', caseId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  },

  async update(caseId, data) {
    await updateDoc(doc(db, 'cases', caseId), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  },

  async assign(caseId, orthotistUid) {
    await updateDoc(doc(db, 'cases', caseId), {
      assignedTo: orthotistUid,
      status: 'sent',
      updatedAt: serverTimestamp(),
    })
  },

  subscribeToCase(caseId, callback) {
    return onSnapshot(doc(db, 'cases', caseId), snap => {
      if (snap.exists()) callback({ id: snap.id, ...snap.data() })
    })
  },

  async listForUser(userId, role) {
    const field = role === 'doctor' ? 'createdBy' : 'assignedTo'
    const q = query(collection(db, 'cases'), where(field, '==', userId))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },
}
