import { collection, doc, addDoc, getDocs, getDoc,
         query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export const patientService = {
  async create(data, userId) {
    const ref = await addDoc(collection(db, 'patients'), {
      ...data,
      createdBy: userId,
      createdAt: serverTimestamp(),
    })
    return ref.id
  },

  async listByUser(userId) {
    const q = query(collection(db, 'patients'), where('createdBy', '==', userId))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async get(patientId) {
    const snap = await getDoc(doc(db, 'patients', patientId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  },
}
