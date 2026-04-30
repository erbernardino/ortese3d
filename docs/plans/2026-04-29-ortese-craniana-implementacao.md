# OrteseCAD — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o OrteseCAD, um aplicativo desktop Electron para geração, edição e exportação de órteses cranianas 3D, com colaboração via Firebase entre médico e ortesista.

**Architecture:** Electron + React (frontend/UI) comunicando com um servidor Python FastAPI rodando localmente na porta 8765 (processamento 3D pesado). Firebase (Firestore + Auth + Storage) sincroniza casos entre os usuários.

**Tech Stack:** Electron 28, React 18, Three.js, Vite, Python 3.11, FastAPI, trimesh, Open3D, reportlab, Firebase JS SDK v10, Firestore, Firebase Auth, Firebase Storage.

---

## Estrutura de Arquivos

```
criaOrtese3d/
├── package.json
├── vite.config.js
├── electron/
│   ├── main.js               # Processo principal Electron
│   ├── preload.js            # Bridge IPC segura
│   └── python-manager.js     # Spawn e gerência do servidor Python
├── src/
│   ├── main.jsx              # Entry point React
│   ├── App.jsx               # Router + AuthGuard
│   ├── firebase.js           # Inicialização Firebase
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── PatientFormPage.jsx
│   │   ├── CasePage.jsx
│   │   ├── EditorPage.jsx
│   │   ├── ValidationPage.jsx
│   │   └── ReportPage.jsx
│   ├── components/
│   │   ├── ThreeViewer.jsx       # Canvas Three.js
│   │   ├── ZonePainter.jsx       # Pintura de zonas
│   │   ├── ThicknessSlider.jsx   # Controle de espessura
│   │   └── ValidationChecklist.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useCase.js
│   │   └── useModelHistory.js    # Undo/redo
│   └── services/
│       ├── pythonApi.js          # HTTP → FastAPI :8765
│       ├── patientService.js     # Firestore patients/
│       └── caseService.js        # Firestore cases/
├── python/
│   ├── requirements.txt
│   ├── main.py                   # FastAPI app
│   ├── routers/
│   │   ├── model.py              # /generate-model, /validate-model
│   │   └── export.py             # /export
│   └── services/
│       ├── model_generator.py    # Geração paramétrica de malha
│       ├── scan_processor.py     # Open3D: import e limpeza de scan
│       ├── validator.py          # Checklist de validação de malha
│       └── exporter.py           # STL, G-code, PDF
└── tests/
    └── python/
        ├── test_model_generator.py
        ├── test_scan_processor.py
        ├── test_validator.py
        └── test_exporter.py
```

---

## Fase 1 — Fundação do Projeto

### Tarefa 1: Scaffold do projeto Electron + React + Vite

**Arquivos:**
- Criar: `criaOrtese3d/package.json`
- Criar: `criaOrtese3d/vite.config.js`
- Criar: `criaOrtese3d/electron/main.js`
- Criar: `criaOrtese3d/electron/preload.js`
- Criar: `criaOrtese3d/src/main.jsx`
- Criar: `criaOrtese3d/src/App.jsx`

- [ ] **Passo 1: Criar o diretório e inicializar o projeto Node**

```bash
cd "criaOrtese3d"
npm init -y
```

- [ ] **Passo 2: Instalar dependências**

```bash
npm install react react-dom react-router-dom
npm install --save-dev electron vite @vitejs/plugin-react electron-builder concurrently wait-on
```

- [ ] **Passo 3: Criar `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist/renderer' },
})
```

- [ ] **Passo 4: Criar `electron/main.js`**

```js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { startPython, stopPython } = require('./python-manager')

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await startPython()
  createWindow()
})

app.on('will-quit', stopPython)
```

- [ ] **Passo 5: Criar `electron/preload.js`**

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  pythonReady: () => ipcRenderer.invoke('python-ready'),
})
```

- [ ] **Passo 6: Criar `src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

- [ ] **Passo 7: Criar `src/App.jsx` com placeholder**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>OrteseCAD — Em construção</div>} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Passo 8: Atualizar `package.json` com scripts**

```json
{
  "main": "electron/main.js",
  "scripts": {
    "dev:renderer": "vite",
    "dev:electron": "wait-on http://localhost:5173 && electron .",
    "dev": "concurrently \"npm run dev:renderer\" \"npm run dev:electron\"",
    "build": "vite build && electron-builder"
  }
}
```

- [ ] **Passo 9: Verificar que o app abre**

```bash
npm run dev
```
Esperado: janela Electron abre mostrando "OrteseCAD — Em construção".

- [ ] **Passo 10: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Electron + React + Vite"
```

---

### Tarefa 2: Servidor Python FastAPI local

**Arquivos:**
- Criar: `python/requirements.txt`
- Criar: `python/main.py`
- Criar: `python/routers/model.py`
- Criar: `python/routers/export.py`

- [ ] **Passo 1: Criar `python/requirements.txt`**

```
fastapi==0.110.0
uvicorn==0.29.0
trimesh==4.3.1
open3d==0.18.0
numpy==1.26.4
reportlab==4.1.0
pytest==8.1.0
httpx==0.27.0
```

- [ ] **Passo 2: Criar ambiente virtual e instalar dependências**

```bash
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Passo 3: Escrever teste de saúde do servidor**

Criar `tests/python/test_main.py`:

```python
from fastapi.testclient import TestClient
from python.main import app

client = TestClient(app)

def test_health():
    response = client.get("/status")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Passo 4: Rodar o teste para confirmar que falha**

```bash
cd ..
python -m pytest tests/python/test_main.py -v
```
Esperado: FAIL — "ModuleNotFoundError: No module named 'python.main'"

- [ ] **Passo 5: Criar `python/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from python.routers import model, export

app = FastAPI(title="OrteseCAD API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(model.router)
app.include_router(export.router)

@app.get("/status")
def status():
    return {"status": "ok"}
```

- [ ] **Passo 6: Criar `python/routers/model.py` (stub)**

```python
from fastapi import APIRouter

router = APIRouter(prefix="/model", tags=["model"])

@router.post("/generate")
def generate_model(data: dict):
    return {"message": "not implemented"}

@router.post("/validate")
def validate_model(data: dict):
    return {"message": "not implemented"}
```

- [ ] **Passo 7: Criar `python/routers/export.py` (stub)**

```python
from fastapi import APIRouter

router = APIRouter(prefix="/export", tags=["export"])

@router.post("/stl")
def export_stl(data: dict):
    return {"message": "not implemented"}

@router.post("/gcode")
def export_gcode(data: dict):
    return {"message": "not implemented"}

@router.post("/pdf")
def export_pdf(data: dict):
    return {"message": "not implemented"}
```

- [ ] **Passo 8: Rodar o teste de saúde**

```bash
python -m pytest tests/python/test_main.py -v
```
Esperado: PASS

- [ ] **Passo 9: Testar servidor manualmente**

```bash
uvicorn python.main:app --port 8765 --reload
# Em outro terminal:
curl http://localhost:8765/status
```
Esperado: `{"status":"ok"}`

- [ ] **Passo 10: Commit**

```bash
git add python/ tests/python/test_main.py
git commit -m "feat: Python FastAPI server com routers stub"
```

---

### Tarefa 3: Bridge Electron → Python (python-manager + pythonApi)

**Arquivos:**
- Criar: `electron/python-manager.js`
- Criar: `src/services/pythonApi.js`

- [ ] **Passo 1: Criar `electron/python-manager.js`**

```js
const { spawn } = require('child_process')
const path = require('path')

let pythonProcess = null

async function startPython() {
  const pythonPath = path.join(__dirname, '../python/.venv/bin/python')
  pythonProcess = spawn(pythonPath, ['-m', 'uvicorn', 'python.main:app', '--port', '8765'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  })

  // Aguarda servidor ficar disponível
  await waitForServer('http://localhost:8765/status', 10000)
}

async function waitForServer(url, timeout) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 300))
  }
  throw new Error('Python server did not start in time')
}

