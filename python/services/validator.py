import trimesh
import numpy as np
from typing import Any

DENSITY_G_PER_CM3 = 1.24  # typical PLA/PETG


def validate_mesh(
    mesh: trimesh.Trimesh,
    min_thickness_mm: float = 2.0,
    min_clearance_mm: float = 3.0,
) -> dict[str, Any]:
    errors = []
    warnings = []

    # 1. Manifold check
    if not mesh.is_watertight:
        errors.append("Malha não é manifold — contém buracos ou faces invertidas.")

    # 2. Volume and weight
    volume_cm3 = float(abs(mesh.volume) / 1000) if mesh.is_watertight else 0.0
    weight_g = round(volume_cm3 * DENSITY_G_PER_CM3, 1)

    # 3. Minimum thickness estimate (sample surface points)
    if mesh.is_watertight and len(mesh.vertices) > 10:
        try:
            sample_pts, _ = trimesh.sample.sample_surface(mesh, count=200)
            prox = trimesh.proximity.ProximityQuery(mesh)
            _, dists, _ = prox.on_surface(sample_pts)
            min_found = float(np.min(dists)) * 2
            if min_found < min_thickness_mm:
                errors.append(
                    f"Espessura mínima estimada {min_found:.1f}mm abaixo do limite {min_thickness_mm}mm."
                )
        except Exception:
            warnings.append("Não foi possível verificar espessura mínima.")

    is_valid = len(errors) == 0

    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "volume_cm3": round(volume_cm3, 2),
        "weight_g": weight_g,
    }
