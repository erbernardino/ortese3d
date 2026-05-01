# Validação de Mesh — Pré-Impressão

Checks executados pelo `08_validate.py` antes de liberar export. Falhas geram warnings detalhados no relatório, mas o export prossegue — a decisão de imprimir e usar é do profissional responsável.

## Checks geométricos

### 1. Watertight (manifold)
- Mesh fechada, todas as arestas compartilhadas por exatamente 2 faces
- Implementação: `trimesh.Trimesh.is_watertight` E `pymeshlab` filtro "Compute geometric measures" verificando Euler characteristic
- Falha se: arestas livres > 0, ou holes detectados, ou non-manifold edges > 0
- Correção: PyMeshLab "Close holes" + manifold3d boolean union pra garantir watertight matemático

### 2. Sem self-intersections
- Faces que se atravessam causam falha no slicer
- Implementação: PyMeshLab "Select self intersecting faces" — count deve ser 0
- Falha se: qualquer face self-intersecting
- Correção: re-meshing local na região, ou refazer a operação que gerou (geralmente offset com raio inadequado)

### 3. Normais consistentes
- Todas as normais apontam pra fora (convenção FDM)
- Implementação: `trimesh.repair.fix_normals(mesh)` e checagem de winding consistency
- Falha se: faces com normal invertida > 0
- Correção: `fix_normals` repete-se até convergir

### 4. Sem faces degeneradas
- Triângulos com área zero ou aresta zero
- Implementação: PyMeshLab "Remove zero area faces"
- Falha se: > 0 (após remoção)
- Correção: aplicar remoção e re-checkar

### 5. Sem vertices duplicados
- Vertices coincidentes geometricamente mas com índices diferentes
- Implementação: `trimesh.Trimesh.merge_vertices(merge_tex=False, merge_norm=False)`
- Tolerância: 1e-5 mm
- Aplicação automática antes dos outros checks

### 6. Volume positivo
- Volume calculado > 0 (orientação correta)
- Implementação: `mesh.volume` deve ser > 0
- Falha se: volume ≤ 0 ou NaN

## Checks dimensionais

### 7. Espessura mínima global
- Em todo ponto da casca, espessura local ≥ 2.5 mm
- Implementação: ray casting interno — pra cada vertex da superfície externa, ray na direção da normal interna, distância até atingir superfície oposta = espessura local
- Amostragem: 5000 pontos aleatórios uniformes na superfície externa (suficiente estatisticamente)
- Falha se: qualquer amostra < 2.5 mm
- Reportar: histograma de espessuras + região (vertex coordinates) das mais finas

### 8. Borda do trim (rim) — espessura reforçada
- Em uma faixa de 8 mm a partir da borda, espessura ≥ 4.0 mm (default 4.5 mm)
- Implementação: identifica vertices na fronteira aberta do trim (no mesh aberto antes do solid offset), expande região por geodésica de 8 mm, mede espessura nessa banda
- Falha se: > 5% dos vertices da banda < 4.0 mm

### 9. Peso estimado
- Volume × densidade do material (PETG: 1.27 g/cm³, PLA: 1.24 g/cm³)
- Falha se: peso > limite por idade do paciente (vide `design-rules-ortese.md` — 150g / 200g / 250g por faixa)
- **NOTA**: o cálculo desconsidera infill — assume 100% sólido. Pra estimativa real com infill 25%, multiplicar por (perímetros sólidos + infill_ratio × interior). Implementação aproximada multiplica volume por 0.55 — calibrar com peso real medido.

### 10. Raios de borda
- Borda do trim deve ter raio externo ≥ 1.0 mm e interno ≥ 1.5 mm
- Implementação: análise de curvatura local (PCA dos vizinhos) ao longo da borda
- Falha se: > 5% dos pontos da borda têm raio fora da especificação
- Correção: aplicar fillet de novo, ou aumentar suavização

## Checks clínicos automáticos

### 11. Fontanela anterior protegida (se idade < 18 meses)
- Identifica região da fontanela anterior no scan (entre suturas coronal e sagital, na fronte alta)
- Mede offset shell-pele nessa região
- Falha se: offset < 6 mm em qualquer ponto da fontanela
- Falha se: pressão estimada (offset zero ou negativo) na fontanela
- **CRÍTICO**: este check tem prioridade máxima na lista de warnings — a fontanela aberta é o ponto mais sensível em bebês menores que 18 meses, qualquer falha aqui exige revisão antes de imprimir

