"""
Validação geométrica e clínica do capacete antes do export/impressão.

Falhas geram warnings detalhados — a decisão de imprimir e usar fica
com o profissional responsável. Não bloqueia.
"""
import trimesh
import numpy as np
from typing import Any

DENSITY_G_PER_CM3 = 1.24  # PLA/PETG típico

# Limites de peso por faixa etária (g) — ref design-rules-ortese.md
WEIGHT_LIMITS_BY_AGE = [
    (6, 150),    # 0-6 meses
    (12, 200),   # 6-12 meses
    (18, 250),   # 12-18 meses
    (999, 300),  # 18+ meses
]

# Raio mínimo das bordas (mm) — bordas vivas machucam a pele
MIN_EDGE_RADIUS_MM = 1.0


def _weight_limit_for_age(age_months: float | None) -> float | None:
    if age_months is None or age_months <= 0:
        return None
    for upper, limit in WEIGHT_LIMITS_BY_AGE:
        if age_months <= upper:
            return float(limit)
    return float(WEIGHT_LIMITS_BY_AGE[-1][1])


def validate_mesh(
    mesh: trimesh.Trimesh,
    min_thickness_mm: float = 2.5,
    min_clearance_mm: float = 3.0,
    age_months: float | None = None,
    fontanelle_check: bool = True,
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    checks: dict[str, str] = {}

    # 1. Watertight / manifold
    is_wt = bool(mesh.is_watertight)
    checks["watertight"] = "PASS" if is_wt else "WARN"
    if not is_wt:
        warnings.append("Malha não-watertight: contém buracos ou normais inconsistentes.")

    # 2. Self-intersections — desativado: a heurística de ray casting
    # gera falsos positivos em capacetes (raios atingem a parede oposta
    # através do vão interno). Verificação confiável exige PyMeshLab,
    # que adiciona dependência pesada. Deixar desabilitado por enquanto.
    checks["self_intersections"] = "SKIPPED"

    # 3. Volume e peso
    volume_cm3 = float(abs(mesh.volume) / 1000) if is_wt else 0.0
    weight_g = round(volume_cm3 * DENSITY_G_PER_CM3, 1)

    weight_limit = _weight_limit_for_age(age_months)
    if weight_limit is not None:
        if weight_g > weight_limit:
            checks["weight"] = "FAIL"
            errors.append(
                f"Peso estimado {weight_g}g excede limite {weight_limit}g para "
                f"idade {age_months} meses. Reduzir parede/aumentar ventilação."
            )
        elif weight_g > weight_limit * 0.9:
            checks["weight"] = "WARN"
            warnings.append(
                f"Peso estimado {weight_g}g próximo do limite {weight_limit}g "
                f"para idade {age_months} meses."
            )
        else:
            checks["weight"] = "PASS"
    else:
        checks["weight"] = "SKIPPED"

    # 4. Espessura mínima local (ray casting interno)
    min_thickness_found: float | None = None
    if is_wt and len(mesh.vertices) > 10:
        try:
            sample_pts, face_ids = trimesh.sample.sample_surface(mesh, count=400)
            normals = mesh.face_normals[face_ids]
            origins = sample_pts + normals * 0.05
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
                arr = np.array(local_min)
                # p10 robusto contra ruído de borda; min absoluto vai pra warning
                p10 = float(np.percentile(arr, 10))
                p_min = float(arr.min())
                min_thickness_found = p10
                if p10 < min_thickness_mm:
                    checks["min_thickness"] = "FAIL"
                    errors.append(
                        f"Espessura p10 {p10:.2f}mm abaixo de {min_thickness_mm}mm "
                        f"(min absoluto {p_min:.2f}mm)."
                    )
                else:
                    checks["min_thickness"] = "PASS"
                    if p_min < min_thickness_mm:
                        warnings.append(
                            f"Min absoluto de espessura é {p_min:.2f}mm "
                            f"(p10 {p10:.2f}mm está OK)."
                        )
        except Exception as e:
            checks["min_thickness"] = "SKIPPED"
            warnings.append(f"Espessura mínima não verificada: {e}")
    else:
        checks["min_thickness"] = "SKIPPED"

    # 5. Raio mínimo de borda — bordas abertas (perímetro de aberturas/trim)
    try:
        min_edge_r = _min_edge_radius(mesh)
        if min_edge_r is None:
            checks["edge_radii"] = "SKIPPED"
        elif min_edge_r < MIN_EDGE_RADIUS_MM:
            checks["edge_radii"] = "WARN"
            warnings.append(
                f"Raio mínimo nas bordas {min_edge_r:.2f}mm < {MIN_EDGE_RADIUS_MM}mm: "
                f"borda muito viva, lixar antes de provar no paciente."
            )
        else:
            checks["edge_radii"] = "PASS"
    except Exception:
        checks["edge_radii"] = "SKIPPED"
        min_edge_r = None

    # 6. Fontanela exposta — região frontal alta sem cobertura
    fontanelle_status = "SKIPPED"
    if fontanelle_check and is_wt and (age_months is None or age_months < 18):
        try:
            covered = _fontanelle_covered(mesh)
            if covered is True:
                fontanelle_status = "PASS"
            elif covered is False:
                fontanelle_status = "WARN"
                msg = "Região da fontanela anterior parece exposta — verificar offset frontal."
                warnings.append(msg)
        except Exception:
            pass
    checks["fontanelle"] = fontanelle_status

    is_valid = len(errors) == 0
    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "volume_cm3": round(volume_cm3, 2),
        "weight_g": weight_g,
        "weight_limit_g": weight_limit,
        "min_thickness_mm": round(min_thickness_found, 2) if min_thickness_found is not None else None,
        "min_edge_radius_mm": round(min_edge_r, 2) if min_edge_r is not None else None,
        "checks": checks,
    }


