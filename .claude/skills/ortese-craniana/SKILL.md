---
name: ortese-craniana
description: Skill especializada em design programático de órteses cranianas (capacetes corretivos) para bebês e crianças a partir de scans 3D do crânio. Ative SEMPRE que o usuário mencionar capacete craniano, órtese craniana, capacete corretivo, plagiocefalia, braquicefalia, escafocefalia, dolicocefalia, CVAI, CI craniano, scan de cabeça de bebê, capacete pediátrico, modelagem de capacete a partir de scan, design de órtese sob medida, ou qualquer fluxo que converta scan 3D craniano em peça imprimível. Também ative quando o usuário quiser calcular métricas antropométricas cranianas (índice cefálico, assimetria), gerar relatório clínico de design, ou validar mesh de órtese antes da impressão. Esta skill orquestra um pipeline de 9 etapas (limpeza → alinhamento → landmarks → métricas → casca offset → trim/ventilação → fixação → validação → export) e carrega referências clínicas e de manufatura sob demanda. Responder sempre em português brasileiro.
---

# Órtese Craniana — Design Programático

Skill para gerar capacetes cranianos corretivos a partir de scans 3D, com pipeline reproduzível, métricas clínicas auditáveis e validação pré-impressão.

## O pipeline em 9 etapas

```
INPUT: scan craniano (STL/OBJ/PLY) + metadados do paciente (idade, perímetro, lateralidade do achatamento)

01_clean_scan.py        → limpeza, fechamento de buracos, decimação, suavização leve
02_align_frankfurt.py   → alinhamento ao plano de Frankfurt (orientação anatômica padrão)
03_landmarks.py         → identifica násio, ínion, eurion E/D, vértex, tragus E/D
04_metrics.py           → calcula CI, CVAI, perímetro, comprimento, largura, classifica patologia
05_offset_shell.py      → casca com offset variável: contact zones, relief zones, áreas livres
06_trim_and_vent.py     → linha de corte (sobrancelha, occipital, orelhas) + padrão de ventilação
07_attachments.py       → clip/fivela de fechamento paramétrico, unido ao shell
08_validate.py          → watertight, espessura mínima, self-intersection, peso estimado
09_export.py            → STL/3MF + relatório clínico (PDF) + ficha de design
```

Cada script é independente, lê do diretório de trabalho e escreve no próximo. Isso permite intervenção manual em qualquer etapa.

## Quando carregar cada referência

Você **não** precisa carregar tudo de uma vez. Use o índice abaixo:

| Quando | Carregue |
|---|---|
| Antes de tocar em qualquer scan | `references/anatomia-craniana.md` |
| Calculando CI/CVAI ou classificando patologia | `references/diagnostico-craniano.md` |
| Definindo offsets, contact/relief zones, trim | `references/design-rules-ortese.md` |
| Selecionando filamento ou recebendo lote novo | `references/materiais-biocompativeis.md` |
| Antes do export final | `references/validacao-mesh.md` |
| Lidando com input DICOM (tomografia) | `references/dicom-para-mesh.md` |
| Lidando com input fotogramétrico | `references/fotogrametria-craniana.md` |

## Stack técnica

Motores principais:

- **Open3D** ou **PyMeshLab** — limpeza, decimação, offset de superfície, suavização Laplaciana com preservação de features
- **trimesh** — manipulação geral, ray casting (medidas internas), slicing planar (trim line)
- **scipy.spatial** + **scikit-learn** — registro ICP, PCA pra eixos principais, KDTree pra vizinhança
- **pyvista** (VTK) — visualização interativa quando útil, alguns filtros de superfície
- **numpy-stl** — I/O quando outros motores tiverem problema
- **CadQuery / Build123d** — clips, fivelas, reforços paramétricos rígidos (B-rep) que são unidos ao shell orgânico
- **manifold3d** — booleana final shell ⊕ ventilação ⊕ clips, garantindo watertight

Instalação:

```bash
pip install open3d pymeshlab trimesh[easy] pyvista scipy scikit-learn \
            cadquery manifold3d numpy-stl pydicom SimpleITK
```

`pydicom` e `SimpleITK` só são necessários quando o input for tomografia.

## Princípios

1. **Métricas são descritivas, não diagnósticas.** A skill calcula e classifica CI/CVAI segundo faixas estabelecidas usando linguagem descritiva ("CVAI = 7.2%, faixa de assimetria moderada conforme classificação Argenta"). A interpretação e a indicação terapêutica seguem com o profissional parceiro.

2. **A skill instrumentaliza iteração rápida.** O capacete impresso é provado no paciente; ajustes voltam pra etapa de offset/trim e regeneram. A skill foi feita pra esse loop.

3. **A skill nunca alucina dimensões.** Tudo vem do scan ou de tabelas antropométricas referenciadas. Se faltar dado, pergunta. Não inventa.

4. **Cuidado com a fontanela em pacientes < 18 meses.** O pipeline destaca a região da fontanela anterior e sugere offset maior nessa região. `08_validate.py` emite warning se a fontanela aparece em zona de contato.

## Fluxo de uma sessão típica

1. Usuário traz scan + dados do paciente
2. Carregue `anatomia-craniana.md` se ainda não estiver no contexto
3. Rode `01_clean_scan.py` → mostre antes/depois (estatísticas de mesh: faces, watertight, volume)
4. Rode `02_align_frankfurt.py` → mostre orientação resultante
5. Rode `03_landmarks.py` → liste landmarks detectados, **peça confirmação visual** antes de prosseguir (landmarks errados invalidam tudo)
6. Carregue `diagnostico-craniano.md`, rode `04_metrics.py` → relate métricas com classificação
7. Carregue `design-rules-ortese.md`, discuta com usuário: lado do achatamento, severidade, idade — isso define os parâmetros de offset
8. Rode `05_offset_shell.py` → renderize preview
9. Rode `06_trim_and_vent.py` → mostre trim line + padrão de ventilação
10. Rode `07_attachments.py` → fechamento
11. Carregue `validacao-mesh.md`, rode `08_validate.py` — falhas geram warnings
12. Rode `09_export.py` → STL/3MF + relatório PDF

## Iteração

Capacetes cranianos exigem **3–5 iterações típicas** durante o tratamento (a cabeça cresce, a forma muda, refaz). A skill foi pensada pra esse loop:

- Cada export gera ID único e versão (`paciente-001-v3`).
- Parâmetros de design são salvos em `design-params.json` ao lado do STL.
- Regerar com parâmetros novos é trivial: muda o JSON, rerroda do passo 5.
- Comparação entre versões: `scripts/compare_versions.py` (a implementar) faz diff de métricas e renderiza heatmap de diferença geométrica.

## Limites explícitos da skill

A skill **não cobre**:

- Avaliação clínica do paciente (do médico parceiro)
- Calibração e operação do scanner físico (do operador)
- Gerenciamento de impressora 3D, slicing, pós-processamento (forro, acabamento, vedação de bordas) — skill complementar de impressão
- Faturamento, prontuário eletrônico — fora de escopo
- Marketing, captação, gestão de fila — fora de escopo

Se o usuário pedir uma dessas coisas, redirecione: a skill é puramente do design programático.

## Próximos passos para evolução

- Integração com scanner Artec/Einscan via SDK (input direto sem export manual de STL)
- Modelo treinado pra detecção automática de landmarks (atualmente semi-automática com confirmação humana)
- Comparação longitudinal automática entre scans do mesmo paciente
- Geração de simulação biomecânica simplificada (FEA do shell sob carga de uso)