function stopPython() {
  if (pythonProcess) pythonProcess.kill()
}

module.exports = { startPython, stopPython }
```

- [ ] **Passo 2: Criar `src/services/pythonApi.js`**

```js
const BASE = 'http://localhost:8765'

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Python API error: ${res.status}`)
  return res.json()
}

export const pythonApi = {
  status: () => request('GET', '/status'),
  generateModel: (data) => request('POST', '/model/generate', data),
  validateModel: (data) => request('POST', '/model/validate', data),
  exportStl: (data) => request('POST', '/export/stl', data),
  exportGcode: (data) => request('POST', '/export/gcode', data),
  exportPdf: (data) => request('POST', '/export/pdf', data),
}
```

- [ ] **Passo 3: Testar chamada manual no browser do Electron**

Adicionar temporariamente no `App.jsx`:
```jsx
import { pythonApi } from './services/pythonApi'
// No componente:
pythonApi.status().then(console.log)
```
Esperado no console do Electron: `{status: "ok"}`

- [ ] **Passo 4: Remover o teste manual e commit**

```bash
git add electron/python-manager.js src/services/pythonApi.js
git commit -m "feat: bridge Electron-Python via localhost:8765"
```

---

## Fase 2 — Firebase: Autenticação e Estrutura de Dados

### Tarefa 4: Configuração do Firebase

**Arquivos:**
- Criar: `src/firebase.js`

- [ ] **Passo 1: Criar projeto no Firebase Console**

1. Acesse console.firebase.google.com
2. Crie projeto "ortesecad"
3. Ative: Authentication (Email/Senha), Firestore Database, Storage
4. Vá em Configurações → Seu app web → copie o objeto `firebaseConfig`

- [ ] **Passo 2: Instalar Firebase SDK**

```bash
npm install firebase
```

- [ ] **Passo 3: Criar `src/firebase.js`**

```js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
```

- [ ] **Passo 4: Criar `.env.local` com as credenciais**

```
VITE_FIREBASE_API_KEY=sua_chave
VITE_FIREBASE_AUTH_DOMAIN=ortesecad.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ortesecad
VITE_FIREBASE_STORAGE_BUCKET=ortesecad.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

- [ ] **Passo 5: Adicionar `.env.local` ao `.gitignore`**

```bash
echo ".env.local" >> .gitignore
echo "python/.venv" >> .gitignore
echo "dist/" >> .gitignore
```

- [ ] **Passo 6: Commit**

```bash
git add src/firebase.js .gitignore
git commit -m "feat: Firebase init (Auth + Firestore + Storage)"
```

---

### Tarefa 5: Autenticação — Login e Registro

**Arquivos:**
- Criar: `src/hooks/useAuth.js`
- Criar: `src/pages/LoginPage.jsx`
- Modificar: `src/App.jsx`

- [ ] **Passo 1: Criar `src/hooks/useAuth.js`**

```js
import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = carregando

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
```

- [ ] **Passo 2: Criar `src/pages/LoginPage.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'doctor' })
  const [error, setError] = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        await register(form.email, form.password, form.name, form.role)
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 32 }}>
      <h1>OrteseCAD</h1>
      <h2>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <>
            <input placeholder="Nome completo" value={form.name}
              onChange={e => set('name', e.target.value)} required />
            <select value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="doctor">Médico / Clínico</option>
              <option value="orthotist">Ortesista</option>
            </select>
          </>
        )}
        <input type="email" placeholder="E-mail" value={form.email}
          onChange={e => set('email', e.target.value)} required />
        <input type="password" placeholder="Senha" value={form.password}
          onChange={e => set('password', e.target.value)} required />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">{mode === 'login' ? 'Entrar' : 'Registrar'}</button>
      </form>
      <button onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
      </button>
    </div>
  )
}
```

- [ ] **Passo 3: Atualizar `src/App.jsx` com AuthGuard**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

function AuthGuard({ children }) {
  const { user } = useAuth()
  if (user === undefined) return <div>Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <AuthGuard><DashboardPage /></AuthGuard>
        } />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Passo 4: Criar `src/pages/DashboardPage.jsx` placeholder**

```jsx
import { useAuth } from '../hooks/useAuth'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Olá, {user?.name} ({user?.role})</p>
      <button onClick={logout}>Sair</button>
    </div>
  )
}
```

- [ ] **Passo 5: Testar fluxo de login/registro manualmente**

```bash
npm run dev
```
1. Abrir app → deve redirecionar para `/login`
2. Criar conta como médico
3. Entrar → deve mostrar Dashboard com nome e role
4. Clicar Sair → volta para Login

- [ ] **Passo 6: Commit**

```bash
git add src/
git commit -m "feat: auth Firebase (login, registro, AuthGuard)"
```

---

## Fase 3 — Gestão de Pacientes e Casos

### Tarefa 6: CRUD de Pacientes (Firestore)

**Arquivos:**
- Criar: `src/services/patientService.js`
- Criar: `src/pages/PatientFormPage.jsx`

- [ ] **Passo 1: Criar `src/services/patientService.js`**

```js
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
```

- [ ] **Passo 2: Criar `src/pages/PatientFormPage.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { patientService } from '../services/patientService'

const EMPTY = {
  name: '', birthDate: '', guardian: '', diagnosis: '',
  circOccipital: '', circFrontal: '',
  diagA: '', diagB: '', cvai: '', height: '',
}

