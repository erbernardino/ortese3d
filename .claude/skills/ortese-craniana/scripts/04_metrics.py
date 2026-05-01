#!/usr/bin/env python3
"""
04_metrics.py — Cálculo de métricas antropométricas e classificação

Input:  scan_aligned.stl + landmarks.json + patient.json (idade, sexo)
Output: metrics.json

Métricas: comprimento, largura, perímetro, diagonais A e B, CI, CVA, CVAI.
Classificação: plagiocefalia/braquicefalia/escafocefalia/combinada/sem desvio.
Severidade por faixas de Argenta e Mortenson.

Vide references/diagnostico-craniano.md para definições e faixas.
"""
import argparse, sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--landmarks", required=True)
    p.add_argument("--patient", required=True)
    p.add_argument("--output-dir", default=".")
    args = p.parse_args()
    print("STUB — implementar", file=sys.stderr); sys.exit(2)

if __name__ == "__main__": main()