### 12. Orelhas livres
- Identifica trágus e contorno da hélice no scan
- Verifica que o trim line passa com folga ≥ 5 mm da hélice
- Falha se: qualquer ponto da hélice está dentro do shell (a < 5 mm)

### 13. Sobrancelha livre
- Trim frontal deve estar ≥ 8 mm acima da margem orbital superior
- Falha se: distância < 8 mm em qualquer ponto da curva frontal

### 14. Vias respiratórias livres
- Verifica que o shell não se aproxima de boca/nariz por menos de 30 mm em ângulo de cobertura
- Trivial se trim line está acima da glabela, mas check explícito por segurança

### 15. Centro de massa
- Calcula centro de massa do shell
- Idealmente próximo do plano sagital mediano (assimetria < 3 mm)
- Idealmente abaixo do vértex do shell (estabilidade)
- Falha branda se: assimetria > 5 mm — peça pode girar no uso
- Não bloqueia, mas reporta no relatório

## Checks de manufatura

### 16. Overhangs
- Faces com normal apontando "pra baixo" em ângulo > 50° da vertical exigem suporte
- Implementação: análise de orientação no eixo Z (assumindo orientação de impressão padrão)
- Não bloqueia, mas reporta percentual de área que precisará suporte e sugere melhor orientação se > 30%

### 17. Bridging
- Vãos > 5 mm sem suporte na orientação escolhida
- Marca regiões pro slicer atender

### 18. Tamanho do bed
- Bounding box do shell cabe na impressora declarada
- Default: 256 × 256 × 256 mm (Bambu X1 / P1S / Voron 2.4 padrão)
- Falha se: qualquer dimensão excede

## Output do `08_validate.py`

JSON `validation.json`:

```json
{
  "passed": false,
  "warnings_critical": [
    {
      "check": "espessura_minima",
      "value": 2.31,
      "threshold": 2.5,
      "location": [12.4, 8.1, 45.7],
      "region": "parietal_esquerdo"
    }
  ],
  "warnings": [
    {
      "check": "centro_de_massa",
      "value": "assimetria 4.2 mm",
      "threshold": 5.0,
      "note": "dentro do aceitável mas próximo do limite"
    }
  ],
  "metrics": {
    "volume_cm3": 142.3,
    "weight_g_estimated": 99.4,
    "weight_g_with_infill_25pct": 54.7,
    "min_thickness_mm": 2.31,
    "thickness_p5_mm": 2.45,
    "thickness_median_mm": 3.51,
    "n_self_intersections": 0,
    "n_holes": 0,
    "watertight": true,
    "centroid_xyz": [0.5, -1.2, 65.3]
  },
  "checks_summary": {
    "watertight": "PASS",
    "self_intersections": "PASS",
    "normals": "PASS",
    "min_thickness": "FAIL",
    "rim_thickness": "PASS",
    "weight": "PASS",
    "edge_radii": "PASS",
    "fontanelle_protection": "PASS",
    "ears_clearance": "PASS",
    "eyebrow_clearance": "PASS",
    "airways_clearance": "PASS",
    "centroid_symmetry": "WARN",
    "overhangs": "PASS",
    "fits_bed": "PASS"
  }
}
```

## Política de re-trabalho

Se `08_validate.py` retorna falha:

1. Não modifique o STL diretamente — volte ao parâmetro de design responsável
2. Falhas de espessura → ajustar `default_thickness_mm` ou offsets em `design-params.json`, rodar de `05_offset_shell.py` em diante
3. Falhas de auto-intersecção → frequentemente offset agressivo demais ou suavização insuficiente — ajustar e regenerar
4. Falhas de fontanela → revisar landmarks (talvez bregma mal detectado) e/ou aumentar offset frontal alto
5. Falhas de peso → reduzir parede, aumentar furos de ventilação, considerar PLA bio (mais leve mas com ressalvas)

A skill mantém log de iterações em `iteration-log.json` — cada rodada do pipeline registra parâmetros, validação, decisão.
