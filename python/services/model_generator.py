"""
Geração de capacete craniano para tratamento de plagiocefalia.

Pacote D — anatomia + aberturas + reforços:

(A) Aparência profissional
  - Aberturas laterais para as orelhas
  - Abertura frontal em arco (cilindro horizontal cortado)
  - Borda inferior chanfrada
  - Padrão de ventilação com mais furos no topo, menos nas laterais

(B) Anatomia mais realista
  - Forma craniana ovóide (não elipsoide pura): testa elevada,
    occipital arredondado, têmporas levemente côncavas

(C) Espessura variável
  - Reforços externos em zonas estruturais (occipital + lateral)
"""

import numpy as np
import trimesh
from trimesh.boolean import difference, union


# ---------------------------------------------------------------------------
# Geração paramétrica
# ---------------------------------------------------------------------------

def generate_from_measurements(m: dict) -> trimesh.Trimesh:
    ax = m["diag_a"] / 2
    ay = m["diag_b"] / 2
    az = m["height"] / 2

    offset = m.get("offset_mm", 4.0)
    wall = m.get("wall_mm", 3.0)
    vent_holes = m.get("vent_holes", 24)
    vent_radius = m.get("vent_radius_mm", 4.0)
    frontal_opening = m.get("frontal_opening", True)
    ear_holes = m.get("ear_holes", True)
    chamfer = m.get("chamfer_bottom", True)
    reinforcements = m.get("reinforcements", False)  # opt-in

    outer_dims = np.array([ax + offset, ay + offset, az + offset * 0.5])
    inner_dims = outer_dims - wall

    outer = _skull_shape(*outer_dims, subdivisions=4)
    inner = _skull_shape(*inner_dims, subdivisions=4)

    helmet = difference([outer, inner])

    if reinforcements:
        helmet = union([helmet] + _reinforcement_ribs(outer_dims, wall))

    if vent_holes > 0:
        for cyl in _vent_cylinders(outer_dims, vent_holes, vent_radius):
            helmet = difference([helmet, cyl])

    if ear_holes:
        for cut in _ear_cutters(outer_dims):
            helmet = difference([helmet, cut])

    if frontal_opening:
        helmet = difference([helmet, _frontal_arch_cutter(outer_dims)])

    if chamfer:
        helmet = difference([helmet, _bottom_chamfer_cutter(outer_dims)])

    return helmet


def generate_from_scan(
    scan_mesh: trimesh.Trimesh,
    offset_mm: float = 4.0,
    wall_mm: float = 3.0,
    vent_holes: int = 24,
    vent_radius_mm: float = 4.0,
    frontal_opening: bool = True,
    ear_holes: bool = True,
    chamfer_bottom: bool = True,
) -> trimesh.Trimesh:
    """
    Constrói capacete a partir de um scan 3D da cabeça.
    """
    if not scan_mesh.is_watertight:
        trimesh.repair.fill_holes(scan_mesh)

    scan_mesh.fix_normals()
    normals = scan_mesh.vertex_normals

    outer = scan_mesh.copy()
    outer.vertices = scan_mesh.vertices + normals * (offset_mm + wall_mm)
    outer.fix_normals()

    inner = scan_mesh.copy()
    inner.vertices = scan_mesh.vertices + normals * offset_mm
    inner.fix_normals()

    helmet = difference([outer, inner])

    bounds = scan_mesh.bounding_box.extents
    outer_dims = np.array(bounds) / 2 + offset_mm + wall_mm

    if vent_holes > 0:
        for cyl in _vent_cylinders(outer_dims, vent_holes, vent_radius_mm):
            helmet = difference([helmet, cyl])

    if ear_holes:
        for cut in _ear_cutters(outer_dims):
            helmet = difference([helmet, cut])

    if frontal_opening:
        helmet = difference([helmet, _frontal_arch_cutter(outer_dims)])

    if chamfer_bottom:
        helmet = difference([helmet, _bottom_chamfer_cutter(outer_dims)])

    return helmet


# ---------------------------------------------------------------------------
# Anatomia (B)
# ---------------------------------------------------------------------------

