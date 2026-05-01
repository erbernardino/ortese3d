# DICOM para Mesh — Pipeline de Tomografia

Quando o input é tomografia computadorizada (TC), o processamento é diferente do scan de superfície. Esta referência cobre o caminho DICOM → mesh utilizável pela skill.

## Quando usar TC como input

- **Suspeita de craniossinostose** — o médico já solicitou TC pra diagnóstico, aproveita-se a imagem
- **Pós-operatório** de correção cirúrgica de sinostose, onde capacete coadjuvante é parte do plano
- **Pacientes maiores** onde scan de superfície é mais difícil (cabelo abundante, pouca colaboração)
- Em geral **não** é primeira escolha — TC envolve radiação ionizante. Não solicitar TC só pra fazer capacete.

## Stack adicional

```bash
pip install pydicom SimpleITK vtk scikit-image
```

## Pipeline

### 1. Leitura da série DICOM
```python
import pydicom, SimpleITK as sitk
reader = sitk.ImageSeriesReader()
dicom_files = reader.GetGDCMSeriesFileNames(dicom_dir)
reader.SetFileNames(dicom_files)
volume = reader.Execute()  # SimpleITK image 3D
```

Verificações:
- Modalidade = "CT"
- Espaçamento de voxel sub-milimétrico ideal (≤ 0.6 mm)
- Cobertura completa do crânio (não cortar topo nem base)

### 2. Reorientação para LPS (ou RAS) padrão
```python
volume = sitk.DICOMOrient(volume, 'LPS')
```

### 3. Segmentação da pele
A pele tem contraste alto com ar (fronteira óbvia). Threshold simples:

```python
import numpy as np
arr = sitk.GetArrayFromImage(volume)  # [Z, Y, X]
# Pele: HU > -300 (skin/soft tissue)
mask = arr > -300
```

Refinamento:
- Maior componente conexo (remove ruído fora da cabeça)
- Closing morfológico (fecha pequenos buracos da máscara — narinas, canal auditivo)
- Opcional: dilation 1 voxel pra suavizar fronteira

### 4. Extração de superfície (marching cubes)
```python
from skimage import measure
verts, faces, normals, _ = measure.marching_cubes(
    mask.astype(float), level=0.5,
    spacing=volume.GetSpacing()[::-1]  # ITK retorna [X,Y,Z], scikit espera [Z,Y,X]
)
```

### 5. Conversão para trimesh
```python
import trimesh
mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=True)
mesh.fix_normals()
```

### 6. Limpeza pós-marching-cubes
- Decimação: marching cubes gera **muitas** faces (frequentemente 500k+). Decimar pra ~50k–100k.
- Suavização: marching cubes deixa a superfície "voxelada". Aplicar Taubin smoothing (preserva volume) ou Laplaciano com poucas iterações.
- Remoção de componentes pequenos (orelhas podem virar ilhas separadas se a segmentação não pegou)

### 7. Recorte da face
TC inclui face inteira (olhos, nariz, boca). Capacete não cobre face. Recortar:
- Identificar plano de Frankfurt automaticamente (usa estrutura óssea — pórion + orbital identificáveis em janela óssea)
- Cortar tudo abaixo de 10 mm do FHP
- Cortar tudo à frente da glabela em ~30 mm

Resultado: mesh similar ao que sairia de um scan de superfície da cabeça, sem face.

### 8. Salvar como STL
```python
mesh.export('scan_from_ct.stl')
```

A partir daí, o pipeline normal da skill (`02_align_frankfurt.py` em diante) pega.

## Cuidados específicos

### Radiação
- TC pediátrica usa protocolos low-dose. Confirme com o radiologista que o protocolo da imagem é adequado.
- **Nunca** solicitar TC só pra fazer capacete. Aproveite TC indicada por outro motivo.
- Documentar no relatório que o input foi TC e a indicação clínica original.

### Janela óssea vs janela de partes moles
- Pra extrair pele, usa-se janela de partes moles (HU ~ -300 a +300)
- Pra identificar landmarks ósseos (pórion, glabela), pode-se usar janela óssea (HU > +200) e fazer mesh secundária do crânio ósseo
- A skill pode gerar **dois meshes**: superfície da pele (pra capacete) e superfície óssea (pra confirmar landmarks). Útil em casos complexos.

### Artefatos de movimento
- Bebê não fica parado em TC sem sedação. Sedação tem riscos.
- Artefatos de movimento aparecem como duplicação fantasma da fronteira da pele
- Detectar: se variabilidade local da fronteira é alta (high-frequency noise > X), alertar
- Capacete feito sobre TC com artefato pode ficar mal-ajustado — discutir com o médico se vale refazer com scan de superfície

### Segmentação automática vs supervisionada
- Threshold + closing funciona em 80% dos casos
- 20% precisam de intervenção (cabelo abundante mascara fronteira, plásticos da maca, brincos)
- Skill pode oferecer modo "supervisionado": exporta a máscara como NIFTI, usuário corrige no 3D Slicer ou ITK-SNAP, reimporta

### LGPD em DICOM
DICOM tem **muitos** campos de metadados identificáveis (nome, data nascimento, ID hospital, médico solicitante). Antes de processar, **anonimizar**:

```python
ds = pydicom.dcmread(file)
ds.PatientName = "ANON"
ds.PatientID = internal_anon_id
ds.PatientBirthDate = ""
# remover institution, physician, etc
```

A skill faz isso automaticamente em `01_clean_scan.py` quando recebe DICOM.
