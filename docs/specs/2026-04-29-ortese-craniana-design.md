# Design: OrteseCAD — Sistema de Construção 3D de Órtese Craniana

**Data:** 2026-04-29  
**Status:** Aprovado  
**Pasta do projeto:** `criaOrtese3d/`

---

## 1. Visão Geral

Programa desktop para construção de órteses cranianas (capacetes) para correção de assimetria craniana em bebês (plagiocefalia posicional). O sistema cobre o fluxo completo: do cadastro do paciente à exportação dos arquivos de fabricação.

---

## 2. Usuários

| Perfil | Responsabilidade |
|--------|-----------------|
| **Médico / Clínico** | Cadastra o paciente, insere medidas, importa scan 3D, visualiza e aprova o modelo final, gera relatório clínico |
| **Ortesista / Técnico** | Recebe o caso, realiza scan local, edita o modelo 3D, valida a geometria, exporta para fabricação |

Os dois perfis usam o mesmo aplicativo instalado em suas máquinas. A colaboração ocorre via Firebase (sincronização de casos em tempo real).

---

## 3. Plataforma e Stack

### 3.1 Aplicativo Desktop (Electron)

- **Electron** — empacotamento cross-platform (Windows / macOS)
- **React** — interface, formulários e navegação
- **Three.js** — visualização 3D e editor de modelo no navegador Electron
- **Firebase JS SDK** — autenticação, sincronização de dados e armazenamento de arquivos

### 3.2 Servidor de Processamento Local (Python)

Roda em segundo plano na máquina do usuário como processo local. Comunicação com o Electron via HTTP na porta `8765`.

- **FastAPI** — API REST local
- **trimesh** — geração e manipulação de malha 3D
- **Open3D** — processamento de nuvem de pontos e alinhamento de scan
- **numpy** — cálculos geométricos (offset de superfície, espessura)
- **reportlab** — geração de relatórios PDF

### 3.3 Nuvem (Firebase)

- **Firestore** — dados dos pacientes, casos, histórico de versões do modelo
- **Firebase Auth** — autenticação de médicos e ortesistas
- **Firebase Storage** — armazenamento de scans (STL/OBJ/PLY), modelos finais e PDFs
- **Firebase Cloud Messaging** — notificações entre médico e ortesista

---

## 4. Fluxo de Uso Clínico

### Médico
1. Cadastrar paciente (nome, nascimento, responsável, diagnóstico)
2. Inserir medidas cranianas (circunferência, diagonais, CVAI, altura, índice de assimetria)
3. *(Opcional)* Importar scan 3D (STL/OBJ/PLY gerado por iPhone LiDAR, RealSense ou fotogrametria)
4. Visualizar pré-modelo paramétrico gerado automaticamente
5. Enviar caso ao ortesista via Firebase
6. Revisar e aprovar modelo final enviado pelo ortesista
7. Gerar relatório clínico em PDF para o prontuário

### Ortesista
1. Receber notificação de caso novo (Firebase)
2. *(Opcional)* Escanear a cabeça do bebê com scanner USB conectado ao computador
3. Editar modelo 3D: ajustar folgas, espessura, zonas de pressão e alívio
4. Validar geometria (checklist automático Python)
5. Enviar modelo final para aprovação do médico
6. Exportar arquivos de fabricação (STL, G-code, PDF técnico)

---

## 5. Pipeline de Modelagem 3D

### 5.1 Entrada de Dados

**Via medidas manuais:**  
8–12 pontos antropométricos (circunferência occipital, frontal, diagonais maior e menor, CVAI, altura craniana). O Python gera um crânio elipsoidal parametrizado como base do modelo.

**Via scan 3D:**  
Nuvem de pontos ou malha importada (STL/OBJ/PLY). Open3D realiza limpeza, alinhamento e reconstrução da malha de superfície.

### 5.2 Geração Paramétrica (Python)

O FastAPI local recebe os dados e produz a malha base do capacete:
- Offset da superfície craniana (+3–6 mm, configurável)
- Espessura de parede (2–4 mm, configurável por zona)
- Zonas de alívio e zonas de contato controlado
- Abertura de montagem (seção frontal removível)
- Furos de ventilação posicionados automaticamente

### 5.3 Edição Assistida (Three.js)

O ortesista edita o modelo na interface 3D integrada:
- Pintura de zonas por cor (alívio / pressão / neutro)
- Ajuste de espessura por região com slider
- Deformação livre de vértices (sculpt básico)
- Adição de marcadores (referência, etiqueta)
- Histórico de undo/redo (50 passos)

### 5.4 Validação Automática (Python)

Antes da exportação, checklist automático verifica:
- Malha manifold (sem buracos ou faces invertidas)
- Espessura mínima respeitada em todas as zonas
- Folga mínima de segurança em cada região
- Volume e peso estimados do produto final

### 5.5 Exportação

| Formato | Destino |
|---------|---------|
| **STL** | Impressão 3D (FDM / SLA) |
| **G-code** | Fresagem CNC em EVA ou polipropileno |
| **PDF clínico** | Prontuário — medidas, evolução, imagens do modelo, assinatura |
| **PDF técnico** | Fabricação — especificações dimensionais e de material |

---

## 6. Telas Principais

| Tela | Descrição |
|------|-----------|
| **Dashboard** | Visão geral dos casos, notificações pendentes, atalhos rápidos |
| **Cadastro + Medidas** | Dados do paciente e formulário de medidas cranianas |
| **Editor 3D** | Visualização e edição do modelo — pintura de zonas, espessura, sculpt |
| **Validação + Exportação** | Checklist automático e geração dos arquivos finais |
| **Relatório PDF** | Preview e download do relatório clínico e técnico |

---

## 7. Dados e Persistência

### Firestore — Estrutura de coleções

```
patients/
  {patientId}/
    name, birthDate, guardian, diagnosis, createdBy, createdAt

cases/
  {caseId}/
    patientId, status, assignedTo, measurements, scanFileUrl,
    modelFileUrl, reportUrl, createdAt, updatedAt, history[]

users/
  {userId}/
    name, role (doctor | orthotist), clinicId
```

### Local (Electron)
- Cache de casos para uso offline (`electron-store`)
- Fila de sincronização para operações realizadas sem internet

---

## 8. Comunicação Electron ↔ Python

O servidor Python FastAPI inicia automaticamente com o app Electron e escuta na porta `8765` (localhost). O Electron chama a API para:

- `POST /generate-model` — gerar malha base a partir de medidas ou scan
- `POST /validate-model` — executar checklist de validação
- `POST /export` — exportar STL, G-code ou PDF
- `GET /status` — verificar se o servidor está pronto

---

## 9. Considerações de Segurança e Privacidade

- Dados de pacientes (LGPD) armazenados no Firebase com regras de acesso por clínica
- Comunicação local Electron ↔ Python via `localhost` (sem exposição de rede)
- Autenticação obrigatória antes de qualquer acesso a dados
- Arquivos de scan e modelo armazenados no Firebase Storage com URL assinada (acesso temporário)

---

## 10. Fora de Escopo (v1)

- App mobile
- Integração direta com impressora 3D (apenas exportação de arquivo)
- IA para sugestão automática de zonas de pressão
- Faturamento / gestão financeira
- Prontuário eletrônico completo (apenas dados relevantes à órtese)