def _skull_shape(ax, ay, az, subdivisions=4) -> trimesh.Trimesh:
    """
    Forma ovóide com warp anatômico:
      - testa elevada (frente +x mais alta no topo)
      - occipital arredondado
      - têmporas levemente côncavas em z médio
    Comparado a uma elipsoide pura, sente-se mais como uma cabeça.
    """
    sphere = trimesh.creation.icosphere(subdivisions=subdivisions)
    v = sphere.vertices.copy()

    # escala base elipsoidal
    v *= np.array([ax, ay, az])

    # warp 1: testa elevada (+x correlaciona com +z)
    # vertices na frente (x positivo) ficam um pouco mais altos
    front = np.clip(v[:, 0] / ax, -1, 1)
    v[:, 2] += np.maximum(front, 0) * az * 0.10

    # warp 2: occipital arredondado (parte traseira mais "cheia")
    back = np.clip(-v[:, 0] / ax, -1, 1)
    v[:, 0] -= np.maximum(back, 0) ** 2 * ax * 0.06

    # warp 3: têmporas levemente côncavas em z médio
    # |y| grande + z médio → puxa pra dentro
    z_norm = v[:, 2] / az
    side = np.abs(v[:, 1]) / ay
    temple = side * np.exp(-(z_norm * 2.5) ** 2)  # gaussian em z=0
    v[:, 1] *= 1 - temple * 0.04

    sphere.vertices = v
    return sphere


# ---------------------------------------------------------------------------
# Aberturas (A)
# ---------------------------------------------------------------------------

def split_into_two_parts(
    helmet: trimesh.Trimesh,
    outer_dims,
    pin_count: int = 4,
    pin_radius: float = 2.0,
    pin_length: float = 10.0,
    pin_clearance: float = 0.15,
):
    """
    Divide o capacete em duas peças (frontal e traseira) por um plano
    coronal (YZ em x=0) e adiciona conectores macho/fêmea ao redor
    da borda de corte.

    A peça frontal recebe os pinos cilíndricos (macho); a peça traseira
    recebe os furos correspondentes (fêmea com folga `pin_clearance`).
    Retorna {"front": mesh, "back": mesh, "pins": [(y, z), ...]}.
    """
    ax, ay, az = outer_dims

    # Caixas que removem a metade contralateral
    back_remover = trimesh.creation.box(extents=(ax * 4, ay * 4, az * 4))
    back_remover.apply_translation([-ax * 2 - 0.001, 0, 0])

    front_remover = trimesh.creation.box(extents=(ax * 4, ay * 4, az * 4))
    front_remover.apply_translation([ax * 2 + 0.001, 0, 0])

    front_part = difference([helmet, back_remover])
    back_part = difference([helmet, front_remover])

    # Distribui pinos pela borda do corte (no plano YZ)
    # 1 no topo, 2 laterais ao nível do meio, 1 atrás se >=4
    pin_layout = []
    pin_layout.append((0, az * 0.85))        # topo central
    pin_layout.append((+ay * 0.85, 0.0))     # lateral direita
    pin_layout.append((-ay * 0.85, 0.0))     # lateral esquerda
    if pin_count >= 4:
        pin_layout.append((0, -az * 0.50))   # base central (frente da abertura)
    pin_layout = pin_layout[:pin_count]

    R_x = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0])
    for (y, z) in pin_layout:
        # Pino macho sólido, eixo X
        pin = trimesh.creation.cylinder(radius=pin_radius, height=pin_length, sections=16)
        pin.apply_transform(R_x)
        pin.apply_translation([0, y, z])
        front_part = union([front_part, pin])

        # Furo correspondente com folga
        hole = trimesh.creation.cylinder(
            radius=pin_radius + pin_clearance,
            height=pin_length * 1.4,
            sections=16,
        )
        hole.apply_transform(R_x)
        hole.apply_translation([-pin_length * 0.05, y, z])
        back_part = difference([back_part, hole])

    return {"front": front_part, "back": back_part, "pins": pin_layout}


def _frontal_arch_cutter(outer_dims) -> trimesh.Trimesh:
    """
    Corta a abertura frontal em arco — usa um cilindro horizontal
    (eixo Y) muito grande passando pelo plano frontal-inferior, em vez
    de uma caixa. Resultado: borda em curva, não viva.
    """
    ax, ay, az = outer_dims
    radius = az * 1.2
    cyl = trimesh.creation.cylinder(radius=radius, height=ay * 2.6, sections=48)
    # cilindro está em Z; rotaciona pra Y
    R = trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0])
    cyl.apply_transform(R)
    # posiciona: frente (x +) e baixo (z -)
    cyl.apply_translation([ax * 0.65 + radius * 0.5, 0, -az * 1.0])
    return cyl


