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
            try:
                helmet = difference([helmet, cyl])
            except ValueError:
                # Recupera helmet se virou non-volume (pode acontecer com
                # muitos boolean encadeados em flower clusters)
                helmet.process(validate=True)
                try:
                    helmet = difference([helmet, cyl])
                except ValueError:
                    continue        # pula este slot

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

def _slide_latch_male(y_pos, z_pos, lug_thickness=8.0, lug_extension=14.0,
                      lug_width=22.0, neck_radius=2.5, head_radius=4.5,
                      neck_length=4.0, head_length=2.0):
    """
    Lingueta com pino tipo cogumelo (eixo radial saindo PRA FORA).
    Para encaixar no slot keyhole da contra-peça.
    """
    norm = (y_pos ** 2 + z_pos ** 2) ** 0.5
    if norm < 0.001:
        return None
    ny, nz = y_pos / norm, z_pos / norm
    angle = np.arctan2(nz, ny)
    R = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])

    # Posição do centro da aba — afastada radialmente
    cx, cy, cz = 0, y_pos + ny * lug_extension / 2, z_pos + nz * lug_extension / 2

    # Plate (aba retangular). X = espessura split, Y' = radial, Z' = tangencial
    plate = trimesh.creation.box(extents=(lug_thickness, lug_extension, lug_width))
    plate.apply_transform(R)
    plate.apply_translation([cx, cy, cz])

    # Pino cogumelo apontando para -X. Construir com union pra virar
    # mesh manifold (concatenate cria componentes desconectados).
    neck = trimesh.creation.cylinder(radius=neck_radius, height=neck_length, sections=16)
    head = trimesh.creation.cylinder(radius=head_radius, height=head_length, sections=20)
    head.apply_translation([0, 0, neck_length / 2 + head_length / 2])
    pin = union([neck, head])

    # Cilindro original em Z; rotaciona pra eixo -X
    R_pin = trimesh.transformations.rotation_matrix(-np.pi / 2, [0, 1, 0])
    pin.apply_transform(R_pin)
    # Posiciona: base do pino dentro da peça frontal (x>0); cabeça atravessa
    # plano de corte e fica em x negativo (peça traseira)
    pin.apply_translation([
        +neck_length / 2 - head_length / 2,
        cy, cz,
    ])

    return union([plate, pin])


def _slide_latch_female(y_pos, z_pos, lug_thickness=8.0, lug_extension=14.0,
                        lug_width=22.0, neck_radius=2.5, head_radius=4.5,
                        slot_length=10.0, clearance=0.3):
    """
    Lingueta com slot keyhole rasgado (extremidade larga + extensão estreita).
    Pino macho da contra-peça entra pela extremidade larga e desliza para a
    estreita, ficando preso pela cabeça.
    """
    norm = (y_pos ** 2 + z_pos ** 2) ** 0.5
    if norm < 0.001:
        return None
    ny, nz = y_pos / norm, z_pos / norm
    angle = np.arctan2(nz, ny)
    R = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])

    cx, cy, cz = 0, y_pos + ny * lug_extension / 2, z_pos + nz * lug_extension / 2

    plate = trimesh.creation.box(extents=(lug_thickness, lug_extension, lug_width))
    plate.apply_transform(R)
    plate.apply_translation([cx, cy, cz])

    # Slot keyhole no plate, eixo X (passante)
    # Extremidade LARGA (radius head + folga) numa ponta do slot
    big_hole = trimesh.creation.cylinder(
        radius=head_radius + clearance,
        height=lug_thickness * 1.5, sections=20,
    )
    R_x = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0])
    big_hole.apply_transform(R_x)
    # posição: deslocado tangencialmente do centro (no eixo Z' local = lug_width)
    # Aplicamos a rotação R do plate para alinhar o offset com o eixo Z' tangencial
    big_offset_local = np.array([0, 0, +slot_length / 2])
    big_offset = R[:3, :3] @ big_offset_local
    big_hole.apply_translation([cx, cy + big_offset[1], cz + big_offset[2]])

    # Slot ESTREITO (passa só o pescoço): caixa fina ao longo do eixo Z' do plate
    narrow = trimesh.creation.box(extents=(
        lug_thickness * 1.5,                    # X: através
        (neck_radius + clearance) * 2,          # Y': largura igual ao diâmetro do pescoço
        slot_length,                            # Z': comprimento ao longo do plate
    ))
    narrow.apply_transform(R)
    narrow.apply_translation([cx, cy, cz])

    # trimesh.boolean.difference só aceita 2 meshes — encadear
    plate_with_slot = difference([plate, big_hole])
    plate_with_slot = difference([plate_with_slot, narrow])
    return plate_with_slot


