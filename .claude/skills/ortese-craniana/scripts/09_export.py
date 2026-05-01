#!/usr/bin/env python3
"""
09_export.py — Export final + relatório clínico + ficha de design

Input:  shell_final.stl + JSONs gerados nas etapas anteriores
Output: paciente-XXX-vN.stl, paciente-XXX-vN.3mf, paciente-XXX-vN-relatorio.pdf,
        paciente-XXX-vN-design-params.json

Falhas em validação geram warnings mas não bloqueiam o export.
"""
import argparse, sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--metrics", required=True)
    p.add_argument("--validation", required=True)
    p.add_argument("--params", required=True)
    p.add_argument("--patient", required=True)
    p.add_argument("--output-dir", default=".")
    p.add_argument("--patient-id", required=True)
    p.add_argument("--version", type=int, default=1)
    args = p.parse_args()
    print("STUB — implementar", file=sys.stderr); sys.exit(2)

if __name__ == "__main__": main()
