"""
Sugestão heurística de zonas de pressão e alívio para órteses cranianas.

Não é um modelo de ML treinado — usa princípios clínicos consolidados
da literatura de tratamento de plagiocefalia posicional:

  - CVAI < 3.5 — assimetria leve, tratamento conservador
  - 3.5–6.5  — moderada, capacete recomendado
  - 6.5–8.75 — grave
  - > 8.75   — muito grave

Ref: Argenta et al. 2004; Loveday & de Chalain 2001.

Estratégia: o lado mais "achatado" precisa de espaço (zona de alívio
para crescimento), enquanto o lado contralateral recebe pressão
direcionada para guiar a remodelagem.
"""

import re
from typing import Any


def suggest_zones(measurements: dict, diagnosis: str = "") -> dict[str, Any]:
    diag_a = float(measurements.get("diag_a", 0) or 0)
    diag_b = float(measurements.get("diag_b", 0) or 0)
    cvai_input = float(measurements.get("cvai", 0) or 0)

    if diag_a > 0 and diag_b > 0:
        cvai = round((diag_a - diag_b) / diag_b * 100, 2)
    else:
        cvai = cvai_input

    severity = _classify(cvai)
    side = _detect_side(diagnosis)

    zones = _build_zones(side, severity)
    summary = _build_summary(cvai, severity, side, zones)

    return {
        "cvai": cvai,
        "severity": severity,
        "affected_side": side,
        "zones": zones,
        "summary": summary,
        "confidence": _confidence(severity, side),
        "method": "heuristic-v1",
    }


def _classify(cvai: float) -> str:
    if cvai < 3.5:
        return "mild"
    if cvai < 6.5:
        return "moderate"
    if cvai < 8.75:
        return "severe"
    return "very_severe"


def _detect_side(diagnosis: str) -> str | None:
    """Retorna 'left' / 'right' / None lendo o texto do diagnóstico."""
    if not diagnosis:
        return None
    d = diagnosis.lower()
    if re.search(r"\b(direit|right)", d):
        return "right"
    if re.search(r"\b(esquer|left)", d):
        return "left"
    return None


def _build_zones(side: str | None, severity: str):
    """
    Sugere zonas em coordenadas normalizadas (-1..1) na superfície do
    capacete.
    Convenção: +x frente, +y direita, +z topo.
    """
    if not side:
        return []

    # Lado afetado (plano) é geralmente posterior (-x) do lado indicado;
    # lado oposto é o que recebe pressão.
    affected_y = 0.7 if side == "right" else -0.7
    opposite_y = -affected_y

    intensity = {"mild": 0.6, "moderate": 0.8, "severe": 1.0, "very_severe": 1.0}[severity]

    return [
        {
            "type": "relief",
            "label": f"Alívio occipital {side}",
            "position": {"x": -0.6, "y": affected_y, "z": 0.3},
            "radius_mm": 25.0,
            "intensity": intensity,
            "rationale": "Lado posterior achatado precisa de espaço para crescimento natural.",
        },
        {
            "type": "pressure",
            "label": f"Pressão frontal contralateral",
            "position": {"x": 0.5, "y": opposite_y, "z": 0.3},
            "radius_mm": 22.0,
            "intensity": intensity * 0.85,
            "rationale": "Pressão suave guia o redirecionamento do crescimento craniano.",
        },
        {
            "type": "pressure",
            "label": f"Pressão temporal {side}",
            "position": {"x": 0.0, "y": affected_y * 0.9, "z": 0.0},
            "radius_mm": 18.0,
            "intensity": intensity * 0.6,
            "rationale": "Estabiliza a forma na região temporal do lado afetado.",
        },
        {
            "type": "neutral",
            "label": "Zona neutra superior",
            "position": {"x": 0.0, "y": 0.0, "z": 0.9},
            "radius_mm": 30.0,
            "intensity": 1.0,
            "rationale": "Topo permanece neutro para distribuir contato.",
        },
    ]


def _build_summary(cvai: float, severity: str, side: str | None, zones) -> str:
    sev_label = {
        "mild": "leve",
        "moderate": "moderada",
        "severe": "grave",
        "very_severe": "muito grave",
    }[severity]
    side_label = {"left": "esquerdo", "right": "direito", None: "indeterminado"}[side]
    n_pressure = sum(1 for z in zones if z["type"] == "pressure")
    n_relief = sum(1 for z in zones if z["type"] == "relief")

    lines = [
        f"Assimetria {sev_label} (CVAI {cvai}%).",
        f"Lado afetado: {side_label}.",
        f"Sugeridas {n_pressure} zona(s) de pressão e {n_relief} de alívio.",
    ]
    if severity == "mild":
        lines.append("Considerar tratamento conservador antes de capacete.")
    if severity == "very_severe":
        lines.append("Acompanhamento clínico próximo recomendado durante o uso.")
    return " ".join(lines)


def _confidence(severity: str, side: str | None) -> float:
    base = {"mild": 0.6, "moderate": 0.8, "severe": 0.9, "very_severe": 0.85}[severity]
    if side is None:
        base *= 0.5
    return round(base, 2)
