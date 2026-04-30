import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k)
if (missingKeys.length) {
  const msg = `Configuração Firebase ausente: ${missingKeys.join(', ')}. Crie um .env.local com as variáveis VITE_FIREBASE_*.`
  document.body.innerHTML = `<pre style="padding:24px;color:#c53030;font-family:monospace;white-space:pre-wrap">${msg}</pre>`
  throw new Error(msg)
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app, 'us-central1')

// Analytics: assíncrono e tolerante (Electron file:// e SSR retornam não-suportado).
export let analytics = null
isSupported()
  .then(ok => { if (ok) analytics = getAnalytics(app) })
  .catch(() => {})
