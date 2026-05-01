# Materiais Biocompatíveis — Órtese Craniana FDM

A escolha de material é decisão **clínica e regulatória**, não estética. Esta referência guia a seleção e o registro do material em `09_export.py` (campo `material_lot`).

## Critérios mínimos

Para órtese pediátrica em contato prolongado com pele íntegra (categoria de exposição "surface contact, intact skin, prolonged" — ISO 10993-1):

| Ensaio | Norma | Resultado exigido |
|---|---|---|
| Citotoxicidade | ISO 10993-5 | Negativo (grau ≤ 2) |
| Sensibilização | ISO 10993-10 | Negativo |
| Irritação | ISO 10993-23 (substituiu parte da 10993-10) | Negativo |
| Avaliação biológica geral | ISO 10993-1 | Plano documentado |

Laudos são **por lote** ou por **família de lotes** com mesma formulação. Fornecedor que diz "biocompatível" sem laudo de lote **não serve**.

## Famílias de filamento aceitáveis

### PETG — primeira escolha pra FDM
- Boa rigidez, baixa absorção de umidade, boa adesão entre camadas
- Fácil pós-processamento (lixar, vedar)
- Imprime em 230–245 °C, mesa 75–85 °C
- Disponível com laudos de biocompatibilidade no Brasil

### PLA — segunda escolha, com restrições
- Mais rígido que PETG, mais quebradiço — risco de fratura sob impacto
- Degradação acelerada em umidade/calor (suor de bebê + verão tropical)
- Aceitável pra protótipos e P&D, **questionável pra clínico** sem aditivos específicos
- Versões "PLA bio" com laudo existem mas são raras

### TPU (shore A 85–95) — forro
- Não pro shell estrutural (muito flexível)
- Excelente pra interface com pele se aplicado como camada interna impressa em multimaterial, ou como peça separada
- Laudos de TPU médico existem (ex.: NinjaFlex Med, Recreus Filaflex em alguns lotes)

### O que **não** usar
- ABS — vapores tóxicos durante impressão, biocompatibilidade duvidosa em FDM doméstico
- ASA — similar ao ABS pra esse fim
- Nylon (PA12, PA6) — absorve umidade, instabilidade dimensional
- PC, PEEK — temperatura de impressão alta demais pra impressoras pediátricas comuns; PEEK tem laudo médico mas custo proibitivo

## Fornecedores brasileiros (snapshot abril 2026 — verificar)

A relação muda. Confirme com o fornecedor a cada compra se há laudo do lote específico.

| Fornecedor | Linha | Notas |
|---|---|---|
| 3D Fila | PETG, alguns lotes com laudo | Pedir certificado por lote |
| Voolt3D | Voolt Med (PETG) | Laudos disponíveis sob demanda |
| GTMax3D | Linha "bio" | Verificar laudo, varia |
| Boutique3D | PETG variado | Laudo nem sempre disponível |
| Importados (Polymaker, Prusament, etc) | PolyMax PETG, Prusament PETG | Laudos do fabricante; importação tem complicações regulatórias adicionais |

**Importante**: muitos fornecedores oferecem PETG "qualidade médica" ou "food grade" — isso **não** é o mesmo que "dispositivo médico classe II com ensaios ISO 10993". Food grade cobre contato com alimento, não com pele prolongado. Exija documentação específica.

## Parâmetros de impressão recomendados (PETG)

Os números abaixo são ponto de partida. **Toda impressora exige calibração de tolerância individual** (ver `assets/calibration_protocol.md` quando criado).

| Parâmetro | Valor |
|---|---|
| Temperatura bocal | 235–245 °C (ajustar por marca) |
| Temperatura mesa | 75–85 °C |
| Velocidade | 35–50 mm/s (paredes externas) |
| Altura de camada | 0.16 mm (parede do shell) ou 0.20 mm (regiões internas) |
| Paredes (shells) | 4 perímetros mínimo |
| Infill | 25–35% giroide ou cubic |
| Top/bottom layers | 5 camadas |
| Cooling | 30–50% (PETG não gosta de fan máximo) |
| Retração | 4–6 mm @ 25 mm/s |
| Z-hop | 0.2 mm |
| Orientação na mesa | Cabeça pra baixo (concavidade pra cima) — minimiza supports na superfície interna |
| Suportes | Apenas onde estritamente necessário; árvore (organic) preferível |
| Adesão | Brim 5 mm |

Tempo de impressão típico: **18–28 horas** dependendo do tamanho.

## Pós-processamento

Capacete saído da impressora **não está pronto pra uso**. Etapas:

1. **Remoção de suportes** com cuidado pra não arrancar pele do PETG
2. **Lixamento progressivo** das bordas (60 → 120 → 240 → 400 grit) — bordas precisam ficar lisas
3. **Inspeção interna** com luz rasante — qualquer rebarba interna é cortada/lixada
4. **Vedação opcional** — alguns fabricantes aplicam camada fina de epóxi médico ou silicone biocompatível na superfície interna pra fechar microporos do FDM (reduz colonização bacteriana). Avaliar caso a caso.
5. **Aplicação do forro** — espuma EVA biocompatível ou tecido específico, colado com adesivo médico, espessura 2 mm
6. **Validação dimensional** — medidas críticas conferidas com paquímetro
7. **Limpeza final** — solução adequada (não álcool 70 — degrada PETG; usar sabão neutro e enxágue)
8. **Embalagem** — saco plástico identificado com etiqueta, instruções escritas

Tempo de pós-processamento: **2–4 horas** por peça.

## Limpeza/manutenção pelo paciente

A família recebe instruções:

- Limpeza diária do interior com pano úmido + sabão neutro
- Secar bem antes de recolocar
- Não usar álcool, acetona, alvejante
- Inspecionar pele do bebê 2x ao dia em busca de vermelhidão, atrito
- Não molhar (banho fora)
- Se quebrar/rachar, parar uso e contatar imediatamente

A skill gera essa instrução como parte do `09_export.py` (anexo do relatório).

## Validade e troca

Capacete corretivo tem vida útil curta:

- **Por crescimento**: bebê cresce, capacete fica apertado em 6–10 semanas. Avaliação clínica define troca.
- **Por desgaste**: PETG pode amarelar, perder propriedades em 4–6 meses de uso intenso. Trocar antes disso.
- **Por sujeira**: se não consegue mais ser higienizado adequadamente, trocar.

Tipicamente um tratamento usa **1 a 3 capacetes** ao longo de 4–8 meses.
