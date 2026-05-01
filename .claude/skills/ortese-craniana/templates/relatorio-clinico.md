# Relatório Clínico de Design — Órtese Craniana

> **Documento gerado automaticamente em {{data_geracao}} pela skill `ortese-craniana` v{{skill_version}}**

## Identificação

- **Paciente:** {{patient_name_or_id}}
- **Idade no scan:** {{age_months}} meses
- **Data do scan:** {{scan_date}}
- **Origem do scan:** {{scan_source}} ({{scanner_model_or_method}})
- **Profissional responsável:** {{professional_name}}
- **Indicação:** {{clinical_indication}}
- **Versão do design:** v{{version}}

## Métricas antropométricas

| Medida | Valor |
|---|---|
| Comprimento craniano | {{comprimento_mm}} mm |
| Largura craniana | {{largura_mm}} mm |
| Perímetro cefálico | {{perimetro_mm}} mm |
| Diagonal A | {{diag_a_mm}} mm |
| Diagonal B | {{diag_b_mm}} mm |
| **Índice Cefálico (CI)** | **{{CI}}** |
| **CVA** | **{{CVA_mm}} mm** |
| **CVAI** | **{{CVAI_pct}}%** |

Comparação com percentis OMS para idade ({{age_months}} meses):
- Perímetro: {{perimeter_z_score}}σ ({{perimeter_classification}})

## Classificação morfológica

- **Padrão primário:** {{primary_classification}}
- **Severidade:** {{severity}}
- **Classificação Argenta:** Tipo {{argenta_type}}
- **Lado achatado:** {{flat_side}}
- **Achados adicionais:** {{secondary_findings}}

> Classificação descritiva baseada em métricas calculadas. Interpretação clínica é do profissional parceiro.

## Parâmetros de design aplicados

### Offsets por região (mm)
- Frontal: {{offset_frontal}}
- Parietal lado achatado: {{offset_parietal_flat}}
- Parietal contralateral: {{offset_parietal_opposite}}
- Vértex: {{offset_vertex}}
- Occipital lado achatado: {{offset_occipital_flat}}
- Occipital contralateral: {{offset_occipital_opposite}}
- Temporal: {{offset_temporal}}

### Estrutura
- Espessura padrão do shell: {{thickness_mm}} mm
- Espessura reforçada (rim): {{rim_thickness_mm}} mm
- Forro assumido: {{lining_mm}} mm

### Trim line
- Acima da glabela: {{trim_glabella_mm}} mm
- Acima do tragus: {{trim_tragus_mm}} mm
- Folga da hélice: {{trim_ear_mm}} mm

### Ventilação
- Diâmetro dos furos: {{vent_diameter_mm}} mm
- Espaçamento: {{vent_spacing_mm}} mm
- Número total de furos: {{vent_count}}

### Fechamento
- Tipo: {{attachment_type}}
- Lado: {{attachment_side}}

## Validação geométrica e clínica

| Check | Status |
|---|---|
| Watertight | {{check_watertight}} |
| Sem self-intersection | {{check_self_int}} |
| Espessura mínima | {{check_min_thickness}} ({{min_thickness_mm}} mm) |
| Reforço da borda | {{check_rim}} |
| Peso estimado | {{check_weight}} ({{weight_g}} g vs limite {{weight_limit_g}} g) |
| Raios de borda | {{check_edge_radii}} |
| **Fontanela anterior protegida** | **{{check_fontanelle}}** |
| Folga das orelhas | {{check_ears}} |
| Folga da sobrancelha | {{check_eyebrow}} |
| Vias respiratórias livres | {{check_airways}} |
| Centro de massa | {{check_centroid}} |
| Cabe na mesa de impressão | {{check_bed}} |

**Resultado geral da validação:** {{validation_status}}

## Material e impressão

- **Filamento:** {{material_brand}} {{material_type}}
- **Lote:** {{material_lot}}
- **Impressora:** {{printer_model}} ({{printer_serial}})
- **Slicer:** {{slicer_name}} v{{slicer_version}}
- **Parâmetros principais:** {{print_parameters_summary}}

## Pós-processamento previsto

- [ ] Remoção de suportes
- [ ] Lixamento progressivo de bordas (60→120→240→400)
- [ ] Inspeção interna com luz rasante
- [ ] {{vedação opcional}}
- [ ] Aplicação de forro {{lining_material}} ({{lining_lot}})
- [ ] Validação dimensional com paquímetro
- [ ] Limpeza
- [ ] Embalagem com etiqueta

## Recomendações para o profissional

1. Validar dimensionalmente o capacete impresso antes da prova no paciente. Conferir as medidas-chave: perímetro interno, comprimento interno, largura interna.
2. Provar no paciente com inspeção de pele após primeiro uso de 1 hora — ausência de pontos de pressão excessiva (vermelhidão que não desaparece em 30 min).
3. Em caso de sinais de pressão excessiva, retornar à etapa de design com nota da região afetada — regenerar com offset ajustado.
4. Programar revisão em 2 semanas, depois mensal.
5. Cada troca de capacete (crescimento, desgaste) demanda novo scan + novo design.

## Bibliografia de referência

- Argenta L. Clinical classification of positional plagiocephaly. J Craniofac Surg. 2004;15(3):368-372.
- Loveday BPT, de Chalain TB. Active counterpositioning or orthotic device to treat positional plagiocephaly? J Craniofac Surg. 2001;12(4):308-313.
- Mortenson PA, Steinbok P. Quantifying positional plagiocephaly: reliability and validity of anthropometric measurements. J Craniofac Surg. 2006;17(3):413-419.

---

**Assinaturas:**

Profissional responsável: ____________________________ Data: _______
Profissional que entregou ao paciente: ____________________________ Data: _______
