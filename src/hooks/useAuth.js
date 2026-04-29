import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) { setUser(null); return }
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
      setUser({ uid: firebaseUser.uid, email: firebaseUser.email, ...snap.data() })
    })
  }, [])

  async function register(email, password, name, role) {
    const { user: fu } = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', fu.uid), { name, role, email })
  }

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    await signOut(auth)
  }

  return { user, register, login, logout }
}
