# Guia de Deploy — OrteseCAD

Setup para subir um novo ambiente Firebase + rodar o app.

---

## 1. Pré-requisitos

```bash
node --version   # >= 22
python3.13 --version
which gcloud firebase
brew install poppler  # opcional, para Read PDFs
```

---

## 2. Criar projeto Firebase

```bash
firebase login
firebase projects:create criaortese3d-prod   # ou nome do seu projeto
```

No Firebase Console (https://console.firebase.google.com):
1. **Authentication** → habilitar provider **Email/Senha**.
2. **Firestore** → criar database. Em piloto/estudo com
   consentimento, qualquer região serve (no projeto atual está
   em `nam5`). Para uso clínico amplo no Brasil, considerar
   `southamerica-east1`.
3. **Storage** → criar bucket.

Atualize `.firebaserc` e `firebase.json` (campo `firestore.location`)
com o ID do projeto e a região.

---

## 3. Variáveis de ambiente

Capture o web SDK config:

```bash
firebase apps:sdkconfig WEB --project <PROJECT_ID>
```

Crie `.env.local` na raiz:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project>
VITE_FIREBASE_STORAGE_BUCKET=<project>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Sem as variáveis, `src/firebase.js` exibe mensagem de erro em vez
de tela branca.

---

## 4. IAM necessário

Conceda papéis ao Firebase Storage SA para cross-service rules:

```bash
PROJECT_NUMBER=$(gcloud projects describe <PROJECT_ID> \
  --format="value(projectNumber)")

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member=serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-firebasestorage.iam.gserviceaccount.com \
  --role=roles/datastore.viewer
```

E ao Compute Engine SA para deploy de Cloud Functions Gen2:

```bash
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/cloudbuild.builds.builder

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/artifactregistry.writer

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/logging.logWriter
```

---

## 5. CORS no bucket Storage

Para downloads via SDK (`getBytes`) funcionarem do browser. Em
desenvolvimento usamos `*` (qualquer origem); em piloto público
restrinja para os domínios específicos.

```bash
cat > /tmp/cors.json <<EOF
[{
  "origin": ["*"],
  "method": ["GET","POST","PUT","DELETE","HEAD"],
  "maxAgeSeconds": 3600,
  "responseHeader": ["Content-Type","Authorization","x-goog-resumable"]
}]
EOF

gsutil cors set /tmp/cors.json gs://<PROJECT_ID>.firebasestorage.app
```

---

## 6. Deploy regras + índice + funções

```bash
firebase deploy --only firestore:rules    --project <PROJECT_ID>
firebase deploy --only firestore:indexes  --project <PROJECT_ID>
firebase deploy --only storage            --project <PROJECT_ID>
firebase deploy --only functions          --project <PROJECT_ID>
```

Aguarde ~30s entre o deploy do Storage rules e o primeiro upload —
propagação cross-service.

---

## 7. Rodar o app

```bash
# instala deps Node + Python
npm install --legacy-peer-deps
python3.13 -m venv .venv
.venv/bin/pip install -r python/requirements.txt
ln -sf ../.venv python/.venv

# inicia tudo (Vite + Electron + Python)
npm run dev
```

---

## 8. Build distribuível

```bash
npm run build       # vite build + electron-builder
```

Saída em `dist/`. Para Mac/Win signing, configure
`electron-builder` em `package.json` com certificados.

---

## 9. Testes

```bash
# Python (30 testes)
.venv/bin/python -m pytest tests/python/ -q

# Firestore rules (17 testes, requer firebase emulator)
firebase emulators:exec --only firestore --project demo-ortese3d \
  "npx vitest run tests/rules.test.mjs"
```

---

## 10. Checklist pós-deploy

- [ ] Auth: criar primeiro usuário admin médico via `/login`.
- [ ] Firestore: criar manualmente o doc `users/{uid}` com
      `{name, role: 'doctor', email}` para o primeiro user
      (a primeira tentativa de registro fica órfã se DB não existir).
- [ ] Verificar `gsutil cors get gs://<bucket>` retorna a config.
- [ ] Smoke test: cadastrar paciente, criar caso, gerar modelo,
      validar, exportar STL.
- [ ] Smoke test cross-service: ortesista atribuído consegue ler
      o STL do caso (testa Storage rule).
- [ ] Atualizar `firestore.rules` antes de **2026-05-29** (data de
      expiração temporária se você reverter pra wide-open).
- [ ] Configurar `gcloud functions:artifacts:setpolicy` com retenção
      curta para evitar custo de container images antigas.
