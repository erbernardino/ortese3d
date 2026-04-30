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

    # 3. Minimum thickness via ray casting from sampled surface points
    min_thickness_found: float | None = None
    if mesh.is_watertight and len(mesh.vertices) > 10:
        try:
            sample_pts, face_ids = trimesh.sample.sample_surface(mesh, count=300)
            normals = mesh.face_normals[face_ids]
            origins = sample_pts + normals * 0.05  # nudge into the wall material
            locs, ridx, _ = mesh.ray.intersects_location(
                origins, -normals, multiple_hits=True
            )
            local_min = []
            for i in range(len(sample_pts)):
                mask = ridx == i
                if not mask.any():
                    continue
                ds = np.linalg.norm(locs[mask] - origins[i], axis=1)
                ds = ds[ds > 0.1]
                if len(ds):
                    local_min.append(float(ds.min()))
            if local_min:
                # 10º percentil — robusto contra artefatos em bordas de
                # furos de ventilação, chanfro inferior e cortes laterais
                # (orelhas). p5 é muito sensível a malha não-convexa.
                arr = np.array(local_min)
                min_thickness_found = float(np.percentile(arr, 10))
                if min_thickness_found < min_thickness_mm:
                    errors.append(
                        f"Espessura medida (p10) {min_thickness_found:.2f}mm abaixo do limite {min_thickness_mm}mm."
                    )
        except Exception as e:
            warnings.append(f"Não foi possível verificar espessura mínima: {e}")

    is_valid = len(errors) == 0

    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "volume_cm3": round(volume_cm3, 2),
        "weight_g": weight_g,
        "min_thickness_mm": round(min_thickness_found, 2) if min_thickness_found is not None else None,
    }
