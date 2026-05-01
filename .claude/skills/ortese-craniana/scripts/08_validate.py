#!/usr/bin/env python3
"""
08_validate.py — Validação pré-impressão

Input:  shell_final.stl + landmarks.json + design-params.json + patient.json
Output: validation.json

Roda todos os checks listados em references/validacao-mesh.md:
- geométricos (watertight, self-intersection, normais, degeneradas, duplicados, volume)
- dimensionais (espessura mínima, rim reforçado, peso, raios de borda)
- clínicos (fontanela protegida, orelhas livres, sobrancelha, vias respiratórias, simetria)
- manufatura (overhangs, bridging, bed size)


EXCEÇÃO: check de fontanela bloqueia em ambos os modos (segurança crítica).
"""
import argparse, sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--landmarks", required=True)
    p.add_argument("--params", required=True)
    p.add_argument("--patient", required=True)
    p.add_argument("--output-dir", default=".")
    args = p.parse_args()
    print("STUB — implementar", file=sys.stderr); sys.exit(2)

if __name__ == "__main__": main()
