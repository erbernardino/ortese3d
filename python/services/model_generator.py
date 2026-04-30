import numpy as np
import trimesh
from trimesh.boolean import difference


def generate_from_measurements(m: dict) -> trimesh.Trimesh:
    """
    Generates a cranial helmet from measurements.
    Single manifold shell built via boolean (outer minus inner ellipsoid).
    Optional: ventilation holes and frontal opening.
    """
    ax = m["diag_a"] / 2
    ay = m["diag_b"] / 2
    az = m["height"] / 2

    offset = m.get("offset_mm", 4.0)
    wall = m.get("wall_mm", 3.0)
    vent_holes = m.get("vent_holes", 12)         # 0 disables
    vent_radius = m.get("vent_radius_mm", 4.0)
    frontal_opening = m.get("frontal_opening", True)

    outer_dims = np.array([ax + offset, ay + offset, az + offset * 0.5])
    inner_dims = outer_dims - wall

    outer = _make_ellipsoid(*outer_dims, subdivisions=4)
    inner = _make_ellipsoid(*inner_dims, subdivisions=4)

    helmet = difference([outer, inner])

    if vent_holes > 0:
        for cyl in _vent_cylinders(outer_dims, vent_holes, vent_radius):
            helmet = difference([helmet, cyl])

    if frontal_opening:
        helmet = difference([helmet, _frontal_cutter(outer_dims)])

    return helmet


def _make_ellipsoid(ax: float, ay: float, az: float, subdivisions: int = 4) -> trimesh.Trimesh:
    sphere = trimesh.creation.icosphere(subdivisions=subdivisions)
    sphere.vertices = sphere.vertices * np.array([ax, ay, az])
    return sphere


def _vent_cylinders(outer_dims, n_holes, radius):
    """
    Distribui n cilindros radialmente sobre a metade superior do capacete,
    cada um orientado na direção do raio (atravessa a casca).
    Padrão tipo Fibonacci sphere para distribuição uniforme.
    """
    ax, ay, az = outer_dims
    max_r = max(outer_dims) * 1.6
    cylinders = []

    for i in range(n_holes):
        # Fibonacci sphere — só hemisfério superior (z >= 0.2)
        idx = i + 0.5
        phi = np.arccos(1 - 2 * idx / (n_holes * 2))     # 0..pi/2
        theta = np.pi * (1 + 5 ** 0.5) * idx
        # ponto na unit sphere
        x = np.sin(phi) * np.cos(theta)
        y = np.sin(phi) * np.sin(theta)
        z = np.cos(phi)
        if z < 0.25:
            continue
        center = np.array([x * ax, y * ay, z * az])
        direction = np.array([x, y, z])
        direction = direction / np.linalg.norm(direction)

        cyl = trimesh.creation.cylinder(radius=radius, height=max_r, sections=16)
        # cilindro está orientado em z; alinhar com direction
        z_axis = np.array([0, 0, 1])
        if not np.allclose(direction, z_axis):
            rot_axis = np.cross(z_axis, direction)
            rot_norm = np.linalg.norm(rot_axis)
            if rot_norm > 1e-9:
                angle = np.arccos(np.clip(np.dot(z_axis, direction), -1, 1))
                R = trimesh.transformations.rotation_matrix(angle, rot_axis / rot_norm)
                cyl.apply_transform(R)
        cyl.apply_translation(center)
        cylinders.append(cyl)

    return cylinders


def _frontal_cutter(outer_dims):
    """
    Caixa que remove a porção frontal+inferior (testa do bebê + abertura
    para colocar o capacete). Cobre apenas o quadrante frontal-inferior.
    """
    ax, ay, az = outer_dims
    box = trimesh.creation.box(extents=(ax * 1.4, ay * 2.4, az * 1.6))
    # posicionar deslocado para frente (x positivo) e para baixo (z negativo)
    box.apply_translation([ax * 0.95, 0, -az * 0.7])
    return box
