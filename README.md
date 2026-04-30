# OrteseCAD

Software de design paramétrico de órteses cranianas para correção de
plagiocefalia posicional. Desktop app Electron + React + Three.js,
backend local Python (FastAPI + trimesh), nuvem Firebase.

## Quick start

```bash
npm install --legacy-peer-deps
python3.13 -m venv .venv
.venv/bin/pip install -r python/requirements.txt
ln -sf ../.venv python/.venv

# .env.local com VITE_FIREBASE_* (veja docs/DEPLOY.md)
npm run dev
```

## Documentação

- **[docs/SESSION_SUMMARY.md](docs/SESSION_SUMMARY.md)** — estado
  atual, funcionalidades, limitações.
- **[docs/DEPLOY.md](docs/DEPLOY.md)** — setup completo de um novo
  projeto Firebase + IAM + CORS + smoke tests.
- **[docs/specs/](docs/specs/)** — design e arquitetura.
- **[docs/CT_DAMEC_2016_2s_06.pdf](docs/CT_DAMEC_2016_2s_06.pdf)** —
  TCC referência técnica (UTFPR).

## Testes

```bash
.venv/bin/python -m pytest tests/python/ -q                      # 30
firebase emulators:exec --only firestore --project demo-ortese3d \
  "npx vitest run tests/rules.test.mjs"                          # 17
```

## Stack

Electron 41 · React 19 · Three.js 0.184 · Python 3.13 · FastAPI ·
trimesh + manifold3d + rtree · Firebase Auth / Firestore / Storage
/ Functions / electron-store