def split_into_two_parts(
    helmet: trimesh.Trimesh,
    outer_dims,
    pin_count: int = 4,
    use_slide_latch: bool = True,
    pin_radius: float = 2.5,        # parafuso M5 (modo simples)
    lug_extension: float = 14.0,
    lug_thickness: float = 8.0,
    lug_width: float = 22.0,
):
    """
    Divide o capacete em duas peças (frontal e traseira) por um plano
    coronal (YZ em x=0).

    Os conectores ficam **fora** da casca como abas (lugs) radiais
    saindo da superfície externa, sobre a linha de corte. Cada lug
    é dividido pelo plano de corte: metade fica em cada peça. Quando
    as peças são juntadas, as duas metades se encostam e um parafuso
    passante (eixo X) atravessa ambas, fixando as peças sem invadir
    o espaço interno da cabeça do bebê.
    """
    ax, ay, az = outer_dims

    # Posições (y, z) em torno da circunferência do corte
    lug_layout = []
    lug_layout.append((0, +az))            # topo
    lug_layout.append((+ay, 0.0))          # lateral direita
    lug_layout.append((-ay, 0.0))          # lateral esquerda
    if pin_count >= 4:
        lug_layout.append((0, -az * 0.55)) # base (próxima à abertura frontal)
    lug_layout = lug_layout[:pin_count]

    # Caixas removedoras do split coronal
    back_remover = trimesh.creation.box(extents=(ax * 4, ay * 4, az * 4))
    back_remover.apply_translation([-ax * 2 - 0.001, 0, 0])
    front_remover = trimesh.creation.box(extents=(ax * 4, ay * 4, az * 4))
    front_remover.apply_translation([ax * 2 + 0.001, 0, 0])

    # Split puro primeiro
    front_part = difference([helmet, back_remover])
    back_part = difference([helmet, front_remover])

    # Adiciona os fechos a cada metade independentemente
    for (y_surf, z_surf) in lug_layout:
        if use_slide_latch:
            male = _slide_latch_male(
                y_surf, z_surf,
                lug_thickness=lug_thickness, lug_extension=lug_extension,
                lug_width=lug_width,
            )
            female = _slide_latch_female(
                y_surf, z_surf,
                lug_thickness=lug_thickness, lug_extension=lug_extension,
                lug_width=lug_width,
            )
            if male is None or female is None:
                continue
            # Macho na peça frontal, fêmea na traseira
            front_part = union([front_part, male])
            back_part = union([back_part, female])
        else:
            # Modo legado: lug com furo passante (parafuso M5)
            norm = (y_surf ** 2 + z_surf ** 2) ** 0.5
            if norm < 0.001:
                continue
            ny, nz = y_surf / norm, z_surf / norm
            cy = y_surf + ny * lug_extension / 2
            cz = z_surf + nz * lug_extension / 2

            lug = trimesh.creation.box(extents=(lug_thickness, lug_extension, lug_width))
            angle = np.arctan2(nz, ny)
            R_lug = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])
            lug.apply_transform(R_lug)
            lug.apply_translation([0, cy, cz])

            hole = trimesh.creation.cylinder(
                radius=pin_radius, height=lug_thickness * 1.4, sections=16,
            )
            R_hole = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0])
            hole.apply_transform(R_hole)
            hole.apply_translation([0, cy, cz])
            lug_with_hole = difference([lug, hole])

            # mesmo lug nas duas peças (split coronal divide em 2 metades)
            front_part = union([front_part, lug_with_hole])
            back_part = union([back_part, lug_with_hole])

    return {"front": front_part, "back": back_part, "pins": lug_layout}


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

