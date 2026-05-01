# Design Rules — Órtese Craniana

Regras geométricas e de design para o `05_offset_shell.py`, `06_trim_and_vent.py` e `07_attachments.py`. Tudo aqui é parametrizável; valores default vêm de literatura e prática consolidada de fabricantes de capacete corretivo (DOC Band, STARband, Hanger Cranial Band, e adaptações nacionais).

## Filosofia do design

O capacete corretivo **não comprime** a região achatada — ele **direciona o crescimento**. A cabeça do bebê cresce naturalmente; o capacete cria espaço onde queremos que cresça (relief) e contato suave onde queremos restringir (contact). Pressão excessiva é contraindicada e pode causar lesões de pele e até deformação iatrogênica.

## Parâmetros de offset (distância shell ↔ pele)

### Contact zones (zonas de contato suave)
Offset: **0 a 1 mm** (toque com folga mínima — não pressiona, mas restringe expansão)

Aplicação por patologia:
- **Plagiocefalia**: lado oposto ao achatamento (parietal contralateral)
- **Braquicefalia**: vértex e parietais
- **Escafocefalia**: parietais E e D (restringe lateralmente)

### Light contact zones (contato muito leve)
Offset: **1 a 2 mm**

Áreas de transição entre contact e relief — evitam degraus geométricos.

### Relief zones (zonas de alívio)
Offset: **3 a 6 mm** (espaço pra crescer)

Aplicação por patologia:
- **Plagiocefalia**: lado achatado (occipital + parietal posterior do lado afetado)
- **Braquicefalia**: occipital bilateral
- **Escafocefalia**: occipital posterior, e às vezes frontal anterior

### Free zones (zonas livres / não contato)
Offset: **6 a 10 mm** ou trim (corte)

Aplicação:
- Fontanela anterior (se < 18 meses) — **mínimo 6 mm**
- Orelhas — corte completo, margem de 8 mm acima do tragus
- Sobrancelhas e olhos — corte, margem de 10 mm acima da glabela
- Nuca / base do crânio — corte na altura do ínion ou ligeiramente acima

## Mapa de offsets por patologia

Valores default sugeridos (em mm), parametrizáveis em `design-params.json`:

### Plagiocefalia direita (achatamento occipital direito)

| Região | Offset |
|---|---|
| Frontal | 1.5 |
| Frontotemporal D | 1.0 (contato — limita protrusão frontal contralateral) |
| Frontotemporal E | 2.0 |
| Parietal D | 4.0 (relief — região posterior do parietal direito acompanha o occipital achatado) |
| Parietal E | 0.5 (contact firme — restringe expansão do lado oposto) |
| Vértex | 1.5 |
| Occipital D | 5.0 (relief máximo — região achatada precisa crescer) |
| Occipital E | 1.0 |
| Temporal E e D | 2.0 (transição) |

Espelhar para plagiocefalia esquerda.

### Braquicefalia (achatamento occipital bilateral)

| Região | Offset |
|---|---|
| Frontal | 1.5 |
| Parietal E e D | 1.0 (contact — restringe lateralmente) |
| Vértex | 0.5 (contact firme — não deixa crescer pra cima compensatoriamente) |
| Occipital | 4.0 a 5.0 (relief bilateral) |
| Temporal | 2.0 |

### Escafocefalia (cabeça alongada)

| Região | Offset |
|---|---|
| Frontal anterior | 3.0 (relief — pode permitir alargamento frontal) |
| Frontotemporal | 2.0 |
| Parietal E e D | 0.5 (contact firme — restringe alongamento lateral... wait, isso está invertido) |

Correção do parágrafo acima — escafocefalia é cabeça **estreita e longa**, o capacete **libera lateralmente** (parietais relief) e **restringe ântero-posteriormente** (frontal anterior e occipital posterior contact). Use:

| Região | Offset |
|---|---|
| Frontal anterior | 0.5 (contact — restringe alongamento) |
| Parietal E e D | 4.0 (relief — permite alargamento) |
| Vértex | 2.0 |
| Occipital posterior | 1.0 (contact) |

## Espessura do shell

Espessura final da casca (parede do capacete):

- **Default**: 3.5 mm
- **Mínimo aceitável**: 2.5 mm (abaixo disso, falha estrutural — `08_validate.py` reprova)
- **Máximo prático**: 5.0 mm (acima disso, peso excessivo pra bebê)

A espessura pode variar localmente:
- Reforço na **borda do trim** (rim): 4.5 mm em uma faixa de 8 mm a partir da borda — evita que a borda quebre ou machuque
- Região da **fivela/clip**: 4.5 mm em torno do parafuso/encaixe
- Resto: espessura default

## Trim line (linha de corte)

A linha de corte é onde o capacete termina. Define o que fica coberto e o que fica livre. Construída como curva fechada no espaço, projetada no shell:

### Pontos de controle da trim line

1. **Frontal**: 10 mm acima da glabela, suavemente curvada
2. **Lateral frontal (acima da sobrancelha)**: segue 10 mm acima da margem orbital superior
3. **Lateral temporal**: passa 8 mm acima do tragus, curva pra trás
4. **Atrás da orelha**: contorna a orelha com folga de 5 mm da hélice
5. **Mastóide**: passa logo acima do processo mastóide
6. **Occipital baixo**: na altura do ínion ou 5 mm acima, transversal
7. Espelha do outro lado, fecha curva

