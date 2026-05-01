# Fotogrametria Craniana — Pipeline com Fotos

Caminho de input mais barato e acessível, mas com mais armadilhas que scanner profissional. Esta referência cobre o protocolo de captura e processamento.

## Quando usar fotogrametria

- **P&D, prototipagem rápida, testes em adultos voluntários**
- **Triagem ambulatorial** (medir, classificar, decidir se vale escalar pra scanner profissional)
- **Casos onde scanner não está disponível** (atendimento domiciliar, regiões remotas)
- **Não recomendado** como input único pra capacete em uso clínico real sem validação dimensional adicional. Erro típico de fotogrametria de cabeça é 1–3 mm — relevante pro design.

## Equipamento

- **Câmera**: celular moderno (iPhone com LiDAR é melhor opção; Android com câmera ≥ 12 MP é viável)
- **Iluminação**: difusa, sem sombras duras. Luz natural indireta é boa. Evitar flash.
- **Fundo**: liso, contrastante com a pele e cabelo. Lençol verde ou azul escuro é ideal.
- **Touca/lenço fino**: pra **achatar o cabelo** e expor o contorno do crânio. Cabelo abundante é o maior inimigo da fotogrametria de cabeça.
- **Marcadores fiduciais (opcional, recomendado)**: 5–8 adesivos circulares contrastantes (5 mm) em pontos não-críticos da touca/pele, pra ajudar o alinhamento e calibrar escala
- **Régua de escala**: objeto rígido de dimensão conhecida (cubo de calibração 30×30×30 mm) presente em pelo menos algumas fotos, pra dar escala absoluta

## Protocolo de captura

### Para bebê em colo

Bebê estável (alimentado, descansado), sentado no colo do responsável de frente pro fotógrafo. Responsável segura cabeça suavemente em duas mãos pelos lados, sem cobrir o crânio.

1. **Fotografar em arco de 360° em torno da cabeça**, mantendo distância constante de ~80 cm
2. **Três alturas**: nível dos olhos do bebê, 30° acima, 30° abaixo
3. **Sobreposição entre fotos**: ≥ 60% (duas fotos consecutivas mostram a mesma região com deslocamento de 1/3 do quadro)
4. **Total**: 60–100 fotos
5. **Tempo**: 3–5 minutos máximo (bebê não tolera muito mais)
6. **Condições**: bebê **parado** durante a captura. Se mexer muito, descartar a sequência e refazer.

### Para criança maior (cooperativa)

Sentada, instruções pra ficar parada. Mesma técnica. Mais fácil capturar mais fotos com qualidade.

### Cuidados

- Garantir que **toda** a região que vai virar capacete está fotografada com cobertura redundante
- Topo da cabeça (vértex) é frequentemente subamostrado — fazer fotos de cima especificamente
- Atrás das orelhas é difícil — pedir pro responsável segurar e expor

## Processamento

### Software de fotogrametria

Opções:

| Software | Tipo | Notas |
|---|---|---|
| **Meshroom** (AliceVision) | Free, open source | Excelente qualidade, lento, exige GPU NVIDIA |
| **RealityCapture** | Comercial, pago | Muito rápido, qualidade alta, Windows |
| **Polycam** | App mobile | Muito conveniente, qualidade variável, exporta mesh |
| **3DF Zephyr** | Comercial, free tier limitado | Alemão, profissional |
| **Apple Object Capture** | iPhone Pro com LiDAR | Excelente, integrado, gratuito mas exige hardware |

A skill é **agnóstica** quanto ao software. O input dela é o **mesh resultante** (OBJ ou PLY com textura, ou STL puro).

### Etapas dentro do software

1. Importar fotos
2. Alinhamento (Structure from Motion)
3. Densificação (Multi-View Stereo)
4. Geração de mesh
5. Limpeza manual de ruído (chão, pessoas atrás, objetos)
6. Texturização opcional
7. Export como OBJ ou PLY

### Calibração de escala

Fotogrametria pura sem referência produz mesh **sem escala absoluta**. Necessário calibrar:

**Opção A (recomendada)**: cubo de calibração presente nas fotos. Após gerar mesh, mede aresta do cubo no mesh, calcula fator de escala, aplica ao mesh todo.

**Opção B**: distância conhecida entre dois marcadores fiduciais. Mede distância no mesh, calibra.

**Opção C**: medida antropométrica conferida com paquímetro (distância tragus-tragus, ou perímetro com fita). Usa como referência, calibra.

**Opção D (apenas P&D)**: aceita mesh sem escala absoluta e ajusta visualmente — útil para iteração rápida em testes, não recomendado para uso no paciente.

A skill, no `01_clean_scan.py` para input fotogramétrico, registra a escala usada e o método de calibração no relatório. Sem isso, emite warning.

## Limpeza específica de mesh fotogramétrico

Fotogrametria gera meshes com problemas característicos:

### Ruído de superfície
- Fotogrametria não vê detalhes finos como scanner, mas adiciona ruído de alta frequência
- Aplicar **Taubin smoothing** (preserva volume) — 5–10 iterações com λ=0.5, μ=-0.53
- Não usar Laplaciano puro — encolhe a superfície

### Buracos na cabeça
- Fotogrametria pode falhar em superfícies pouco texturizadas (couro cabeludo limpo, careca) ou em regiões mal cobertas (atrás das orelhas, topo)
- PyMeshLab "Close holes" com raio máximo limitado (não fechar buracos grandes — significam captura inadequada, refazer)

### Cabelo
- Cabelo é o pior caso: mesh fotogramétrico de cabeça com cabelo cria uma "casca" externa ao crânio real, com offset variável de 5–30 mm
- Solução: touca apertada na captura (já mencionado), e ainda assim **subtrair** uma estimativa de espessura do cabelo (geralmente 3–5 mm)
- Capacete sobre cabelo crespo abundante: idealmente capturar com scanner profissional, fotogrametria fica imprecisa

### Ilhas e flutuantes
- Componentes desconexos do mesh principal (geralmente reflexos, fundo)
- Manter apenas o maior componente conexo

### Preenchimento da abertura inferior
- Fotogrametria captura a cabeça mas a base (pescoço) fica aberta
- Fechar com plano horizontal cortando 10 mm abaixo da linha de orelhas — isso vira o limite inferior do mesh pra alinhamento

## Validação de qualidade do scan fotogramétrico

`01_clean_scan.py` em modo fotogramétrico calcula **score de qualidade**:

- Densidade de vertices (vertices/cm²) — ideal > 50
- Completude (% da superfície esperada coberta) — ideal > 95%
- Variância de superfície local (proxy de ruído) — ideal < 0.3 mm RMS após smoothing
- Buracos > 5 mm de raio — ideal 0
- Componentes conexos — deve ser 1

Score < 70/100 → reprovar e pedir nova captura, com diagnóstico do problema.

## Documentação no relatório

Pra cada peça gerada a partir de fotogrametria, o relatório clínico registra:

- "Origem do scan: fotogrametria"
- Equipamento (modelo do celular/câmera)
- Número de fotos
- Software usado e versão
- Método de calibração de escala
- Score de qualidade
- "Recomenda-se validação dimensional presencial complementar"

Antes da impressão para uso em paciente, recomenda-se verificação manual de pelo menos 3 medidas-chave (perímetro, comprimento, largura) com paquímetro/fita.
