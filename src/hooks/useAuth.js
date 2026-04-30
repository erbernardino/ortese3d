import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signOut,
         sendPasswordResetEmail } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { analyticsService } from '../services/analyticsService'

export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) { setUser(null); return }
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
      const data = snap.data() ?? {}
      setUser({ uid: firebaseUser.uid, email: firebaseUser.email, ...data })
      analyticsService.identify(firebaseUser.uid, data.role)
    })
  }, [])

  async function register(email, password, name, role) {
    const { user: fu } = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', fu.uid), { name, role, email })
    analyticsService.track('sign_up', { method: 'email', role })
  }

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
    analyticsService.track('login', { method: 'email' })
  }

  async function logout() {
    await signOut(auth)
  }

  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email)
  }

  return { user, register, login, logout, resetPassword }
}
