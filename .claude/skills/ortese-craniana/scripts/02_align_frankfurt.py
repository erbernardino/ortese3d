#!/usr/bin/env python3
"""
02_align_frankfurt.py — Alinhamento ao plano de Frankfurt

Input:  scan_clean.stl
Output: scan_aligned.stl + alignment.json (matriz de transformação)

Estratégia:
- PCA inicial pra detectar eixos principais
- Detecção semi-automática de tragus E/D (pontos com curvatura específica)
- Detecção de margem orbital (depressão característica)
- Construção do FHP a partir de 3 pontos
- Aplicação de rotação que leva FHP ao plano XY com vértex em +Z

STATUS: Stub. Vide references/anatomia-craniana.md para definição de FHP.
"""
import argparse, sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output-dir", default=".")
    p.add_argument("--manual-landmarks", help="JSON com landmarks pré-marcados (opcional)")
    args = p.parse_args()
    print("STUB — implementar", file=sys.stderr); sys.exit(2)

if __name__ == "__main__": main()
