import { collection, doc, addDoc, updateDoc, getDoc,
         getDocs, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { cacheService } from './cacheService'
import { analyticsService } from './analyticsService'

const TEMP_PREFIX = 'tmp-'
let tmpCounter = 0
function tempId() {
  return `${TEMP_PREFIX}${Date.now()}-${tmpCounter++}`
}

export const caseService = {
  async create(patient, createdBy) {
    const payload = {
      patientId: patient.id,
      patientName: patient.name,
      patientDiagnosis: patient.diagnosis,
      patientBirthDate: patient.birthDate,
      createdBy,
      assignedTo: null,
      status: 'draft',
      measurements: {
        circOccipital: patient.circOccipital,
        circFrontal: patient.circFrontal,
        diagA: patient.diagA,
        diagB: patient.diagB,
        cvai: patient.cvai,
        height: patient.height,
      },
      scanFileUrl: null,
      modelFileUrl: null,
      reportUrl: null,
      history: [],
    }
    if (cacheService.enabled && !cacheService.isOnline()) {
      const id = tempId()
      await cacheService.setCase(id, { id, ...payload, _pending: true })
      await cacheService.enqueueOp({ type: 'create', tempId: id, payload })
      analyticsService.track('case_created', { offline: true })
      return id
    }
    const ref = await addDoc(collection(db, 'cases'), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await cacheService.setCase(ref.id, { id: ref.id, ...payload })
    analyticsService.track('case_created', { offline: false })
    return ref.id
  },

  async get(caseId) {
    if (caseId.startsWith(TEMP_PREFIX)) {
      const cached = (await cacheService.getCases())[caseId]
      return cached ?? null
    }
    try {
      const snap = await getDoc(doc(db, 'cases', caseId))
      if (!snap.exists()) return null
      const data = { id: snap.id, ...snap.data() }
      await cacheService.setCase(caseId, data)
      return data
    } catch (err) {
      const cached = (await cacheService.getCases())[caseId]
      if (cached) return cached
      throw err
    }
  },

  async update(caseId, data) {
    if (caseId.startsWith(TEMP_PREFIX) || (cacheService.enabled && !cacheService.isOnline())) {
      const cached = (await cacheService.getCases())[caseId]
      if (cached) await cacheService.setCase(caseId, { ...cached, ...data, _pending: true })
      await cacheService.enqueueOp({ type: 'update', caseId, data })
      return
    }
    await updateDoc(doc(db, 'cases', caseId), {
      ...data,
      updatedAt: serverTimestamp(),
    })
    const cached = (await cacheService.getCases())[caseId]
    if (cached) await cacheService.setCase(caseId, { ...cached, ...data })
  },

  async assign(caseId, orthotistUid) {
    analyticsService.track('case_assigned', { case_id: caseId })
    return this.update(caseId, { assignedTo: orthotistUid, status: 'sent' })
  },

  async setArchived(caseId, archived) {
    analyticsService.track(archived ? 'case_archived' : 'case_unarchived',
      { case_id: caseId })
    return this.update(caseId, { archived: !!archived })
  },

  subscribeToCase(caseId, callback) {
    if (caseId.startsWith(TEMP_PREFIX)) {
      cacheService.getCases().then(cs => { if (cs[caseId]) callback(cs[caseId]) })
      return () => {}
    }
    return onSnapshot(doc(db, 'cases', caseId), snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        cacheService.setCase(caseId, data)
        callback(data)
      }
    })
  },

  async listForUser(userId, role) {
    const field = role === 'doctor' ? 'createdBy' : 'assignedTo'
    try {
      const q = query(collection(db, 'cases'), where(field, '==', userId))
      const snap = await getDocs(q)
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      await cacheService.setCases(list)
      return list
    } catch {
      const cached = await cacheService.listCases()
      return cached.filter(c => c[field] === userId)
    }
  },

  async resolveUidByEmail(email) {
    const fn = httpsCallable(functions, 'resolveUidByEmail')
    const { data } = await fn({ email })
    return data.uid
  },

  async _replayOp(op) {
    if (op.type === 'create') {
      const ref = await addDoc(collection(db, 'cases'), {
        ...op.payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      const cs = await cacheService.getCases()
      delete cs[op.tempId]
      cs[ref.id] = { id: ref.id, ...op.payload }
      if (cacheService.enabled) {
        await window.electronAPI.cache.set('cases', cs)
      }
    } else if (op.type === 'update') {
      const realId = op.caseId.startsWith(TEMP_PREFIX) ? null : op.caseId
      if (!realId) throw new Error('temp case not yet synced')
      await updateDoc(doc(db, 'cases', realId), {
        ...op.data,
        updatedAt: serverTimestamp(),
      })
    }
  },
}
