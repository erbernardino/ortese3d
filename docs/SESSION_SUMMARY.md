# OrteseCAD — Resumo da Sessão de Desenvolvimento (2026-04-29)

## Visão Geral

Sessão completa de desenvolvimento do **OrteseCAD v1.0** — aplicativo desktop Electron + React + Python para design paramétrico de órteses cranianas para assimetria (plagiocefalia).

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Desktop | Electron 28 |
| Frontend | React 18 + Vite 5 |
| 3D Viewer | Three.js (STLLoader + OrbitControls) |
| Backend local | Python 3.13 + FastAPI |
| Cloud | Firebase (Auth + Firestore + Storage) |
| Mesh 3D | trimesh (open3d incompatível com Python 3.13) |
| PDF | ReportLab |
| Testes | pytest (30/30 passando, 94% cobertura de serviços) |

## Tarefas Completadas (T1–T18)

| # | Commit | Descrição |
|---|--------|-----------|
| T1 | `2cf92ca` | Scaffold Electron + React + Vite |
| T2 | `eb41ec1` | Python FastAPI server com routers stub |
| T3 | `1bc6a58` | Bridge Electron-Python via localhost:8765 |
| T4 | `8eaa20d` | Firebase init (Auth + Firestore + Storage) |
| T5 | `d890859` | Auth Firebase (login, registro, AuthGuard) |
| T6 | `a1eb89c` | Cadastro de pacientes com medidas cranianas |
| T7 | `ebcbed4` | Gestão de casos com colaboração via Firebase |
| T8 | `1b6fbe0` | Dashboard com lista de casos e estatísticas |
| T9 | `ca8b803` | Geração paramétrica de malha craniana (elipsoide + offset) |
| T10 | `7b6d0a9` | Importação e limpeza de scan 3D (trimesh, sem open3d) |
| T11 | `c6b814f` | Validação de malha (manifold, espessura, volume, peso) |
| T12 | `b122075` | Visualizador Three.js com geração de modelo paramétrico |
| T13 | `cedeb58` | Pintura de zonas e histórico undo/redo |
| T14 | `4080e6c` | Exportação STL e G-code CNC |
| T15 | `1dae41d` | Geração de relatórios PDF clínico e técnico |
| T16 | `bf2bb87` | Tela de validação e exportação (STL, G-code, PDF) |
| T17 | `a61c105` | Notificações Firebase entre médico e ortesista |
| T18 | `1b96a00` | Suite completa pytest — OrteseCAD v1.0 completo |

## Decisões Arquiteturais Importantes

- **trimesh exclusivo** — open3d é incompatível com Python 3.13; toda a malha 3D usa trimesh
- **localStorage para handoff STL** — a transferência de STL entre EditorPage e ValidationPage usa `localStorage` (chave `stl_${caseId}`) como solução provisória; upload para Firebase Storage ficou como pós-v1.0
- **AssignToOrthotist por email** — usa e-mail como placeholder de UID; Cloud Function para resolver UID a partir de e-mail necessária em produção
- **Índice Firestore necessário** — notificações exigem índice composto (`toUserId + read + createdAt`) — criar no Firebase Console antes do deploy em produção
- **Bundle Three.js** — ~1,15 MB (329 KB gzip); code splitting adiado para pós-v1.0

## Métricas Finais

- **19 commits** no branch `main`
- **30 testes Python** — todos passando
- **94% de cobertura** nos serviços Python (61% nos routers)
- **63 módulos Vite** — build em ~250 ms
- **Bundle** — 1,15 MB (329 KB gzip)

## Avisos para Produção

1. Criar índice composto no Firestore: `toUserId ASC + read ASC + createdAt DESC`
2. Implementar Cloud Function para resolver UID a partir de e-mail (AssignToOrthotist)
3. Migrar handoff de STL do localStorage para Firebase Storage
4. `reportlab` usa `ast.NameConstant` — remover em Python 3.14
5. Corrigir dois avisos do `electron-builder`: campo `"description"` ausente no `package.json` e chave `"directories"` obsoleta na raiz
