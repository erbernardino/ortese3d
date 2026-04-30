# OrteseCAD — Estado Atual

**Última atualização:** 2026-04-30

Aplicativo desktop Electron + React + Python para design paramétrico de
órteses cranianas (plagiocefalia posicional). Médicos cadastram e
medem; ortesistas modelam, validam e exportam para fabricação.

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Desktop | Electron 41 |
| Frontend | React 19 + Vite 8 |
| 3D Viewer + Sculpt | Three.js (STLLoader, OrbitControls, Raycaster, STLExporter) |
| Backend local | Python 3.13 + FastAPI 0.110 |
| Mesh 3D | trimesh 4.3 + manifold3d (boolean) + rtree (proximity) |
| Cloud | Firebase (Auth + Firestore + Storage + Functions) |
| Cache offline | electron-store 8.2 |
| Reports | ReportLab 4.5 |
| Testes | pytest (30/30) + vitest+@firebase/rules-unit-testing (17/17) |

---

## Funcionalidades

### Auth e colaboração
- **LoginPage** com 3 modos: login / criar conta / recuperar senha
  (sendPasswordResetEmail).
- **Roles**: `doctor` (médico) ou `orthotist` (ortesista).
- **Cloud Function `resolveUidByEmail`** (Gen2, us-central1) resolve
  email → UID via Admin SDK; usado em CasePage para atribuir caso.
- **Notificações** Firestore real-time entre médico ↔ ortesista.

### Pacientes e casos
- Cadastro com 6 medidas cranianas (occipital, frontal, diagA, diagB,
  CVAI, altura) e dados demográficos.
- Casos denormalizam `patientName`/`patientDiagnosis`/`patientBirthDate`
  no doc — ortesistas leem dados do paciente sem getDoc em `patients/`.
- Status: draft → sent → in_progress → review → approved → exported.

### Editor 3D
- **Geração paramétrica**: casca single-manifold via boolean
  (manifold3d) — outer minus inner ellipsoid.
- **Furos de ventilação**: 12 cilindros distribuídos por Fibonacci
  sphere (cobre só hemisfério superior).
- **Abertura frontal removível**: boolean cut da seção testa+inferior.
- **Importação de scan 3D** (STL/OBJ/PLY): `scan_processor` faz
  largest-component + fill_holes + Laplacian smoothing.
- **Scan → capacete**: `generate_from_scan` desloca vértices ao longo
  da normal por (offset+wall) e offset; boolean shell preserva a
  geometria do scan e adiciona ventilação + abertura.
- **Sculpt push/pull**: brush 3D no ThreeViewer com falloff quadrático
  (raio 3-25mm, força 0.1-2.0). Vértices indexados por
  mergeVerticesByPosition para deformação coerente.
- **IA-MVP de zonas de pressão**: heurística (não ML treinado) baseada
  em CVAI + diagnóstico textual. Classifica severidade
  (mild/moderate/severe/very_severe), detecta lado afetado, retorna
  4 zonas com posições normalizadas, raios, intensidades e
  justificativas clínicas.
- **Histórico undo/redo** (50 passos) integrado com sculpt e import.

### Validação e exportação
- **Validação**: manifold check + ray casting de espessura (rtree)
  com **percentil 5** para robustez contra borda de furos.
- **Volume e peso** real do material da casca (não do crânio inteiro).
- **Exportação**: STL binário, G-code CNC (380 camadas, 0.2mm),
  PDF clínico e PDF técnico (ReportLab 4.5, compat Python 3.14).

### Persistência e offline
- **Firebase Storage** para STL: rules cross-service via
  `firestore.get()` autoriza leitura/escrita só por createdBy ou
  assignedTo do caso. Requer `roles/datastore.viewer` no
  Firebase Storage Service Agent.
- **CORS** do bucket aberto a `*` (modo desenvolvimento). Endurecer
  para domínios específicos quando empacotar para piloto público.
- **Cache offline (electron-store)**: read-through/write-through em
  `caseService`. Operações offline geram tempIds e entram em fila
  `pendingOps`.
- **Sync automático**: ouve evento `online` e replay sequencial via
  `caseService._replayOp`. Banner amarelo (offline) ou azul
  (pending) no Dashboard.

---

## Segurança

### `firestore.rules`
- `users/{uid}` — leitura/escrita só pelo próprio.
- `patients/` — somente createdBy lê (LGPD-strict; ortesistas usam
  campos denormalizados no caso).
- `cases/` — leitura/escrita por createdBy ou assignedTo.
- `notifications/` — leitura/update só pelo destinatário; create
  exige caseId existente e auth pertencer ao caso (validado via
  `get(/cases/$(caseId))`).
- 17 testes vitest contra emulator cobrem todos os casos.

### `storage.rules`
- `cases/{caseId}/*` cross-service: lê doc Firestore do caso e
  autoriza só createdBy / assignedTo.
- IAM: `roles/datastore.viewer` concedido ao Firebase Storage SA.

### Cloud Function `resolveUidByEmail`
- Exige `req.auth`, valida formato de email, retorna NotFound
  amigável se não existir.

---

## Limitações conhecidas e pós-v1

- **Region nam5 (US)**: o database Firestore está em `nam5`
  (multi-region US). Para o piloto atual (estudo com consentimento
  formal dos participantes) isso é aceitável; em uso clínico amplo
  reavaliar a região.
- **Espessura próximo a furos**: ray casting usa percentil 5 para
  evitar falso positivo nas bordas dos cilindros de ventilação. Se
  malhas muito complexas exibirem ainda artefatos, usar voxelization
  + libigl seria mais robusto (não escopado).
- **CORS Storage** aberto a `*` (modo dev/estudo); endurecer
  quando for ao piloto público.
- **IA é heurística** (não ML treinado). Para evolução: dataset de
  scans pré e pós-tratamento + segmentação CNN para sugestões mais
  específicas por geometria local.
- **Replay de tempIds em ops dependentes**: se um update offline
  referencia um case ainda com tempId que vira id real ao reconectar,
  o replay marca a op como falha. Fix futuro: mapear tempId→realId
  e retraduzir ops pendentes antes do replay.
- **Conta de teste** `teste-debug@allogic.com.br` ainda no Auth
  (criada para diagnóstico inicial; pode ser deletada).
- **Deploy production**: pendente — falta config de production Firebase,
  build do Electron empacotado, certificados Apple/Windows.

---

## Comandos úteis

```bash
# Dev (Electron + Vite + Python)
npm run dev

# Apenas Vite (browser)
npm run dev:renderer

# Python standalone
.venv/bin/python -m uvicorn python.main:app --host 127.0.0.1 --port 8765

# Tests
.venv/bin/python -m pytest tests/python/ -q              # 30 Python
firebase emulators:exec --only firestore --project demo-ortese3d \
  "npx vitest run tests/rules.test.mjs"                  # 17 rules

# Deploy Firebase
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
firebase deploy --only functions

# Build distribuíveis
npm run build
```

Veja `docs/DEPLOY.md` para o setup completo de um novo projeto.
