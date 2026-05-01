# ortese-craniana

Skill especializada em design programático de órteses cranianas (capacetes corretivos) para bebês e crianças, a partir de scans 3D.

**Status**: v0.1 — esqueleto com SKILL.md, referências completas, scripts stub.

## Estrutura

```
ortese-craniana/
├── SKILL.md                            # Orquestrador do pipeline
├── README.md                           # Este arquivo
├── references/                         # Conhecimento clínico e técnico
│   ├── anatomia-craniana.md
│   ├── diagnostico-craniano.md
│   ├── design-rules-ortese.md
│   ├── materiais-biocompativeis.md
│   ├── validacao-mesh.md
│   ├── dicom-para-mesh.md
│   └── fotogrametria-craniana.md
├── scripts/                            # Pipeline de 9 etapas (stubs)
│   ├── 01_clean_scan.py
│   ├── 02_align_frankfurt.py
│   ├── 03_landmarks.py
│   ├── 04_metrics.py
│   ├── 05_offset_shell.py
│   ├── 06_trim_and_vent.py
│   ├── 07_attachments.py
│   ├── 08_validate.py
│   └── 09_export.py
├── templates/                          # Documentos auto-gerados
│   └── relatorio-clinico.md
└── assets/                             # (a popular: meshes de teste sintéticos)
```

## Pipeline em uma linha

```
scan → clean → align → landmarks → metrics → offset → trim+vent → attach → validate → export
```

## Stack

```bash
pip install open3d pymeshlab trimesh[easy] pyvista \
            scipy scikit-learn cadquery manifold3d \
            numpy-stl pydicom SimpleITK
```

## Roadmap

### v0.1 (atual)
- [x] SKILL.md com orquestração
- [x] Referências clínicas e técnicas
- [x] Stubs de scripts com argparse e docstrings
- [x] Template de relatório clínico

### v0.2 (próxima)
- [ ] Implementação de `01_clean_scan.py` para input STL/OBJ/PLY
- [ ] Implementação de `02_align_frankfurt.py` com PCA + landmarks semi-automáticos
- [ ] Implementação de `04_metrics.py` (CI, CVAI, classificação)
- [ ] Mesh sintético de teste em `assets/`
- [ ] Smoke test do pipeline até `04_metrics`

### v0.3
- [ ] `05_offset_shell.py` com regiões e offset variável
- [ ] `06_trim_and_vent.py`
- [ ] `08_validate.py` com todos os checks

### v0.4
- [ ] `07_attachments.py` (clip lateral)
- [ ] `09_export.py` com geração de PDF do relatório

### v0.5
- [ ] Suporte a fotogrametria
- [ ] `03_landmarks.py` com confirmação visual via PNG preview

### v0.6
- [ ] Suporte a DICOM
- [ ] Comparação longitudinal entre versões do mesmo paciente

## Princípios

1. A skill calcula métricas de forma descritiva — interpretação clínica é do profissional parceiro.
2. A skill instrumentaliza iteração rápida — o capacete é provado e ajustado em loop.
3. A skill nunca alucina dimensões — tudo vem do scan ou de tabelas referenciadas.

## Licenciamento

Em definição. Considerar:
- Código (scripts): MIT ou Apache 2.0
- Referências clínicas: CC BY-NC-SA 4.0 (atribuição, não-comercial, mesma licença)
- Templates: domínio público ou similar

## Contato

Emerson Bernardino — Allogic Tecnologia / Clínica Sphera