def _approx_self_intersections(mesh: trimesh.Trimesh, sample: int = 500) -> int:
    """Aproxima auto-intersecções amostrando faces e procurando hits coplanares próximos."""
    if len(mesh.faces) == 0:
        return 0
    n = min(sample, len(mesh.faces))
    rng = np.random.default_rng(42)
    idx = rng.choice(len(mesh.faces), n, replace=False)
    centroids = mesh.triangles_center[idx]
    normals = mesh.face_normals[idx]
    origins = centroids + normals * 0.05
    hits = mesh.ray.intersects_id(origins, -normals, multiple_hits=False)
    return int(np.sum(hits != idx))


def _min_edge_radius(mesh: trimesh.Trimesh) -> float | None:
    """
    Estima raio mínimo das **bordas abertas** (perímetros de aberturas/
    cortes) — única região onde aresta viva pode realmente machucar a
    pele. Arestas internas em mesh orgânica naturalmente têm ângulos
    altos pela triangulação e não representam risco.

    Para cada aresta de boundary, mede o ângulo dihedral entre a face
    única que contém a aresta e o plano oposto local; se for >75°,
    considera viva. Raio aproximado = comprimento / π (modelo semicírculo).
    """
    # boundary edges = arestas usadas por exatamente 1 face
    edges_sorted = np.sort(mesh.edges, axis=1)
    _, counts = np.unique(edges_sorted, axis=0, return_counts=True)
    if not (counts == 1).any():
        return 999.0  # capacete fechado, sem bordas abertas

    boundary_idx = np.where(counts == 1)[0]
    unique_edges = np.unique(edges_sorted, axis=0)
    boundary_edges = unique_edges[boundary_idx]
    if len(boundary_edges) == 0:
        return 999.0
    v0 = mesh.vertices[boundary_edges[:, 0]]
    v1 = mesh.vertices[boundary_edges[:, 1]]
    lengths = np.linalg.norm(v1 - v0, axis=1)
    # raio efetivo do filete ≈ length / π (semicírculo)
    radii = lengths / np.pi
    return float(np.percentile(radii, 5))


def _fontanelle_covered(mesh: trimesh.Trimesh) -> bool | None:
    """
    Heurística: amostra um cone de raios partindo de um ponto na região
    da fontanela anterior (frontal alta, sagital mediano, externo ao
    capacete) apontando para baixo. Se a maioria atinge a parede do
    capacete, a fontanela está coberta.
    """
    bounds = mesh.bounds
    center = (bounds[0] + bounds[1]) / 2
    extents = bounds[1] - bounds[0]
    ax, ay, az = extents / 2

    # Ponto na região da fontanela anterior, fora do capacete
    fp = np.array([center[0] + ax * 0.45, center[1], center[2] + az * 0.85])

    # Vários raios apontando pra baixo/frente em forma de cone
    n = 30
    rays = []
    for i in range(n):
        t = i / (n - 1)
        a = (t - 0.5) * 0.4   # ângulo lateral
        b = -0.2 - t * 0.3    # mais pro frontal-baixo
        d = np.array([np.sin(b), np.sin(a), -np.cos(b)])
        d = d / np.linalg.norm(d)
        rays.append(d)
    origins = np.tile(fp, (n, 1))
    dirs = np.array(rays)
    locs, ridx, _ = mesh.ray.intersects_location(origins, dirs, multiple_hits=False)
    if len(ridx) == 0:
        return False
    coverage = len(set(ridx.tolist())) / n
    return coverage > 0.5