### Suavidade
A trim line precisa ter **curvatura contínua** (sem cantos vivos) — implementação: B-spline com pelo menos 12 pontos de controle, suavizada por Laplacian smoothing 3 iterações.

### Chanfro/raio na borda
Toda a borda do trim recebe **raio de 1.5 mm** externo e **2 mm** interno (lado da pele) para não machucar. Implementação: operação de fillet no CadQuery após a definição da curva, ou offset radial em PyMeshLab.

## Ventilação

Furos circulares no shell para ventilação e leveza visual.

### Parâmetros default
- **Diâmetro**: 8 mm
- **Espaçamento centro-a-centro**: 22 mm (padrão hexagonal)
- **Distância mínima da borda do trim**: 12 mm
- **Distância mínima de qualquer attachment (clip, fivela)**: 15 mm

### Zonas onde NÃO furar
- Região do **rim** (8 mm a partir da borda do trim) — preserva resistência da borda
- Em torno das **contact zones críticas** (5 mm de margem) — preserva pressão distribuída
- Em torno de **attachments** (15 mm)
- Sobre a **fontanela anterior** se < 18 meses (zona de não contato já tem offset alto, não precisa furo)

### Distribuição
Padrão hexagonal regular, mas perturbado levemente (jitter de até 2 mm) pra evitar aspecto de "ralo de pia" e dar caráter visual mais orgânico. Implementação: gera grid hexagonal no shell unwrapped (UV), aplica jitter, projeta de volta.

## Fechamento (clip / fivela)

A órtese precisa abrir pra colocar e tirar. Opções:

### Opção A — Clip lateral único (default)
Corte vertical no shell, do trim superior até o trim inferior, no lado **oposto** ao mais comprometido. Encaixe tipo "fivela de capacete" (snap fit + tira de velcro de segurança).

Geometria:
- Largura do corte: 4 mm
- Macho/fêmea snap fit: cantilever de 12 mm de comprimento, gancho de 1.5 mm
- Reforço local na espessura: 4.5 mm (vs 3.5 mm default)
- Posição: lado direito ou esquerdo, definido pelo usuário; default é o lado **menos** afetado (lado contralateral ao achatamento)

### Opção B — Velcro frontal
Dois pontos de velcro adesivo na frente, sem corte estrutural. Mais simples mas menos seguro pra bebês ativos.

### Opção C — Cinta posterior
Tira de tecido com velcro na nuca. Comum em modelos baratos, mas distribui pressão de forma menos previsível.

A skill suporta as três; default é Opção A.

## Forro / interface com a pele

A skill não modela o forro físico (espuma EVA, tecido), mas o offset default **assume forro de 2 mm**. Se o usuário não for usar forro, reduza todos os offsets em 2 mm — incluindo as relief zones (que viram contact).

Documente claramente no relatório: "Espessura de forro assumida: 2 mm. Sem forro, o capacete pressionará excessivamente." Forro é parte do dispositivo — não é opcional clinicamente.

## Peso alvo

Capacete pediátrico não deve passar de:

- **0–6 meses**: 150 g
- **6–12 meses**: 200 g
- **12–18 meses**: 250 g

`08_validate.py` calcula o peso a partir do volume × densidade do material e reprova se exceder.

## Parâmetros configuráveis (`design-params.json`)

Exemplo:

```json
{
  "patient": {
    "age_months": 7,
    "weight_target_max_g": 200
  },
  "diagnosis": {
    "primary": "plagiocefalia",
    "flat_side": "direito",
    "severity": "moderada"
  },
  "shell": {
    "default_thickness_mm": 3.5,
    "rim_thickness_mm": 4.5,
    "rim_band_width_mm": 8.0,
    "min_thickness_mm": 2.5
  },
  "offsets": {
    "frontal": 1.5,
    "frontotemporal_flat_side": 1.0,
    "frontotemporal_opposite": 2.0,
    "parietal_flat_side": 4.0,
    "parietal_opposite": 0.5,
    "vertex": 1.5,
    "occipital_flat_side": 5.0,
    "occipital_opposite": 1.0,
    "temporal": 2.0,
    "fontanelle_anterior_min": 6.0
  },
  "trim": {
    "above_glabella_mm": 10.0,
    "above_tragus_mm": 8.0,
    "ear_clearance_mm": 5.0,
    "occipital_above_inion_mm": 5.0,
    "edge_external_radius_mm": 1.5,
    "edge_internal_radius_mm": 2.0
  },
  "ventilation": {
    "hole_diameter_mm": 8.0,
    "spacing_mm": 22.0,
    "min_distance_from_trim_mm": 12.0,
    "min_distance_from_attachment_mm": 15.0,
    "jitter_mm": 2.0
  },
  "attachment": {
    "type": "clip_lateral",
    "side": "esquerdo",
    "snap_fit_length_mm": 12.0,
    "snap_fit_hook_mm": 1.5
  },
  "lining": {
    "assumed_thickness_mm": 2.0
  }
}
```

Esse JSON é o input do `05_offset_shell.py` e propaga para os passos seguintes.
