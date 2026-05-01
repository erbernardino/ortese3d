# Anatomia Craniana — Referência para Design de Órtese

## Planos de orientação

**Plano de Frankfurt (Frankfurt Horizontal Plane, FHP):** plano de referência padrão em antropologia e ortodontia. Definido por três pontos: o ponto **orbital esquerdo** (margem inferior da órbita) e os **dois pórions** (margem superior do meato acústico externo, esquerdo e direito). Quando o crânio está alinhado ao FHP, a olhada é horizontal e as medidas são reprodutíveis.

Em scans de bebês, o pórion é difícil de localizar. Use aproximação prática: **plano que contém o tragus E, tragus D, e a margem inferior da órbita do lado menos afetado**.

**Plano sagital mediano:** plano vertical que divide o crânio em metades direita e esquerda. Passa pelo **násio** (ponto médio entre os olhos, na sutura nasofrontal) e pelo **ínion** (protuberância occipital externa). Usado para medir assimetrias.

**Plano coronal:** vertical, perpendicular ao sagital. Passa pelos eurions (pontos mais laterais do crânio).

## Landmarks essenciais para a skill

Ordem de detecção sugerida no `03_landmarks.py`:

| Landmark | Localização | Uso na skill |
|---|---|---|
| **Vértex** | Ponto mais alto do crânio, com a cabeça em FHP | Topo do shell, eixo Z anatômico |
| **Násio** | Junção da sutura nasofrontal, ponto mais profundo do dorso nasal | Definição do plano sagital, frente da órtese |
| **Ínion** | Protuberância occipital externa, palpável | Definição do plano sagital, trás da órtese |
| **Glabela** | Ponto mais anterior da fronte, entre as sobrancelhas | Linha de corte frontal (~1 cm acima) |
| **Eurion E e D** | Pontos mais laterais do crânio (largura máxima) | Medida de largura, plano coronal, identificação de assimetria |
| **Tragus E e D** | Saliência cartilaginosa anterior ao meato acústico | Linha de corte lateral (NÃO comprimir orelha) |
| **Opistocrânio** | Ponto mais posterior do crânio em FHP | Comprimento máximo, parte do CI |
| **Frontotemporal E e D** | Ponto onde a linha temporal cruza a região frontal | Trim line lateral superior |

## Regiões cranianas (para offset diferenciado)

O capacete não tem espessura uniforme nem offset uniforme. Divida o crânio em regiões:

### Frontal
- Da glabela até a sutura coronal
- Em plagiocefalia, lado mais protrusão da fronte fica do **lado oposto** ao achatamento occipital
- Trim: 1 cm acima da glabela, evitando contato com sobrancelha

### Parietal E e D
- Entre suturas coronal, sagital e lambdóide
- Região onde MAIS atua o capacete (contato e direcionamento de crescimento)
- Lado achatado: relief zone (offset maior, livre pra crescer)
- Lado oposto: contact zone (toque suave, restringe expansão lateral)

### Occipital
- Atrás da sutura lambdóide, até o ínion
- Em plagiocefalia: lado achatado fica aqui — relief zone forte
- Em braquicefalia: toda a região occipital fica achatada — relief zone bilateral
- Em escafocefalia: occipital alongado posteriormente — contact zone

### Temporal E e D
- Acima do tragus, abaixo da linha temporal
- Trim line passa por aqui — **não pode comprimir orelha**
- Margem mínima de 8–10 mm acima do tragus

### Vértex
- Topo
- Geralmente contact zone leve em todas as patologias
- Em braquicefalia severa: contact zone moderada (compressão suave do topo)

## Suturas e fontanelas — atenção redobrada

Em bebês de **0 a 18 meses**, suturas ainda não estão fundidas. As principais:

| Sutura/Fontanela | Localização | Idade de fechamento |
|---|---|---|
| Fontanela anterior (bregmática) | Junção das suturas coronal e sagital, no topo da fronte | 9–18 meses |
| Fontanela posterior (lambdática) | Junção das suturas sagital e lambdóide, no occipital | 2–3 meses |
| Sutura sagital | Linha mediana do topo | 22 meses |
| Sutura coronal | Atrás da fronte, transversal | 24 meses |
| Sutura lambdóide | Atrás, em V invertido | 26 meses |
| Sutura metópica | Frontal mediana (rara persistir) | 9 meses |

**Regra crítica da skill:** se idade < 18 meses, a região da **fontanela anterior** é tratada como zona de **não contato** com offset mínimo de 6 mm e zero pressão. Está implementada como check em `08_validate.py`.

Em casos de craniossinostose (fechamento prematuro de sutura — escafocefalia, trigonocefalia, plagiocefalia anterior), o capacete é coadjuvante de tratamento cirúrgico, não substituto. Marque no relatório que indicação é pós-cirúrgica.

## Antropometria pediátrica de referência

Faixas de perímetro cefálico por idade (OMS, percentil 50):

| Idade | Meninos | Meninas |
|---|---|---|
| 3 meses | 41 cm | 40 cm |
| 6 meses | 44 cm | 43 cm |
| 9 meses | 46 cm | 45 cm |
| 12 meses | 47 cm | 46 cm |
| 18 meses | 49 cm | 47 cm |
| 24 meses | 49.5 cm | 48 cm |

Use como sanity check: se o perímetro calculado pelo `04_metrics.py` ficar fora de ±2σ pra idade, alerte — pode ser scan corrompido ou orientação errada.

## Janela terapêutica

O capacete corretivo funciona porque o crânio infantil é maleável. Eficácia por idade aproximada:

- **3–6 meses:** janela ideal, máxima eficácia, tratamento mais curto (3–4 meses)
- **6–10 meses:** boa eficácia, tratamento típico (4–6 meses)
- **10–14 meses:** eficácia reduzida, tratamento mais longo (6–9 meses)
- **14–18 meses:** janela limítrofe, indicação caso a caso, eficácia limitada
- **>18 meses:** geralmente não indicado (suturas em fechamento, baixa plasticidade)

A skill não decide indicação, mas usa idade pra ajustar parâmetros: bebês mais novos toleram menos pressão, capacete mais leve (parede mais fina dentro do limite estrutural), trocas mais frequentes (cabeça cresce rápido).

## Referências bibliográficas chave

- Argenta L. Clinical classification of positional plagiocephaly. J Craniofac Surg. 2004;15(3):368-372. (Classificação de assimetria que fundamenta o CVAI por níveis)
- Loveday BPT, de Chalain TB. Active counterpositioning or orthotic device to treat positional plagiocephaly? J Craniofac Surg. 2001;12(4):308-313.
- Wilbrand JF et al. Objectifiable impact of an isolated plagiocephaly on infant cognitive development. Childs Nerv Syst. 2012;28(9):1453-1456.
- Sociedade Brasileira de Pediatria — Documento Científico sobre plagiocefalia posicional (atualização mais recente em circulação).

Estas referências entram no relatório clínico como bibliografia padrão.
