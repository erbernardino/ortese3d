#!/usr/bin/env python3
"""
06_trim_and_vent.py — Aplicação da linha de corte e padrão de ventilação

Input:  shell_raw.stl + landmarks.json + design-params.json
Output: shell_trimmed.stl

- Constrói trim line como B-spline a partir de landmarks (sobrancelha, tragus, ínion)
- Corta o shell pela trim line
- Aplica fillets nas bordas (radii externo/interno)
- Gera furos de ventilação em padrão hexagonal jitterizado
- Subtrai furos via manifold3d (booleana garantida watertight)
- Respeita zonas de exclusão (rim, attachments, fontanela se aplicável)

Vide references/design-rules-ortese.md.
"""
import argparse, sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--landmarks", required=True)
    p.add_argument("--params", required=True)
    p.add_argument("--output-dir", default=".")
    args = p.parse_args()
    print("STUB — implementar", file=sys.stderr); sys.exit(2)

if __name__ == "__main__": main()