def _ear_cutters(outer_dims):
    """
    Dois recortes oblongos (capsule-like) nas laterais para acomodar
    as orelhas. Não fura o capacete inteiro — só remove a região
    lateral em z médio-baixo, perto da abertura inferior.
    """
    ax, ay, az = outer_dims
    cuts = []
    for sign in (-1, 1):
        # cápsula vertical
        cap = trimesh.creation.capsule(
            radius=ay * 0.18,
            height=az * 0.55,
            count=[12, 12],
        )
        # capsule já em Z; orienta pra Y (lateral)
        R = trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0])
        cap.apply_transform(R)
        # posiciona na lateral (sign * y) próximo à base
        cap.apply_translation([ax * 0.05, sign * ay * 0.95, -az * 0.55])
        cuts.append(cap)
    return cuts


def _bottom_chamfer_cutter(outer_dims):
    """
    Caixa larga inclinada que remove a borda viva inferior, criando
    um chanfro contínuo ao redor do capacete.
    """
    ax, ay, az = outer_dims
    box = trimesh.creation.box(extents=(ax * 4, ay * 4, az * 0.8))
    # rota leve pra criar inclinação (chanfro)
    R = trimesh.transformations.rotation_matrix(np.deg2rad(8), [0, 1, 0])
    box.apply_transform(R)
    # posiciona logo abaixo do capacete, encostando na borda
    box.apply_translation([0, 0, -az * 1.18])
    return box


# ---------------------------------------------------------------------------
# Ventilação (densidade variável)
# ---------------------------------------------------------------------------

def _vent_cylinders(outer_dims, n_holes, radius):
    """
    Distribui furos via Fibonacci sphere mas com ponderação:
      - mais furos no topo (z alto)
      - menos furos perto da abertura frontal e das orelhas
    """
    ax, ay, az = outer_dims
    max_r = max(outer_dims) * 1.6
    cylinders = []

    for i in range(n_holes * 2):       # gera o dobro e descarta
        idx = i + 0.5
        phi = np.arccos(1 - 2 * idx / (n_holes * 4))
        theta = np.pi * (1 + 5 ** 0.5) * idx
        x = np.sin(phi) * np.cos(theta)
        y = np.sin(phi) * np.sin(theta)
        z = np.cos(phi)

        if z < 0.25:                  # ignora hemisfério inferior
            continue
        # menos furos perto das orelhas (|y| alto e z baixo)
        if abs(y) > 0.85 and z < 0.6:
            continue
        # menos furos na frente baixa (próximo do arco)
        if x > 0.6 and z < 0.5:
            continue

        center = np.array([x * ax, y * ay, z * az])
        direction = np.array([x, y, z])
        direction = direction / np.linalg.norm(direction)

        cyl = trimesh.creation.cylinder(radius=radius, height=max_r, sections=16)
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

        if len(cylinders) >= n_holes:
            break

    return cylinders


# ---------------------------------------------------------------------------
# Reforços (C) — espessura variável via saliências externas
# ---------------------------------------------------------------------------

def _reinforcement_ribs(outer_dims, wall):
    """
    Costelas estruturais externas: uma anel sagital (testa→nuca) e
    duas linhas occipital/temporal. Aumenta espessura efetiva nas
    zonas que mais sofrem carga sem afetar o resto.
    """
    ax, ay, az = outer_dims
    rib_thickness = wall * 0.6        # mm acrescentados além da casca
    ribs = []

    # 1) Anel sagital: torus aplainado no plano XZ
    sagittal = trimesh.creation.torus(
        major_radius=ax * 0.95,
        minor_radius=rib_thickness,
        major_sections=64,
        minor_sections=12,
    )
    # torus já no plano XY → roda pra XZ
    R = trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0])
    sagittal.apply_transform(R)
    # achata em Y
    sagittal.vertices[:, 1] *= 0.3
    ribs.append(sagittal)

    # 2) Anel coronal (testa→occipital, perpendicular)
    coronal = trimesh.creation.torus(
        major_radius=ay * 0.95,
        minor_radius=rib_thickness * 0.8,
        major_sections=48,
        minor_sections=10,
    )
    R = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0])
    coronal.apply_transform(R)
    coronal.vertices[:, 0] *= 0.25
    ribs.append(coronal)

    return ribs