def _flower_vent_cluster(center, direction, petal_count=8,
                         petal_radius=2.0, petal_length=10.0,
                         center_offset=2.5, depth=20.0):
    """
    Cluster de pétalas radiais inspirado no logo Sphera Policlínica.
    Retorna **lista** de N pétalas (cilindros) + 1 cilindro central como
    cutters separados — cada um é mesh manifold individual.
    """
    z_axis = np.array([0, 0, 1])
    direction = np.asarray(direction, dtype=float)
    direction = direction / np.linalg.norm(direction)
    if not np.allclose(direction, z_axis):
        rot_axis = np.cross(z_axis, direction)
        rot_norm = np.linalg.norm(rot_axis)
        if rot_norm > 1e-9:
            angle = np.arccos(np.clip(np.dot(z_axis, direction), -1, 1))
            R_align = trimesh.transformations.rotation_matrix(angle, rot_axis / rot_norm)
        else:
            R_align = np.eye(4)
    else:
        R_align = np.eye(4)

    cutters = []
    # Pétalas: cilindros tangenciais distribuídos radialmente
    for i in range(petal_count):
        angle = (2 * np.pi * i) / petal_count
        cyl = trimesh.creation.cylinder(
            radius=petal_radius, height=petal_length, sections=12,
        )
        # eixo em Z; deita em Y; afasta do centro; gira pra ângulo do petal
        R_lay = trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0])
        cyl.apply_transform(R_lay)
        cyl.apply_translation([0, center_offset + petal_length / 2, 0])
        R_spin = trimesh.transformations.rotation_matrix(angle, [0, 0, 1])
        cyl.apply_transform(R_spin)
        # Adiciona profundidade radial: como o cilindro está deitado em Y,
        # a perfuração radial precisa de outro cutter — usamos uma esfera
        # alongada via aumento de raio em Z após alinhar
        cyl.apply_transform(R_align)
        cyl.apply_translation(center)
        cutters.append(cyl)

    # Cilindro central de penetração: cobre todo o cluster radialmente.
    # Garante que o cluster perfure de fato a casca.
    bore = trimesh.creation.cylinder(
        radius=center_offset + petal_length * 0.55,
        height=depth, sections=20,
    )
    bore.apply_transform(R_align)
    bore.apply_translation(center)
    cutters.append(bore)
    return cutters


def _vent_cylinders(outer_dims, n_holes, radius):
    """
    Padrão híbrido: 1 cluster "flor Sphera" no centro do topo +
    slots ovais simples (capsules) nas outras posições.
    """
    ax, ay, az = outer_dims
    max_r = max(outer_dims) * 1.6
    cutters = []

    # Cluster Sphera no topo (z máximo)
    top_center = np.array([0.0, 0.0, az])
    top_dir = np.array([0.0, 0.0, 1.0])
    cutters.extend(_flower_vent_cluster(
        top_center, top_dir,
        petal_count=8,
        petal_radius=radius * 0.7,
        petal_length=radius * 2.8,
        center_offset=radius * 0.7,
        depth=max_r,
    ))

    # Slots ovais nos demais pontos
    remaining = max(0, n_holes - 8)
    placed = 0
    for i in range(remaining * 2):
        idx = i + 0.5
        phi = np.arccos(1 - 2 * idx / (remaining * 4))
        theta = np.pi * (1 + 5 ** 0.5) * idx
        x = np.sin(phi) * np.cos(theta)
        y = np.sin(phi) * np.sin(theta)
        z = np.cos(phi)

        # ignora hemisfério inferior + zona do cluster topo (z muito alto)
        if z < 0.30 or z > 0.85:
            continue
        if abs(y) > 0.85 and z < 0.6:
            continue
        if x > 0.6 and z < 0.5:
            continue

        center = np.array([x * ax, y * ay, z * az])
        direction = np.array([x, y, z])
        direction = direction / np.linalg.norm(direction)

        cyl = trimesh.creation.cylinder(radius=radius, height=max_r, sections=16)
        z_axis = np.array([0, 0, 1])
        rot_axis = np.cross(z_axis, direction)
        rot_norm = np.linalg.norm(rot_axis)
        if rot_norm > 1e-9:
            angle = np.arccos(np.clip(np.dot(z_axis, direction), -1, 1))
            R = trimesh.transformations.rotation_matrix(angle, rot_axis / rot_norm)
            cyl.apply_transform(R)
        cyl.apply_translation(center)
        cutters.append(cyl)
        placed += 1

        if placed >= remaining:
            break

    return cutters


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