export default function PatientFormPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const patientId = await patientService.create(form, user.uid)
      navigate(`/case/new?patientId=${patientId}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <h2>Novo Paciente</h2>
      <form onSubmit={submit}>
        <fieldset>
          <legend>Dados do Paciente</legend>
          <input placeholder="Nome completo" value={form.name}
            onChange={e => set('name', e.target.value)} required />
          <input type="date" value={form.birthDate}
            onChange={e => set('birthDate', e.target.value)} required />
          <input placeholder="Responsável" value={form.guardian}
            onChange={e => set('guardian', e.target.value)} required />
          <input placeholder="Diagnóstico" value={form.diagnosis}
            onChange={e => set('diagnosis', e.target.value)} required />
        </fieldset>

        <fieldset>
          <legend>Medidas Cranianas (mm)</legend>
          {[
            ['circOccipital', 'Circunferência Occipital'],
            ['circFrontal', 'Circunferência Frontal'],
            ['diagA', 'Diagonal A (maior)'],
            ['diagB', 'Diagonal B (menor)'],
            ['cvai', 'CVAI (%)'],
            ['height', 'Altura Craniana'],
          ].map(([field, label]) => (
            <label key={field}>
              {label}
              <input type="number" step="0.1" value={form[field]}
                onChange={e => set(field, e.target.value)} required />
            </label>
          ))}
        </fieldset>

        <button type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar e Abrir Caso →'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Passo 3: Adicionar rota em `App.jsx`**

```jsx
import PatientFormPage from './pages/PatientFormPage'
// Na <Routes>:
<Route path="/patient/new" element={<AuthGuard><PatientFormPage /></AuthGuard>} />
```

- [ ] **Passo 4: Testar manualmente**

```bash
npm run dev
```
Navegar para `/patient/new`, preencher e submeter. Verificar no Firebase Console → Firestore → coleção `patients`.

- [ ] **Passo 5: Commit**

```bash
git add src/services/patientService.js src/pages/PatientFormPage.jsx src/App.jsx
git commit -m "feat: cadastro de pacientes com medidas cranianas"
```

---

### Tarefa 7: CRUD de Casos e Colaboração

**Arquivos:**
- Criar: `src/services/caseService.js`
- Criar: `src/hooks/useCase.js`
- Criar: `src/pages/CasePage.jsx`

- [ ] **Passo 1: Criar `src/services/caseService.js`**

```js
import { collection, doc, addDoc, updateDoc, getDoc,
         getDocs, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export const caseService = {
  async create(patientId, createdBy) {
    const ref = await addDoc(collection(db, 'cases'), {
      patientId,
      createdBy,
      assignedTo: null,
      status: 'draft', // draft | sent | in_progress | review | approved | exported
      measurements: {},
      scanFileUrl: null,
      modelFileUrl: null,
      reportUrl: null,
      history: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },

  async get(caseId) {
    const snap = await getDoc(doc(db, 'cases', caseId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  },

  async update(caseId, data) {
    await updateDoc(doc(db, 'cases', caseId), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  },

  async assign(caseId, orthotistUid) {
    await updateDoc(doc(db, 'cases', caseId), {
      assignedTo: orthotistUid,
      status: 'sent',
      updatedAt: serverTimestamp(),
    })
  },

  subscribeToCase(caseId, callback) {
    return onSnapshot(doc(db, 'cases', caseId), snap => {
      if (snap.exists()) callback({ id: snap.id, ...snap.data() })
    })
  },

  async listForUser(userId, role) {
    const field = role === 'doctor' ? 'createdBy' : 'assignedTo'
    const q = query(collection(db, 'cases'), where(field, '==', userId))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },
}
```

- [ ] **Passo 2: Criar `src/hooks/useCase.js`**

```js
import { useState, useEffect } from 'react'
import { caseService } from '../services/caseService'

export function useCase(caseId) {
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!caseId) return
    const unsub = caseService.subscribeToCase(caseId, data => {
      setCaseData(data)
      setLoading(false)
    })
    return unsub
  }, [caseId])

  return { caseData, loading }
}
```

- [ ] **Passo 3: Criar `src/pages/CasePage.jsx`**

```jsx
import { useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCase } from '../hooks/useCase'
import { useAuth } from '../hooks/useAuth'
import { caseService } from '../services/caseService'
import { patientService } from '../services/patientService'

export default function CasePage() {
  const { caseId } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [patient, setPatient] = useState(null)
  const [currentCaseId, setCurrentCaseId] = useState(caseId)
  const { caseData, loading } = useCase(currentCaseId)

  useEffect(() => {
    async function init() {
      // Criar caso se vier de /case/new?patientId=...
      if (!caseId) {
        const patientId = searchParams.get('patientId')
        const newCaseId = await caseService.create(patientId, user.uid)
        setCurrentCaseId(newCaseId)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (caseData?.patientId) {
      patientService.get(caseData.patientId).then(setPatient)
    }
  }, [caseData?.patientId])

  if (loading) return <div>Carregando caso...</div>

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <h2>Caso — {patient?.name}</h2>
      <p>Status: <strong>{caseData?.status}</strong></p>
      <p>Diagnóstico: {patient?.diagnosis}</p>

      {user.role === 'doctor' && caseData?.status === 'draft' && (
        <AssignToOrthotist caseId={currentCaseId} />
      )}
    </div>
  )
}

function AssignToOrthotist({ caseId }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  async function assign() {
    // Simplificado: ortesista encontrado por e-mail via Firestore
    setSending(true)
    // TODO na Tarefa 8: buscar UID por e-mail
    await caseService.assign(caseId, email)
    setSending(false)
  }

  return (
    <div>
      <h3>Enviar para Ortesista</h3>
      <input placeholder="E-mail do ortesista" value={email}
        onChange={e => setEmail(e.target.value)} />
      <button onClick={assign} disabled={sending}>
        {sending ? 'Enviando...' : 'Enviar Caso'}
      </button>
    </div>
  )
}
```

- [ ] **Passo 4: Adicionar rotas em `App.jsx`**

```jsx
import CasePage from './pages/CasePage'
// Na <Routes>:
<Route path="/case/new" element={<AuthGuard><CasePage /></AuthGuard>} />
<Route path="/case/:caseId" element={<AuthGuard><CasePage /></AuthGuard>} />
```

- [ ] **Passo 5: Commit**

```bash
git add src/services/caseService.js src/hooks/useCase.js src/pages/CasePage.jsx src/App.jsx
git commit -m "feat: gestão de casos com colaboração via Firebase"
```

---

### Tarefa 8: Dashboard com lista de pacientes e casos

**Arquivos:**
- Modificar: `src/pages/DashboardPage.jsx`

- [ ] **Passo 1: Atualizar `src/pages/DashboardPage.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { caseService } from '../services/caseService'
import { patientService } from '../services/patientService'

const STATUS_LABEL = {
  draft: 'Rascunho', sent: 'Enviado', in_progress: 'Em andamento',
  review: 'Em revisão', approved: 'Aprovado', exported: 'Exportado',
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [patients, setPatients] = useState({})

  useEffect(() => {
    if (!user) return
    caseService.listForUser(user.uid, user.role).then(async (list) => {
      setCases(list)
      // Buscar dados dos pacientes
      const ids = [...new Set(list.map(c => c.patientId))]
      const pats = await Promise.all(ids.map(id => patientService.get(id)))
      const map = {}
      pats.forEach(p => { if (p) map[p.id] = p })
      setPatients(map)
    })
  }, [user])

  const active = cases.filter(c => !['approved', 'exported'].includes(c.status))
  const done = cases.filter(c => ['approved', 'exported'].includes(c.status))
  const pending = cases.filter(c => c.status === 'review')

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>OrteseCAD</h1>
        <div>
          <span>{user?.name} ({user?.role === 'doctor' ? 'Médico' : 'Ortesista'})</span>
          <button onClick={logout} style={{ marginLeft: 16 }}>Sair</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 32 }}>
        <StatCard label="Casos ativos" value={active.length} />
        <StatCard label="Prontos" value={done.length} />
        <StatCard label="Aguardando revisão" value={pending.length} />
      </div>

      {user?.role === 'doctor' && (
        <button onClick={() => navigate('/patient/new')}>+ Novo Paciente</button>
      )}

      <h2>Casos Recentes</h2>
      {cases.length === 0 && <p>Nenhum caso encontrado.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {cases.map(c => (
          <li key={c.id}
            onClick={() => navigate(`/case/${c.id}`)}
            style={{ cursor: 'pointer', padding: 12, border: '1px solid #ddd',
                     borderRadius: 8, marginBottom: 8 }}>
            <strong>{patients[c.patientId]?.name ?? '...'}</strong>
            <span style={{ float: 'right' }}>{STATUS_LABEL[c.status]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 32, fontWeight: 700 }}>{value}</div>
      <div>{label}</div>
    </div>
  )
}
```

- [ ] **Passo 2: Testar fluxo completo**

```bash
npm run dev
```
1. Login → Dashboard mostra contadores zerados
2. Clicar "+ Novo Paciente" → preencher → salvar
3. Voltar ao Dashboard → caso aparece na lista com status "Rascunho"

- [ ] **Passo 3: Commit**

```bash
git add src/pages/DashboardPage.jsx
git commit -m "feat: dashboard com lista de casos e estatísticas"
```

---

## Fase 4 — Pipeline Python: Geração 3D Paramétrica

### Tarefa 9: Geração de malha a partir de medidas

**Arquivos:**
- Criar: `python/services/model_generator.py`
- Criar: `tests/python/test_model_generator.py`
- Modificar: `python/routers/model.py`

- [ ] **Passo 1: Escrever testes**

Criar `tests/python/test_model_generator.py`:

```python
import pytest
import numpy as np
from python.services.model_generator import generate_from_measurements

MEASUREMENTS = {
    "circ_occipital": 380.0,
    "circ_frontal": 370.0,
    "diag_a": 135.0,
    "diag_b": 118.0,
    "cvai": 8.4,
    "height": 72.0,
    "offset_mm": 4.0,
    "wall_mm": 3.0,
}

def test_generate_returns_mesh():
    mesh = generate_from_measurements(MEASUREMENTS)
    assert mesh is not None

def test_mesh_is_manifold():
    import trimesh
    mesh = generate_from_measurements(MEASUREMENTS)
    assert isinstance(mesh, trimesh.Trimesh)
    assert mesh.is_watertight

def test_mesh_has_vertices():
    mesh = generate_from_measurements(MEASUREMENTS)
    assert len(mesh.vertices) > 100

def test_mesh_dimensions_match_input():
    mesh = generate_from_measurements(MEASUREMENTS)
    bounds = mesh.bounding_box.extents
    # Largura do capacete ≈ diagonal A + offset dos dois lados
    expected_width = MEASUREMENTS["diag_a"] + 2 * MEASUREMENTS["offset_mm"]
    assert abs(bounds[0] - expected_width) < 10  # tolerância 10mm
```

- [ ] **Passo 2: Rodar testes para confirmar falha**

```bash
python -m pytest tests/python/test_model_generator.py -v
```
Esperado: FAIL — "cannot import name 'generate_from_measurements'"

- [ ] **Passo 3: Criar `python/services/model_generator.py`**

```python
import numpy as np
import trimesh

def generate_from_measurements(m: dict) -> trimesh.Trimesh:
    """
    Gera malha do capacete a partir de medidas cranianas.
    Modelo: elipsoide craniano com offset externo e parede oca.
    """
    # Semi-eixos do crânio (mm)
    ax = m["diag_a"] / 2
    ay = m["diag_b"] / 2
    az = m["height"] / 2

    offset = m.get("offset_mm", 4.0)
    wall = m.get("wall_mm", 3.0)

    # Elipsoide externo (superfície do capacete)
    outer = _make_ellipsoid(ax + offset, ay + offset, az + offset * 0.5, subdivisions=4)

    # Elipsoide interno (folga interna — remove material de dentro)
    inner = _make_ellipsoid(ax + offset - wall, ay + offset - wall,
                            az + offset * 0.5 - wall, subdivisions=4)
    inner.invert()

    # Combina outer e inner para criar casca oca
    helmet = trimesh.util.concatenate([outer, inner])
    helmet.process(validate=True)

    return helmet


def _make_ellipsoid(ax: float, ay: float, az: float, subdivisions: int = 3) -> trimesh.Trimesh:
    sphere = trimesh.creation.icosphere(subdivisions=subdivisions)
    sphere.vertices *= np.array([ax, ay, az])
    return sphere
```

- [ ] **Passo 4: Rodar testes**

```bash
python -m pytest tests/python/test_model_generator.py -v
```
Esperado: todos PASS

- [ ] **Passo 5: Conectar ao router FastAPI em `python/routers/model.py`**

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from python.services.model_generator import generate_from_measurements
import trimesh
import base64
import io

router = APIRouter(prefix="/model", tags=["model"])

class MeasurementsInput(BaseModel):
    circ_occipital: float
    circ_frontal: float
    diag_a: float
    diag_b: float
    cvai: float
    height: float
    offset_mm: float = 4.0
    wall_mm: float = 3.0

@router.post("/generate")
def generate_model(data: MeasurementsInput):
    try:
        mesh = generate_from_measurements(data.model_dump())
        # Serializar como STL base64 para transferência
        buf = io.BytesIO()
        mesh.export(buf, file_type='stl')
        stl_b64 = base64.b64encode(buf.getvalue()).decode()
        return {
            "stl_b64": stl_b64,
            "vertex_count": len(mesh.vertices),
            "face_count": len(mesh.faces),
            "is_watertight": mesh.is_watertight,
            "volume_cm3": round(mesh.volume / 1000, 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate")
def validate_model(data: dict):
    return {"message": "not implemented"}
```

- [ ] **Passo 6: Testar endpoint manualmente**

```bash
uvicorn python.main:app --port 8765 --reload
curl -X POST http://localhost:8765/model/generate \
  -H "Content-Type: application/json" \
  -d '{"circ_occipital":380,"circ_frontal":370,"diag_a":135,"diag_b":118,"cvai":8.4,"height":72}'
```
Esperado: JSON com `stl_b64`, `vertex_count`, `is_watertight: true`

- [ ] **Passo 7: Commit**

```bash
git add python/services/model_generator.py python/routers/model.py tests/python/test_model_generator.py
git commit -m "feat: geração paramétrica de malha craniana (elipsoide + offset)"
```

---

### Tarefa 10: Importação e processamento de scan 3D

**Arquivos:**
- Criar: `python/services/scan_processor.py`
- Criar: `tests/python/test_scan_processor.py`

- [ ] **Passo 1: Escrever testes**

Criar `tests/python/test_scan_processor.py`:

```python
import trimesh
import numpy as np
import tempfile, os
from python.services.scan_processor import process_scan

def _make_test_stl():
    sphere = trimesh.creation.icosphere(subdivisions=3)
    sphere.vertices *= 70  # ~cabeça de bebê
    buf = tempfile.NamedTemporaryFile(suffix='.stl', delete=False)
    sphere.export(buf.name)
    return buf.name

def test_process_scan_returns_mesh():
    path = _make_test_stl()
    try:
        mesh = process_scan(path)
        assert mesh is not None
    finally:
        os.unlink(path)

def test_process_scan_is_manifold():
    path = _make_test_stl()
    try:
        mesh = process_scan(path)
        assert isinstance(mesh, trimesh.Trimesh)
        assert mesh.is_watertight
    finally:
        os.unlink(path)

def test_process_scan_removes_noise():
    path = _make_test_stl()
    try:
        mesh = process_scan(path)
        # Malha limpa não deve ter componentes desconexos além de 1
        components = mesh.split(only_watertight=False)
        assert len(components) == 1
    finally:
        os.unlink(path)
```

- [ ] **Passo 2: Rodar para confirmar falha**

```bash
python -m pytest tests/python/test_scan_processor.py -v
```
Esperado: FAIL

- [ ] **Passo 3: Criar `python/services/scan_processor.py`**

```python
import trimesh
import numpy as np

def process_scan(file_path: str) -> trimesh.Trimesh:
    """
    Importa e limpa malha de scan 3D (STL/OBJ/PLY).
    Passos: carregar → manter maior componente → preencher buracos → suavizar.
    """
    loaded = trimesh.load(file_path, force='mesh')

    if isinstance(loaded, trimesh.Scene):
        meshes = list(loaded.geometry.values())
        loaded = trimesh.util.concatenate(meshes)

    # Manter apenas o maior componente conexo (remove ruído)
    components = loaded.split(only_watertight=False)
    mesh = max(components, key=lambda m: len(m.vertices))

    # Preencher buracos
    trimesh.repair.fill_holes(mesh)

    # Suavização Laplaciana leve (5 iterações)
    trimesh.smoothing.filter_laplacian(mesh, lamb=0.5, iterations=5)

    mesh.process(validate=True)
    return mesh
```

- [ ] **Passo 4: Rodar testes**

```bash
python -m pytest tests/python/test_scan_processor.py -v
```
Esperado: todos PASS

- [ ] **Passo 5: Expor endpoint no router**

Em `python/routers/model.py`, adicionar após os imports:

```python
from fastapi import UploadFile, File
from python.services.scan_processor import process_scan
import tempfile

@router.post("/import-scan")
async def import_scan(file: UploadFile = File(...)):
    suffix = '.' + file.filename.split('.')[-1]
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        mesh = process_scan(tmp_path)
        buf = io.BytesIO()
        mesh.export(buf, file_type='stl')
        stl_b64 = base64.b64encode(buf.getvalue()).decode()
        return {"stl_b64": stl_b64, "vertex_count": len(mesh.vertices)}
    finally:
        import os; os.unlink(tmp_path)
```

- [ ] **Passo 6: Commit**

```bash
git add python/services/scan_processor.py tests/python/test_scan_processor.py python/routers/model.py
git commit -m "feat: importação e limpeza de scan 3D (STL/OBJ/PLY)"
```

---

### Tarefa 11: Validação de malha

**Arquivos:**
- Criar: `python/services/validator.py`
- Criar: `tests/python/test_validator.py`
- Modificar: `python/routers/model.py`

- [ ] **Passo 1: Escrever testes**

Criar `tests/python/test_validator.py`:

```python
import trimesh
import numpy as np
from python.services.validator import validate_mesh

def _helmet_mesh():
    from python.services.model_generator import generate_from_measurements
    return generate_from_measurements({
        "circ_occipital": 380, "circ_frontal": 370,
        "diag_a": 135, "diag_b": 118, "cvai": 8.4,
        "height": 72, "offset_mm": 4, "wall_mm": 3,
    })

def test_valid_mesh_passes():
    mesh = _helmet_mesh()
    result = validate_mesh(mesh, min_thickness_mm=2.0, min_clearance_mm=3.0)
    assert result["is_valid"] is True
    assert len(result["errors"]) == 0

def test_result_contains_required_keys():
    mesh = _helmet_mesh()
    result = validate_mesh(mesh)
    for key in ["is_valid", "errors", "warnings", "volume_cm3", "weight_g"]:
        assert key in result

def test_non_manifold_fails():
    mesh = trimesh.Trimesh(
        vertices=[[0,0,0],[1,0,0],[0,1,0]],
        faces=[[0,1,2]]
    )
    result = validate_mesh(mesh)
    assert result["is_valid"] is False
    assert any("manifold" in e.lower() for e in result["errors"])
```

- [ ] **Passo 2: Rodar para confirmar falha**

```bash
python -m pytest tests/python/test_validator.py -v
```
Esperado: FAIL

- [ ] **Passo 3: Criar `python/services/validator.py`**

```python
import trimesh
import numpy as np
from typing import Any

DENSITY_G_PER_CM3 = 1.24  # PLA/PETG típico

def validate_mesh(
    mesh: trimesh.Trimesh,
    min_thickness_mm: float = 2.0,
    min_clearance_mm: float = 3.0,
) -> dict[str, Any]:
    errors = []
    warnings = []

    # 1. Manifold
    if not mesh.is_watertight:
        errors.append("Malha não é manifold — contém buracos ou faces invertidas.")

    # 2. Volume e peso
    volume_cm3 = abs(mesh.volume) / 1000 if mesh.is_watertight else 0
    weight_g = round(volume_cm3 * DENSITY_G_PER_CM3, 1)

    # 3. Espessura mínima (amostragem de pontos da superfície)
    if mesh.is_watertight and len(mesh.vertices) > 0:
        sample_pts, _ = trimesh.sample.sample_surface(mesh, count=500)
        prox = trimesh.proximity.ProximityQuery(mesh)
        _, dists, _ = prox.on_surface(sample_pts)
        min_found = float(np.min(dists)) * 2  # distância à superfície → espessura estimada
        if min_found < min_thickness_mm:
            errors.append(
                f"Espessura mínima {min_found:.1f}mm abaixo do limite {min_thickness_mm}mm."
            )

    is_valid = len(errors) == 0

    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "volume_cm3": round(volume_cm3, 2),
        "weight_g": weight_g,
    }
```

- [ ] **Passo 4: Rodar testes**

```bash
python -m pytest tests/python/test_validator.py -v
```
Esperado: todos PASS

- [ ] **Passo 5: Implementar endpoint `/model/validate` em `python/routers/model.py`**

```python
# Substituir o stub de validate:
@router.post("/validate")
def validate_model(data: dict):
    stl_b64 = data.get("stl_b64")
    if not stl_b64:
        raise HTTPException(status_code=400, detail="stl_b64 obrigatório")
    raw = base64.b64decode(stl_b64)
    mesh = trimesh.load(io.BytesIO(raw), file_type='stl')
    from python.services.validator import validate_mesh
    return validate_mesh(
        mesh,
        min_thickness_mm=data.get("min_thickness_mm", 2.0),
        min_clearance_mm=data.get("min_clearance_mm", 3.0),
    )
```

- [ ] **Passo 6: Commit**

```bash
git add python/services/validator.py tests/python/test_validator.py python/routers/model.py
git commit -m "feat: validação de malha (manifold, espessura, volume, peso)"
```

---

## Fase 5 — Editor 3D (Three.js)

### Tarefa 12: Visualizador Three.js no Electron

**Arquivos:**
- Criar: `src/components/ThreeViewer.jsx`
- Criar: `src/pages/EditorPage.jsx`

- [ ] **Passo 1: Instalar Three.js**

```bash
npm install three
```

- [ ] **Passo 2: Criar `src/components/ThreeViewer.jsx`**

```jsx
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'

export const ThreeViewer = forwardRef(function ThreeViewer({ style }, ref) {
  const mountRef = useRef(null)
  const stateRef = useRef({})

  useImperativeHandle(ref, () => ({
    loadStlBase64(stlB64) {
      const { scene, mesh: oldMesh } = stateRef.current
      if (oldMesh) scene.remove(oldMesh)

      const raw = atob(stlB64)
      const buf = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)

      const loader = new STLLoader()
      const geometry = loader.parse(buf.buffer)
      geometry.computeVertexNormals()

      const material = new THREE.MeshStandardMaterial({
        color: 0x88ccff, roughness: 0.4, metalness: 0.1,
        vertexColors: true,
      })

      // Inicializar cores dos vértices como neutro (branco)
      const count = geometry.attributes.position.count
      const colors = new Float32Array(count * 3).fill(1)
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

      const mesh = new THREE.Mesh(geometry, material)
      mesh.geometry.center()
      scene.add(mesh)
      stateRef.current.mesh = mesh
    },

    paintZone(zoneType) {
      stateRef.current.activePaintZone = zoneType
    },
  }))

  useEffect(() => {
    const mount = mountRef.current
    const w = mount.clientWidth, h = mount.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(window.devicePixelRatio)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
    camera.position.set(0, 0, 200)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(50, 100, 75)
    scene.add(ambient, dirLight)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    stateRef.current = { scene, camera, renderer, controls }

    let animId
    function animate() {
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    function onResize() {
      const w2 = mount.clientWidth, h2 = mount.clientHeight
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
      renderer.setSize(w2, h2)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%', ...style }} />
})
```

- [ ] **Passo 3: Criar `src/pages/EditorPage.jsx`**

```jsx
import { useRef, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ThreeViewer } from '../components/ThreeViewer'
import { useCase } from '../hooks/useCase'
import { pythonApi } from '../services/pythonApi'

export default function EditorPage() {
  const { caseId } = useParams()
  const { caseData } = useCase(caseId)
  const viewerRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [modelMeta, setModelMeta] = useState(null)

  async function generateModel() {
    if (!caseData) return
    setGenerating(true)
    try {
      const result = await pythonApi.generateModel({
        circ_occipital: Number(caseData.measurements?.circOccipital),
        circ_frontal: Number(caseData.measurements?.circFrontal),
        diag_a: Number(caseData.measurements?.diagA),
        diag_b: Number(caseData.measurements?.diagB),
        cvai: Number(caseData.measurements?.cvai),
        height: Number(caseData.measurements?.height),
        offset_mm: 4,
        wall_mm: 3,
      })
      viewerRef.current?.loadStlBase64(result.stl_b64)
      setModelMeta(result)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', height: '100vh' }}>
      <ThreeViewer ref={viewerRef} />

      <div style={{ padding: 16, borderLeft: '1px solid #333', overflowY: 'auto' }}>
        <h3>Editor 3D</h3>

        <button onClick={generateModel} disabled={generating}>
          {generating ? 'Gerando...' : 'Gerar Modelo'}
        </button>

        {modelMeta && (
          <div style={{ marginTop: 16, fontSize: 13 }}>
            <p>Vértices: {modelMeta.vertex_count}</p>
            <p>Volume: {modelMeta.volume_cm3} cm³</p>
            <p>Manifold: {modelMeta.is_watertight ? '✅' : '❌'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Passo 4: Adicionar rota em `App.jsx`**

```jsx
import EditorPage from './pages/EditorPage'
<Route path="/editor/:caseId" element={<AuthGuard><EditorPage /></AuthGuard>} />
```

- [ ] **Passo 5: Testar visualização**

```bash
npm run dev
```
Navegar para `/editor/<caseId>` (criar um caso antes), clicar "Gerar Modelo". Esperado: capacete 3D aparece no canvas.

- [ ] **Passo 6: Commit**

```bash
git add src/components/ThreeViewer.jsx src/pages/EditorPage.jsx src/App.jsx
git commit -m "feat: visualizador Three.js com geração de modelo paramétrico"
```

---

### Tarefa 13: Pintura de zonas e histórico undo/redo

**Arquivos:**
- Criar: `src/components/ZonePainter.jsx`
- Criar: `src/hooks/useModelHistory.js`
- Modificar: `src/pages/EditorPage.jsx`

- [ ] **Passo 1: Criar `src/hooks/useModelHistory.js`**

```js
import { useReducer, useCallback } from 'react'

const MAX_HISTORY = 50

function historyReducer(state, action) {
  switch (action.type) {
    case 'PUSH': {
      const past = [...state.past, state.present].slice(-MAX_HISTORY)
      return { past, present: action.snapshot, future: [] }
    }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const past = state.past.slice(0, -1)
      const present = state.past[state.past.length - 1]
      return { past, present, future: [state.present, ...state.future] }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const [present, ...future] = state.future
      return { past: [...state.past, state.present], present, future }
    }
    default: return state
  }
}

export function useModelHistory(initial = null) {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [], present: initial, future: [],
  })

  const push = useCallback(snapshot => dispatch({ type: 'PUSH', snapshot }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  return {
    current: state.present,
    push,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
```

- [ ] **Passo 2: Criar `src/components/ZonePainter.jsx`**

```jsx
const ZONES = [
  { id: 'relief', label: 'Alívio', color: '#63b3ed', description: 'Sem pressão' },
  { id: 'pressure', label: 'Pressão', color: '#fc8181', description: 'Contato controlado' },
  { id: 'neutral', label: 'Neutro', color: '#a0aec0', description: 'Normal' },
]

export function ZonePainter({ activeZone, onZoneChange, thickness, onThicknessChange }) {
  return (
    <div>
      <h4>Zonas</h4>
      {ZONES.map(zone => (
        <button
          key={zone.id}
          onClick={() => onZoneChange(zone.id)}
          style={{
            display: 'block', width: '100%', marginBottom: 8,
            padding: '8px 12px', textAlign: 'left', borderRadius: 8,
            background: activeZone === zone.id ? zone.color + '33' : 'transparent',
            border: `2px solid ${activeZone === zone.id ? zone.color : '#333'}`,
            color: zone.color, cursor: 'pointer',
          }}
        >
          <strong>{zone.label}</strong>
          <span style={{ display: 'block', fontSize: 11, opacity: 0.7 }}>{zone.description}</span>
        </button>
      ))}

      <h4 style={{ marginTop: 16 }}>Espessura da parede</h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range" min="2" max="6" step="0.5"
          value={thickness}
          onChange={e => onThicknessChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span>{thickness}mm</span>
      </div>
    </div>
  )
}
```

- [ ] **Passo 3: Integrar em `EditorPage.jsx`**

Substituir o conteúdo da sidebar:
```jsx
import { ZonePainter } from '../components/ZonePainter'
import { useModelHistory } from '../hooks/useModelHistory'

// Dentro do componente EditorPage:
const { current: stlB64, push, undo, redo, canUndo, canRedo } = useModelHistory(null)
const [activeZone, setActiveZone] = useState('neutral')
const [thickness, setThickness] = useState(3)

// Adicionar na sidebar, após os metadados do modelo:
<ZonePainter
  activeZone={activeZone}
  onZoneChange={zone => { setActiveZone(zone); viewerRef.current?.paintZone(zone) }}
  thickness={thickness}
  onThicknessChange={setThickness}
/>

<div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
  <button onClick={undo} disabled={!canUndo}>↩ Desfazer</button>
  <button onClick={redo} disabled={!canRedo}>↪ Refazer</button>
</div>
```

- [ ] **Passo 4: Testar**

```bash
npm run dev
```
1. Gerar modelo → aparece 3D
2. Clicar zonas no painel → botões ficam destacados
3. Clicar Desfazer/Refazer → botões habilitam conforme histórico

- [ ] **Passo 5: Commit**

```bash
git add src/components/ZonePainter.jsx src/hooks/useModelHistory.js src/pages/EditorPage.jsx
git commit -m "feat: pintura de zonas e histórico undo/redo"
```

---

## Fase 6 — Exportação e Relatório

### Tarefa 14: Exportação STL e G-code

**Arquivos:**
- Criar: `python/services/exporter.py`
- Criar: `tests/python/test_exporter.py`
- Modificar: `python/routers/export.py`

- [ ] **Passo 1: Escrever testes**

Criar `tests/python/test_exporter.py`:

```python
import trimesh
import tempfile, os
from python.services.exporter import export_stl, export_gcode

def _mesh():
    from python.services.model_generator import generate_from_measurements
    return generate_from_measurements({
        "circ_occipital": 380, "circ_frontal": 370,
        "diag_a": 135, "diag_b": 118, "cvai": 8.4,
        "height": 72, "offset_mm": 4, "wall_mm": 3,
    })

def test_export_stl_returns_bytes():
    mesh = _mesh()
    data = export_stl(mesh)
    assert isinstance(data, bytes)
    assert len(data) > 0
    assert data[:5] == b'solid' or data[:4] == b'\x00\x00\x00\x00' or len(data) > 80

def test_export_gcode_returns_string():
    mesh = _mesh()
    gcode = export_gcode(mesh, layer_height_mm=0.2, feedrate=1500)
    assert isinstance(gcode, str)
    assert 'G1' in gcode or 'G0' in gcode

def test_export_gcode_has_header():
    mesh = _mesh()
    gcode = export_gcode(mesh, layer_height_mm=0.2, feedrate=1500)
    assert gcode.startswith(';')
```

- [ ] **Passo 2: Rodar para confirmar falha**

```bash
python -m pytest tests/python/test_exporter.py -v
```
Esperado: FAIL

- [ ] **Passo 3: Criar `python/services/exporter.py`**

```python
import trimesh
import numpy as np
import io

def export_stl(mesh: trimesh.Trimesh) -> bytes:
    buf = io.BytesIO()
    mesh.export(buf, file_type='stl')
    return buf.getvalue()

def export_gcode(
    mesh: trimesh.Trimesh,
    layer_height_mm: float = 0.2,
    feedrate: int = 1500,
) -> str:
    """
    Gera G-code simplificado para fresagem CNC (contornos por camada).
    Para impressão 3D completa, usar slicer externo (PrusaSlicer CLI).
    """
    bounds = mesh.bounds
    z_min, z_max = bounds[0][2], bounds[1][2]
    layers = np.arange(z_min, z_max, layer_height_mm)

    lines = [
        f'; OrteseCAD G-code export',
        f'; Layer height: {layer_height_mm}mm',
        f'; Total layers: {len(layers)}',
        'G21 ; mm',
        'G90 ; absolute',
        'G28 ; home',
        f'F{feedrate}',
    ]

    for i, z in enumerate(layers):
        lines.append(f'; Layer {i+1} — Z={z:.2f}mm')
        lines.append(f'G0 Z{z:.2f}')
        # Seção transversal na altura z
        section = mesh.section(plane_origin=[0, 0, z], plane_normal=[0, 0, 1])
        if section is None:
            continue
        path2d, _ = section.to_planar()
        for entity in path2d.entities:
            pts = path2d.vertices[entity.points]
            for j, pt in enumerate(pts):
                cmd = 'G0' if j == 0 else 'G1'
                lines.append(f'{cmd} X{pt[0]:.3f} Y{pt[1]:.3f}')

    lines.append('G0 Z50 ; lift')
    lines.append('M2 ; end')
    return '\n'.join(lines)
```

- [ ] **Passo 4: Rodar testes**

```bash
python -m pytest tests/python/test_exporter.py -v
```
Esperado: todos PASS

- [ ] **Passo 5: Implementar endpoints em `python/routers/export.py`**

```python
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from python.services.exporter import export_stl, export_gcode
import trimesh, base64, io

router = APIRouter(prefix="/export", tags=["export"])

def _mesh_from_b64(stl_b64: str) -> trimesh.Trimesh:
    raw = base64.b64decode(stl_b64)
    return trimesh.load(io.BytesIO(raw), file_type='stl')

@router.post("/stl")
def export_stl_endpoint(data: dict):
    if "stl_b64" not in data:
        raise HTTPException(400, "stl_b64 obrigatório")
    mesh = _mesh_from_b64(data["stl_b64"])
    stl_bytes = export_stl(mesh)
    return Response(content=stl_bytes, media_type="application/octet-stream",
                    headers={"Content-Disposition": "attachment; filename=ortese.stl"})

@router.post("/gcode")
def export_gcode_endpoint(data: dict):
    if "stl_b64" not in data:
        raise HTTPException(400, "stl_b64 obrigatório")
    mesh = _mesh_from_b64(data["stl_b64"])
    gcode = export_gcode(
        mesh,
        layer_height_mm=data.get("layer_height_mm", 0.2),
        feedrate=data.get("feedrate", 1500),
    )
    return Response(content=gcode, media_type="text/plain",
                    headers={"Content-Disposition": "attachment; filename=ortese.gcode"})

@router.post("/pdf")
def export_pdf_endpoint(data: dict):
    return {"message": "implementado na Tarefa 15"}
```

- [ ] **Passo 6: Commit**

```bash
git add python/services/exporter.py tests/python/test_exporter.py python/routers/export.py
git commit -m "feat: exportação STL e G-code CNC"
```

---

### Tarefa 15: Geração de relatório PDF

**Arquivos:**
- Criar: `python/services/pdf_generator.py`
- Criar: `tests/python/test_pdf_generator.py`
- Modificar: `python/routers/export.py`

- [ ] **Passo 1: Escrever testes**

Criar `tests/python/test_pdf_generator.py`:

```python
from python.services.pdf_generator import generate_clinical_pdf, generate_technical_pdf

PATIENT = {
    "name": "João Pedro S.", "birthDate": "2025-08-01",
    "guardian": "Maria S.", "diagnosis": "Plagiocefalia posicional",
}
MEASUREMENTS = {
    "circOccipital": 380, "circFrontal": 370,
    "diagA": 135, "diagB": 118, "cvai": 8.4, "height": 72,
}
MODEL_META = {"volume_cm3": 142, "weight_g": 176, "vertex_count": 1200}

def test_clinical_pdf_returns_bytes():
    pdf = generate_clinical_pdf(PATIENT, MEASUREMENTS, MODEL_META)
    assert isinstance(pdf, bytes)
    assert pdf[:4] == b'%PDF'

def test_technical_pdf_returns_bytes():
    pdf = generate_technical_pdf(PATIENT, MEASUREMENTS, MODEL_META)
    assert isinstance(pdf, bytes)
    assert pdf[:4] == b'%PDF'

def test_clinical_pdf_has_content():
    pdf = generate_clinical_pdf(PATIENT, MEASUREMENTS, MODEL_META)
    assert len(pdf) > 1000
```

- [ ] **Passo 2: Rodar para confirmar falha**

```bash
python -m pytest tests/python/test_pdf_generator.py -v
```
Esperado: FAIL

- [ ] **Passo 3: Criar `python/services/pdf_generator.py`**

```python
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
import io

def _base_doc(buf):
    return SimpleDocTemplate(buf, pagesize=A4,
                              leftMargin=20*mm, rightMargin=20*mm,
                              topMargin=20*mm, bottomMargin=20*mm)

def generate_clinical_pdf(patient: dict, measurements: dict, model_meta: dict) -> bytes:
    buf = io.BytesIO()
    doc = _base_doc(buf)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('Title', parent=styles['Heading1'],
                                  fontSize=16, spaceAfter=6)
    body = [
        Paragraph("OrteseCAD — Relatório Clínico", title_style),
        Spacer(1, 4*mm),
        Paragraph(f"<b>Paciente:</b> {patient['name']}", styles['Normal']),
        Paragraph(f"<b>Nascimento:</b> {patient['birthDate']}", styles['Normal']),
        Paragraph(f"<b>Responsável:</b> {patient['guardian']}", styles['Normal']),
        Paragraph(f"<b>Diagnóstico:</b> {patient['diagnosis']}", styles['Normal']),
        Spacer(1, 6*mm),
        Paragraph("Medidas Cranianas", styles['Heading2']),
    ]

    meas_data = [
        ['Medida', 'Valor'],
        ['Circ. Occipital', f"{measurements.get('circOccipital', '—')} mm"],
        ['Circ. Frontal', f"{measurements.get('circFrontal', '—')} mm"],
        ['Diagonal A (maior)', f"{measurements.get('diagA', '—')} mm"],
        ['Diagonal B (menor)', f"{measurements.get('diagB', '—')} mm"],
        ['CVAI', f"{measurements.get('cvai', '—')} %"],
        ['Altura Craniana', f"{measurements.get('height', '—')} mm"],
    ]
    t = Table(meas_data, colWidths=[80*mm, 60*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d3748')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
    ]))
    body.append(t)
    body.append(Spacer(1, 6*mm))
    body.append(Paragraph("Dados do Modelo", styles['Heading2']))
    body.append(Paragraph(f"Volume estimado: {model_meta.get('volume_cm3', '—')} cm³", styles['Normal']))
    body.append(Paragraph(f"Peso estimado: {model_meta.get('weight_g', '—')} g", styles['Normal']))

    doc.build(body)
    return buf.getvalue()

def generate_technical_pdf(patient: dict, measurements: dict, model_meta: dict) -> bytes:
    buf = io.BytesIO()
    doc = _base_doc(buf)
    styles = getSampleStyleSheet()

    body = [
        Paragraph("OrteseCAD — Especificações Técnicas de Fabricação",
                   ParagraphStyle('T', parent=styles['Heading1'], fontSize=14)),
        Spacer(1, 4*mm),
        Paragraph(f"Paciente: {patient['name']}", styles['Normal']),
        Spacer(1, 4*mm),
        Paragraph("Parâmetros de Fabricação", styles['Heading2']),
        Paragraph(f"Vértices da malha: {model_meta.get('vertex_count', '—')}", styles['Normal']),
        Paragraph(f"Volume: {model_meta.get('volume_cm3', '—')} cm³", styles['Normal']),
        Paragraph(f"Peso estimado (PLA): {model_meta.get('weight_g', '—')} g", styles['Normal']),
        Spacer(1, 4*mm),
        Paragraph("Recomendações de Impressão 3D", styles['Heading2']),
        Paragraph("Material: PLA / PETG — espessura de parede mínima 2mm.", styles['Normal']),
        Paragraph("Layer height recomendado: 0.2mm.", styles['Normal']),
        Paragraph("Infill: 20% gyroid.", styles['Normal']),
    ]

    doc.build(body)
    return buf.getvalue()
```

- [ ] **Passo 4: Rodar testes**

```bash
python -m pytest tests/python/test_pdf_generator.py -v
```
Esperado: todos PASS

- [ ] **Passo 5: Implementar endpoint `/export/pdf` em `python/routers/export.py`**

```python
from python.services.pdf_generator import generate_clinical_pdf, generate_technical_pdf

@router.post("/pdf")
def export_pdf_endpoint(data: dict):
    pdf_type = data.get("type", "clinical")  # "clinical" | "technical"
    patient = data.get("patient", {})
    measurements = data.get("measurements", {})
    model_meta = data.get("model_meta", {})

    if pdf_type == "clinical":
        pdf_bytes = generate_clinical_pdf(patient, measurements, model_meta)
    else:
        pdf_bytes = generate_technical_pdf(patient, measurements, model_meta)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=ortese_{pdf_type}.pdf"},
    )
```

- [ ] **Passo 6: Commit**

```bash
git add python/services/pdf_generator.py tests/python/test_pdf_generator.py python/routers/export.py
git commit -m "feat: geração de relatórios PDF clínico e técnico"
```

---

### Tarefa 16: Tela de Validação e Exportação (front)

**Arquivos:**
- Criar: `src/components/ValidationChecklist.jsx`
- Criar: `src/pages/ValidationPage.jsx`

- [ ] **Passo 1: Criar `src/components/ValidationChecklist.jsx`**

```jsx
export function ValidationChecklist({ result }) {
  if (!result) return <p>Nenhuma validação executada ainda.</p>

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        {result.is_valid
          ? <span style={{ color: '#48c78e', fontSize: 18 }}>✅ Modelo válido</span>
          : <span style={{ color: '#fc8181', fontSize: 18 }}>❌ Modelo com erros</span>
        }
      </div>

      {result.errors.length > 0 && (
        <ul style={{ color: '#fc8181' }}>
          {result.errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
      {result.warnings.length > 0 && (
        <ul style={{ color: '#ffa032' }}>
          {result.warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
        </ul>
      )}

      <p>Volume: {result.volume_cm3} cm³</p>
      <p>Peso estimado: {result.weight_g} g</p>
    </div>
  )
}
```

- [ ] **Passo 2: Criar `src/pages/ValidationPage.jsx`**

```jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCase } from '../hooks/useCase'
import { pythonApi } from '../services/pythonApi'
import { ValidationChecklist } from '../components/ValidationChecklist'

export default function ValidationPage() {
  const { caseId } = useParams()
  const { caseData } = useCase(caseId)
  const navigate = useNavigate()
  const [validating, setValidating] = useState(false)
  const [exporting, setExporting] = useState(null)
  const [result, setResult] = useState(null)

  const stlB64 = caseData?.modelStlB64

  async function validate() {
    if (!stlB64) return alert('Gere o modelo primeiro no Editor.')
    setValidating(true)
    try {
      const res = await pythonApi.validateModel({ stl_b64: stlB64 })
      setResult(res)
    } finally {
      setValidating(false)
    }
  }

  async function download(type) {
    if (!stlB64) return
    setExporting(type)
    try {
      const res = await fetch(`http://localhost:8765/export/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stl_b64: stlB64 }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'stl' ? 'ortese.stl' : type === 'gcode' ? 'ortese.gcode' : `ortese_${type}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(null)
    }
  }

  async function downloadPdf(pdfType, patient, measurements, modelMeta) {
    setExporting(pdfType)
    try {
      const res = await fetch('http://localhost:8765/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: pdfType, patient, measurements, model_meta: modelMeta }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ortese_${pdfType}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24 }}>
      <h2>Validação e Exportação</h2>

      <button onClick={validate} disabled={validating}>
        {validating ? 'Validando...' : 'Executar Validação'}
      </button>

      <div style={{ marginTop: 24 }}>
        <ValidationChecklist result={result} />
      </div>

      {result?.is_valid && (
        <div style={{ marginTop: 32 }}>
          <h3>Exportar</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => download('stl')} disabled={exporting === 'stl'}>
              {exporting === 'stl' ? 'Exportando...' : '📦 STL (Impressão 3D)'}
            </button>
            <button onClick={() => download('gcode')} disabled={exporting === 'gcode'}>
              {exporting === 'gcode' ? 'Exportando...' : '⚙️ G-code (CNC)'}
            </button>
            <button onClick={() => downloadPdf('clinical', {}, {}, result)}
              disabled={exporting === 'clinical'}>
              {exporting === 'clinical' ? 'Gerando...' : '📄 PDF Clínico'}
            </button>
            <button onClick={() => downloadPdf('technical', {}, {}, result)}
              disabled={exporting === 'technical'}>
              {exporting === 'technical' ? 'Gerando...' : '📋 PDF Técnico'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 3: Adicionar rota em `App.jsx`**

```jsx
import ValidationPage from './pages/ValidationPage'
<Route path="/validation/:caseId" element={<AuthGuard><ValidationPage /></AuthGuard>} />
```

- [ ] **Passo 4: Testar o fluxo completo de exportação**

```bash
npm run dev
```
1. Criar paciente → criar caso → abrir editor → gerar modelo
2. Navegar para `/validation/<caseId>`
3. Clicar "Executar Validação" → checklist aparece
4. Clicar "STL" → arquivo baixa

- [ ] **Passo 5: Commit**

```bash
git add src/components/ValidationChecklist.jsx src/pages/ValidationPage.jsx src/App.jsx
git commit -m "feat: tela de validação e exportação (STL, G-code, PDF)"
```

---

## Fase 7 — Notificações e Polimento

### Tarefa 17: Notificações Firebase entre médico e ortesista

**Arquivos:**
- Criar: `src/services/notificationService.js`
- Modificar: `src/pages/DashboardPage.jsx`

- [ ] **Passo 1: Criar `src/services/notificationService.js`**

```js
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
```

- [ ] **Passo 2: Adicionar badge de notificações ao Dashboard**

Em `DashboardPage.jsx`, adicionar:
```jsx
import { useEffect, useState } from 'react'
import { notificationService } from '../services/notificationService'

// Dentro do componente, após os outros estados:
const [notifications, setNotifications] = useState([])

useEffect(() => {
  if (!user) return
  return notificationService.subscribe(user.uid, setNotifications)
}, [user])

// No JSX do header:
{notifications.length > 0 && (
  <span style={{ background: 'red', color: 'white', borderRadius: '50%',
                 padding: '2px 7px', fontSize: 12, marginLeft: 8 }}>
    {notifications.length}
  </span>
)}
```

- [ ] **Passo 3: Disparar notificação ao enviar caso para ortesista**

Em `CasePage.jsx`, na função `assign`, após `caseService.assign(...)`:
```js
import { notificationService } from '../services/notificationService'

// Após caseService.assign(caseId, orthotistUid):
await notificationService.send(
  orthotistUid,
  'Novo caso recebido',
  `Caso de ${patient?.name} enviado para revisão.`,
  caseId,
)
```

- [ ] **Passo 4: Testar**

```bash
npm run dev
```
1. Logar como médico → enviar caso para e-mail de ortesista
2. Abrir outra janela/perfil como ortesista → badge vermelho aparece no dashboard

- [ ] **Passo 5: Commit**

```bash
git add src/services/notificationService.js src/pages/DashboardPage.jsx src/pages/CasePage.jsx
git commit -m "feat: notificações Firebase entre médico e ortesista"
```

---

### Tarefa 18: Testes finais e rodada completa de pytest

- [ ] **Passo 1: Rodar todos os testes Python**

```bash
python -m pytest tests/python/ -v
```
Esperado: todos PASS

- [ ] **Passo 2: Verificar cobertura mínima**

```bash
pip install pytest-cov
python -m pytest tests/python/ --cov=python/services --cov-report=term-missing
```
Esperado: cobertura > 70% em todos os services.

- [ ] **Passo 3: Testar fluxo E2E manualmente**

Executar o roteiro completo:
1. Registrar médico e ortesista
2. Médico: criar paciente com medidas
3. Médico: abrir editor → gerar modelo
4. Médico: enviar caso para ortesista
5. Ortesista: receber notificação → abrir caso → editar → validar
6. Ortesista: exportar STL e PDF
7. Médico: aprovar modelo no caso

- [ ] **Passo 4: Commit final**

```bash
git add .
git commit -m "test: suite completa de testes Python — todos passando"
```

---

## Revisão do Spec vs. Plano

| Requisito do Spec | Tarefa |
|-------------------|--------|
| Electron + React + Three.js | T1, T12 |
| Python FastAPI local :8765 | T2, T3 |
| Firebase Auth + Firestore + Storage | T4, T5 |
| Cadastro de paciente + medidas | T6 |
| Gestão de casos + colaboração | T7, T8 |
| Geração paramétrica de malha | T9 |
| Importação de scan 3D | T10 |
| Validação de malha | T11 |
| Editor Three.js + zonas | T12, T13 |
| Undo/redo 50 passos | T13 |
| Exportação STL | T14 |
| Exportação G-code | T14 |
| Relatório PDF clínico | T15 |
| Relatório PDF técnico | T15 |
| Tela de validação front | T16 |
| Notificações entre usuários | T17 |
