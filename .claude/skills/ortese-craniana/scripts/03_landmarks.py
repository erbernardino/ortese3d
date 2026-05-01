#!/usr/bin/env python3
"""
03_landmarks.py — Detecção de landmarks cranianos

Input:  scan_aligned.stl
Output: landmarks.json + scan_with_landmarks.png (preview pra confirmação humana)

Landmarks: vértex, násio, ínion, glabela, eurion E/D, tragus E/D, opistocrânio,
frontotemporal E/D.

CRÍTICO: deve apresentar preview pra confirmação humana antes de prosseguir.
Landmarks errados invalidam todas as métricas.
"""
import argparse, sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output-dir", default=".")
    p.add_argument("--require-confirmation", action="store_true", default=True)
    args = p.parse_args()
    print("STUB — implementar", file=sys.stderr); sys.exit(2)

if __name__ == "__main__": main()
