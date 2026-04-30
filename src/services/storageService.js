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

  async downloadStlAsBase64(path) {
    const r = ref(storage, path)
    const buf = await getBytes(r)
    return bytesToBase64(new Uint8Array(buf))
  },
}
