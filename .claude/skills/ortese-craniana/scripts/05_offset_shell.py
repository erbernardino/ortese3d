#!/usr/bin/env python3
"""
05_offset_shell.py — Geração da casca com offset variável

Input:  scan_aligned.stl + landmarks.json + metrics.json + design-params.json
Output: shell_raw.stl

Estratégia:
- Particiona mesh em regiões (frontal, parietal E/D, occipital, vértex, etc.)
  via geodésica a partir dos landmarks
- Pra cada vertex, atribui offset baseado na região e nos parâmetros
- Suaviza transições entre regiões (gradiente em zona de 10 mm)
- Gera superfície externa por offset ao longo das normais
- Solidifica (espessura do shell)
- Booleana (manifold3d) pra garantir watertight

Vide references/design-rules-ortese.md para parâmetros e mapas por patologia.
"""
import argparse, sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--landmarks", required=True)
    p.add_argument("--metrics", required=True)
    p.add_argument("--params", required=True)
    p.add_argument("--output-dir", default=".")
    args = p.parse_args()
    print("STUB — implementar", file=sys.stderr); sys.exit(2)

if __name__ == "__main__": main()
