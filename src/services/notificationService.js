import { collection, addDoc, query, where, orderBy,
         onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export const notificationService = {
  async send(toUserId, title, body, caseId) {
    await addDoc(collection(db, 'notifications'), {
      toUserId,
      title,
      body,
      caseId,
      read: false,
      createdAt: serverTimestamp(),
    })
  },

  subscribe(userId, callback) {
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  },

  async markRead(notificationId) {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true })
  },
}
