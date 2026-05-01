# Diagnóstico Craniano — Métricas e Classificação

A skill calcula métricas e classifica em faixas. **Não diagnostica.** O diagnóstico é do médico. O texto desta referência usa termos técnicos descritivos.

## Métricas calculadas pelo `04_metrics.py`

### Comprimento craniano (CC)
Distância entre **glabela** e **opistocrânio** medida no plano sagital, com o crânio em FHP. É o eixo antero-posterior máximo.

### Largura craniana (LC)
Distância entre **eurion E** e **eurion D**. É o eixo lateral máximo.

### Perímetro cefálico (PC)
Circunferência máxima medida no plano que passa pela glabela e pelo opistocrânio. Implementado como interseção do mesh com plano paralelo ao FHP, ajustado para passar pelos dois pontos.

### Índice Cefálico (CI)
```
CI = (LC / CC) × 100
```

Faixas (classificação clássica de Retzius, ainda em uso):

| CI | Classificação |
|---|---|
| < 75 | Dolicocefalia (cabeça longa e estreita) |
| 75–80 | Mesocefalia (proporção média) |
| 80–85 | Braquicefalia leve a moderada |
| 85–90 | Braquicefalia moderada |
| > 90 | Braquicefalia severa / hiperbraquicefalia |

Em pediatria contemporânea, valor de corte para braquicefalia posicional é frequentemente **CI > 90** (alguns autores usam 92).

### Diagonais transcranianas
Para detectar plagiocefalia (assimetria), mede-se duas diagonais cruzadas:

- **Diagonal A**: do frontotemporal D até o eurion-occipital E (passa pela diagonal "fronte-direita / atrás-esquerda")
- **Diagonal B**: do frontotemporal E até o eurion-occipital D (passa pela diagonal "fronte-esquerda / atrás-direita")

Implementação: cada diagonal é traçada a 30° do plano sagital, partindo do frontal e indo até o occipital posterior, no plano do FHP. A skill detecta os pontos de saída da diagonal no mesh por raio.

### Cranial Vault Asymmetry (CVA)
```
CVA = |Diagonal_A − Diagonal_B|   (em mm)
```

### Cranial Vault Asymmetry Index (CVAI)
```
CVAI = (CVA / max(Diag_A, Diag_B)) × 100   (em %)
```

Faixas (classificação de Argenta / Loveday adaptada):

| CVAI | Classificação |
|---|---|
| < 3.5% | Dentro da faixa de simetria |
| 3.5–6.25% | Assimetria leve (Argenta tipo 1–2) |
| 6.25–8.75% | Assimetria moderada (Argenta tipo 3) |
| 8.75–11% | Assimetria severa (Argenta tipo 4) |
| > 11% | Assimetria muito severa (Argenta tipo 5) |

Alguns autores brasileiros usam classificação de Mortenson e Steinbok com cortes ligeiramente diferentes (3.5 / 7 / 12 / >12). A skill expõe ambos os esquemas no relatório.

## Padrões de deformação que o pipeline reconhece

O `04_metrics.py` retorna um dicionário `pattern` com:

```python
{
  "CI": float,
  "CVAI": float,
  "CVA_mm": float,
  "primary_classification": str,  # "plagiocefalia | braquicefalia | escafocefalia | combinada | sem desvio significativo"
  "severity": str,                 # "leve | moderada | severa | muito severa"
  "argenta_type": int,             # 1 a 5, ou 0
  "flat_side": str,                # "esquerdo | direito | bilateral_posterior | nenhum"
  "notes": list[str]               # observações automáticas
}
```

### Plagiocefalia posicional
- CVAI > 3.5% e CI dentro do normal ou levemente alterado
- Achatamento occipital unilateral
- Frequentemente acompanhado de protrusão frontal homolateral (cabeça em paralelogramo quando vista de cima)
- O capacete restringe o lado contralateral e libera o lado achatado

### Braquicefalia posicional
- CI > 90, CVAI dentro de simetria ou levemente alterado
- Achatamento occipital bilateral
- Cabeça curta e larga
- O capacete restringe o vértex e os parietais, libera o occipital

### Escafocefalia
- CI < 75
- Cabeça longa e estreita
- Comum em prematuros que ficaram em UTIN com cabeça lateralizada
- O capacete restringe os parietais, libera o occipital posterior e a região frontal anterior
- **Atenção**: escafocefalia também pode ser sinal de **craniossinostose sagital** — neste caso é cirúrgico, não posicional. Fica MUITO claro no relatório que diferenciação clínica é do médico.

### Combinada
- CVAI > 3.5% **e** CI > 90 simultaneamente
- Plagio + braqui — comum em casos não tratados precocemente
- Capacete combina estratégias

## Sinais de alerta para escalar avaliação

A skill **não** alerta com pretensão clínica, mas marca no relatório (campo `notes`) quando detecta:

- Assimetria muito severa (CVAI > 11%) — recomenda confirmação clínica de origem (posicional vs sinostótica)
- CI extremo (< 70 ou > 95) — recomenda investigação diagnóstica adicional
- Idade do paciente fora da janela terapêutica clássica — recomenda discussão de expectativas com a família
- Mesh com indicação de assimetria facial associada (medida adicional opcional) — recomenda avaliação de torcicolo congênito associado

Esses sinais são **observações automáticas para apoio**, nunca conclusões clínicas.

## Saída esperada do `04_metrics.py`

JSON salvo em `metrics.json` no diretório de trabalho:

```json
{
  "patient_id": "anon-2026-001",
  "age_months": 7,
  "scan_date": "2026-04-30",
  "measurements": {
    "comprimento_mm": 168.4,
    "largura_mm": 132.1,
    "perimetro_mm": 451.2,
    "diagonal_A_mm": 164.7,
    "diagonal_B_mm": 154.3
  },
  "indices": {
    "CI": 78.4,
    "CVA_mm": 10.4,
    "CVAI_pct": 6.31
  },
  "classification": {
    "primary": "plagiocefalia",
    "severity": "moderada",
    "argenta_type": 3,
    "flat_side": "direito",
    "secondary_findings": []
  },
  "anthropometric_check": {
    "perimeter_z_score": 0.4,
    "within_2sd_for_age": true
  },
  "notes": [
    "Achatamento occipital direito com protrusão frontal contralateral compatível.",
    "CI dentro da faixa mesocefálica."
  ]
}
```

Esse JSON alimenta o `05_offset_shell.py` (decide onde colocar contact e relief) e o relatório clínico (`09_export.py`).
