import { ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage'
import { storage } from '../firebase'

function base64ToBytes(base64) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export const storageService = {
  async uploadStl(caseId, stlB64) {
    const path = `cases/${caseId}/model.stl`
    const r = ref(storage, path)
    await uploadBytes(r, base64ToBytes(stlB64), { contentType: 'application/sla' })
    return path
  },

  async uploadVariantStl(caseId, name, stlB64) {
    const safe = name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase()
    const path = `cases/${caseId}/variants/${safe}-${Date.now()}.stl`
    const r = ref(storage, path)
    await uploadBytes(r, base64ToBytes(stlB64), { contentType: 'application/sla' })
    return path
  },

  async uploadEvaluationPhoto(caseId, evalId, file, idx) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `cases/${caseId}/evaluations/${evalId}/photo-${idx}.${ext}`
    const r = ref(storage, path)
    await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' })
    const url = await getDownloadURL(r)
    return { path, url }
  },

  async downloadStlAsBase64(path) {
    const r = ref(storage, path)
    const buf = await getBytes(r)
    return bytesToBase64(new Uint8Array(buf))
  },
}
