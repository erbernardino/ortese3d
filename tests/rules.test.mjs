import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, test } from 'vitest'

const PROJECT_ID = 'demo-ortese3d'

let env
let doctor1, doctor2, ortho1, anonymous

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8088,
    },
  })
  doctor1 = env.authenticatedContext('doc1', { email: 'doc1@x.com' }).firestore()
  doctor2 = env.authenticatedContext('doc2', { email: 'doc2@x.com' }).firestore()
  ortho1 = env.authenticatedContext('ortho1', { email: 'ortho1@x.com' }).firestore()
  anonymous = env.unauthenticatedContext().firestore()
})

afterAll(async () => env && env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
})

// === USERS ===
test('user reads own profile', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'users/doc1'), { name: 'Doc 1', role: 'doctor', email: 'doc1@x.com' })
  })
  await assertSucceeds(getDoc(doc(doctor1, 'users/doc1')))
})

test('user cannot read other profile', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'users/doc2'), { name: 'Doc 2', role: 'doctor', email: 'doc2@x.com' })
  })
  await assertFails(getDoc(doc(doctor1, 'users/doc2')))
})

test('user creates own profile with valid role', async () => {
  await assertSucceeds(setDoc(doc(doctor1, 'users/doc1'), { name: 'X', role: 'doctor', email: 'x@x.com' }))
})

test('user cannot create profile with invalid role', async () => {
  await assertFails(setDoc(doc(doctor1, 'users/doc1'), { name: 'X', role: 'admin', email: 'x@x.com' }))
})

// === PATIENTS ===
test('doctor creates patient', async () => {
  await assertSucceeds(addDoc(collection(doctor1, 'patients'), {
    name: 'Bebê', createdBy: 'doc1', diagnosis: 'plagio', birthDate: '2025-01-01',
  }))
})

test('doctor cannot create patient with createdBy mismatch', async () => {
  await assertFails(addDoc(collection(doctor1, 'patients'), {
    name: 'Bebê', createdBy: 'doc2', diagnosis: 'x', birthDate: '2025-01-01',
  }))
})

test('doctor reads own patient', async () => {
  let patientId
  await env.withSecurityRulesDisabled(async ctx => {
    const ref = await addDoc(collection(ctx.firestore(), 'patients'), { createdBy: 'doc1', name: 'X' })
    patientId = ref.id
  })
  await assertSucceeds(getDoc(doc(doctor1, 'patients', patientId)))
})

test('orthotist cannot read patient (LGPD-strict)', async () => {
  let patientId
  await env.withSecurityRulesDisabled(async ctx => {
    const ref = await addDoc(collection(ctx.firestore(), 'patients'), { createdBy: 'doc1', name: 'X' })
    patientId = ref.id
  })
  await assertFails(getDoc(doc(ortho1, 'patients', patientId)))
})

test('other doctor cannot read patient', async () => {
  let patientId
  await env.withSecurityRulesDisabled(async ctx => {
    const ref = await addDoc(collection(ctx.firestore(), 'patients'), { createdBy: 'doc1', name: 'X' })
    patientId = ref.id
  })
  await assertFails(getDoc(doc(doctor2, 'patients', patientId)))
})

// === CASES ===
test('doctor creates case for self', async () => {
  await assertSucceeds(addDoc(collection(doctor1, 'cases'), {
    createdBy: 'doc1', assignedTo: null, status: 'draft', patientName: 'X', patientId: 'p1',
  }))
})

test('orthotist cannot create case', async () => {
  await assertFails(addDoc(collection(ortho1, 'cases'), {
    createdBy: 'doc1', assignedTo: null, status: 'draft',
  }))
})

test('assigned orthotist reads case', async () => {
  let caseId
  await env.withSecurityRulesDisabled(async ctx => {
    const ref = await addDoc(collection(ctx.firestore(), 'cases'), {
      createdBy: 'doc1', assignedTo: 'ortho1', status: 'sent',
    })
    caseId = ref.id
  })
  await assertSucceeds(getDoc(doc(ortho1, 'cases', caseId)))
})

test('other orthotist cannot read case', async () => {
  let caseId
  await env.withSecurityRulesDisabled(async ctx => {
    const ref = await addDoc(collection(ctx.firestore(), 'cases'), {
      createdBy: 'doc1', assignedTo: 'ortho1', status: 'sent',
    })
    caseId = ref.id
  })
  const ortho2 = env.authenticatedContext('ortho2').firestore()
  await assertFails(getDoc(doc(ortho2, 'cases', caseId)))
})

// === NOTIFICATIONS ===
test('doctor sends notification to assigned orthotist of own case', async () => {
  let caseId
  await env.withSecurityRulesDisabled(async ctx => {
    const ref = await addDoc(collection(ctx.firestore(), 'cases'), {
      createdBy: 'doc1', assignedTo: 'ortho1', status: 'sent',
    })
    caseId = ref.id
  })
  await assertSucceeds(addDoc(collection(doctor1, 'notifications'), {
    toUserId: 'ortho1', caseId, title: 'Novo', body: 'caso', read: false,
  }))
})

test('outsider cannot send notification', async () => {
  let caseId
  await env.withSecurityRulesDisabled(async ctx => {
    const ref = await addDoc(collection(ctx.firestore(), 'cases'), {
      createdBy: 'doc1', assignedTo: 'ortho1', status: 'sent',
    })
    caseId = ref.id
  })
  await assertFails(addDoc(collection(doctor2, 'notifications'), {
    toUserId: 'ortho1', caseId, title: 'spam', body: '', read: false,
  }))
})

test('user reads own notifications only', async () => {
  let nid
  await env.withSecurityRulesDisabled(async ctx => {
    const ref = await addDoc(collection(ctx.firestore(), 'notifications'), {
      toUserId: 'ortho1', caseId: 'c1', title: 't', body: 'b', read: false,
    })
    nid = ref.id
  })
  await assertSucceeds(getDoc(doc(ortho1, 'notifications', nid)))
  await assertFails(getDoc(doc(doctor1, 'notifications', nid)))
})

// === ANONYMOUS ===
test('anonymous denied everywhere', async () => {
  await assertFails(getDoc(doc(anonymous, 'users/doc1')))
  await assertFails(addDoc(collection(anonymous, 'cases'), {}))
})
