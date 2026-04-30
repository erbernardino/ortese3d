const { onCall, HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()

// Resolve um UID a partir de um e-mail.
// Chamável pelo cliente autenticado; retorna apenas o UID (sem dados extras).
exports.resolveUidByEmail = onCall({ region: 'us-central1' }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Login obrigatório.')
  }

  const email = (req.data?.email ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw new HttpsError('invalid-argument', 'E-mail inválido.')
  }

  try {
    const user = await admin.auth().getUserByEmail(email)
    return { uid: user.uid }
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'Usuário não encontrado para esse e-mail.')
    }
    throw new HttpsError('internal', 'Erro ao resolver UID.')
  }
})
