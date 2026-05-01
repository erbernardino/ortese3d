#!/usr/bin/env python3
"""
07_attachments.py — Adição de fechamento (clip lateral / velcro / cinta)

Input:  shell_trimmed.stl + design-params.json
Output: shell_final.stl

Por default: clip lateral com snap fit + tira de velcro.
- Constrói corte vertical no shell
- Modela snap fit paramétrico (CadQuery → mesh) e une ao shell (manifold3d)
- Adiciona reforços locais
- Modela ponto de fixação do velcro (slot ou pino)
"""
import argparse, sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--params", required=True)
    p.add_argument("--output-dir", default=".")
    args = p.parse_args()
    print("STUB — implementar", file=sys.stderr); sys.exit(2)

if __name__ == "__main__": main()
