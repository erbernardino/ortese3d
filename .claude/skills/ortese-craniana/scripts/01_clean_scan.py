#!/usr/bin/env python3
"""
01_clean_scan.py — Limpeza de scan craniano

Input:  scan bruto (STL/OBJ/PLY/DICOM)
Output: scan_clean.stl + scan_quality.json

Etapas:
- Detecção de fonte (STL/OBJ/PLY ou diretório DICOM)
- Reparo: fechamento de buracos pequenos, remoção de duplicados, normais consistentes
- Decimação adaptativa (alvo: 50k-100k faces)
- Suavização leve (Taubin, preserva volume)
- Cálculo de score de qualidade

STATUS: Stub. Implementar conforme especificação em:
  - references/anatomia-craniana.md (regiões do mesh)
  - references/dicom-para-mesh.md (caso DICOM)
  - references/fotogrametria-craniana.md (caso fotogrametria)
"""

import argparse
import json
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Limpeza de scan craniano")
    parser.add_argument("--input", required=True, help="STL/OBJ/PLY ou diretório DICOM")
    parser.add_argument("--output-dir", default=".", help="Diretório de saída")
    parser.add_argument(
        "--source-type",
        choices=["surface_scanner", "photogrammetry", "dicom"],
        required=True,
        help="Origem do scan — afeta etapas de limpeza",
    )
    parser.add_argument(
        "--scale-method",
        choices=["scanner_native", "calibration_cube", "fiducials", "manual"],
        default="scanner_native",
        help="Método de calibração de escala (relevante para fotogrametria)",
    )
    parser.add_argument("--target-faces", type=int, default=80000)
    args = parser.parse_args()

    # TODO: implementar
    # 1. Carregar scan conforme source_type
    # 2. Se DICOM: rodar pipeline de marching cubes (vide dicom-para-mesh.md)
    # 3. Reparo: trimesh + pymeshlab — close holes, fix normals, remove dups
    # 4. Decimação para target_faces
    # 5. Taubin smoothing
    # 6. Calcular score de qualidade
    # 8. Anonimizar metadados (especialmente DICOM)
    # 9. Salvar STL + JSON

    print("STUB — implementar conforme references/", file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
