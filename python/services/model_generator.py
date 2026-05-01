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
    # condition_type: 'plagiocephaly' | 'brachycephaly' | None
    # determina o formato da trim line superior (Sprout3D approach):
    #   plagio → corte oval (E-D) que guia simetria lateral
    #   braqui → corte alongado curvo (F-O) que estimula crescimento
    #            longitudinal corrigindo achatamento occipital
    condition_type = m.get("condition_type")
    cvai = m.get("cvai")
    affected_side = m.get("affected_side")

    outer_dims = np.array([ax + offset, ay + offset, az + offset * 0.5])
    inner_dims = outer_dims - wall

    outer = _skull_shape(*outer_dims, subdivisions=4)
    # A casca interna sempre tem relief occipital (capacete pediátrico
    # nunca encosta na nuca direto — ali é a zona que mais cresce).
    # Quando há condition_type + side + cvai, intensifica o relief no
    # lado achatado; sem isso, aplica relief simétrico padrão.
    inner = _skull_shape(
        *inner_dims, subdivisions=4,
        relief_occipital=True,
        affected_side=affected_side,
        cvai=float(cvai) if cvai is not None else None,
        wall=wall,
    )

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

    if condition_type:
        trim_cutter = _top_trim_line(condition_type, outer_dims)
        if trim_cutter is not None:
            try:
                helmet = difference([helmet, trim_cutter])
            except ValueError:
                helmet.process(validate=True)
                try:
                    helmet = difference([helmet, trim_cutter])
                except ValueError:
                    pass

    # Pós-processamento em duas etapas:
    # 1) Taubin global (lamb+, nu-) preserva volume — arredonda junções
    #    do tipo casca↔chanfro, junção pescoço↔cabeça do pino cogumelo.
    # 2) Smoothing local intenso nos vértices das bordas abertas
    #    (perímetros de aberturas: trim, arch, ear, slots). Sem isso
    #    a borda interna do corte fica viva e arranha o couro cabeludo.
    helmet = _smooth_final(helmet, iterations=4)
    helmet = _fillet_open_edges(helmet, iterations=4, factor=0.35, ring_depth=2)
    return helmet


def _smooth_final(mesh: trimesh.Trimesh, iterations: int = 4) -> trimesh.Trimesh:
    """
    Taubin smoothing global. Volume-preserving (lamb+, nu-) — capacete
    não encolhe perceptivelmente em até ~6 iterações. Aceita meshes
    com aberturas (capacete final tem trim/arch/ear holes).
    """
    try:
        smoothed = mesh.copy()
        trimesh.smoothing.filter_taubin(
            smoothed, lamb=0.55, nu=-0.58, iterations=iterations,
        )
        if len(smoothed.faces) > 0 and len(smoothed.vertices) > 0:
            return smoothed
    except Exception:
        pass
    return mesh


def _fillet_open_edges(
    mesh: trimesh.Trimesh,
    iterations: int = 4,
    factor: float = 0.35,
    ring_depth: int = 2,
) -> trimesh.Trimesh:
    """
    Fillet local nas bordas abertas. Identifica arestas usadas por
    apenas 1 face (perímetros das aberturas), expande para um anel
    de ring_depth vizinhos, e aplica Laplacian relaxation só nesses
    vértices. Resultado: bordas dos cortes ficam arredondadas, o
    centro da casca permanece intacto.
    """
    if len(mesh.faces) == 0:
        return mesh

    edges_sorted = np.sort(mesh.edges, axis=1)
    unique, counts = np.unique(edges_sorted, axis=0, return_counts=True)
    boundary_edges = unique[counts == 1]
    if len(boundary_edges) == 0:
        return mesh

    n = len(mesh.vertices)
    # Adjacência v→vizinhos (vetorizado a partir das faces)
    adjacency = [set() for _ in range(n)]
    for f in mesh.faces:
        a, b, c = int(f[0]), int(f[1]), int(f[2])
        adjacency[a].update((b, c))
        adjacency[b].update((a, c))
        adjacency[c].update((a, b))

    affected = set(int(v) for v in np.unique(boundary_edges))
    for _ in range(ring_depth):
        new_affected = set(affected)
        for v in affected:
            new_affected.update(adjacency[v])
        affected = new_affected
    affected_arr = np.array(sorted(affected), dtype=np.int64)

    out = mesh.copy()
    verts = out.vertices.copy()
    for _ in range(iterations):
        new_pos = verts.copy()
        for vid in affected_arr:
            neigh = list(adjacency[vid])
            if neigh:
                avg = verts[neigh].mean(axis=0)
                new_pos[vid] = (1 - factor) * verts[vid] + factor * avg
        verts = new_pos
    out.vertices = verts
    return out


def generate_from_scan(
    scan_mesh: trimesh.Trimesh,
    offset_mm: float = 4.0,
    wall_mm: float = 3.0,
    vent_holes: int = 24,
    vent_radius_mm: float = 4.0,
    frontal_opening: bool = True,
    ear_holes: bool = True,
    chamfer_bottom: bool = True,
    condition_type: str | None = None,
    cvai: float | None = None,
    affected_side: str | None = None,
    use_landmarks: bool = True,
) -> trimesh.Trimesh:
    """
    Constrói capacete a partir de um scan 3D da cabeça.

    Quando cvai+affected_side são fornecidos, aplica offsets variáveis
    por região (relief zone no lado achatado, contact zone no contralateral).
    Quando use_landmarks=True, ancora trim/aberturas em landmarks
    detectados no scan em vez de proporções da bbox.
    """
    if not scan_mesh.is_watertight:
        trimesh.repair.fill_holes(scan_mesh)

    scan_mesh.fix_normals()
    normals = scan_mesh.vertex_normals

    landmarks = _detect_landmarks(scan_mesh) if use_landmarks else None

    outer_offset = _per_vertex_offsets(
        scan_mesh, base_offset=offset_mm + wall_mm,
        cvai=cvai, side=affected_side,
    )
    inner_offset = _per_vertex_offsets(
        scan_mesh, base_offset=offset_mm,
        cvai=cvai, side=affected_side,
    )

    outer = scan_mesh.copy()
    outer.vertices = scan_mesh.vertices + normals * outer_offset[:, None]
    outer.fix_normals()

    inner = scan_mesh.copy()
    inner.vertices = scan_mesh.vertices + normals * inner_offset[:, None]
    inner.fix_normals()

    helmet = difference([outer, inner])

    bounds = scan_mesh.bounding_box.extents
    outer_dims = np.array(bounds) / 2 + offset_mm + wall_mm

    if vent_holes > 0:
        for cyl in _vent_cylinders(outer_dims, vent_holes, vent_radius_mm):
            try:
                helmet = difference([helmet, cyl])
            except ValueError:
                continue

    if ear_holes:
        ear_cuts = (
            _ear_cutters_from_landmarks(landmarks)
            if landmarks else _ear_cutters(outer_dims)
        )
        for cut in ear_cuts:
            try:
                helmet = difference([helmet, cut])
            except ValueError:
                continue

    if frontal_opening:
        arch = (
            _frontal_arch_cutter_from_landmarks(landmarks)
            if landmarks else _frontal_arch_cutter(outer_dims)
        )
        try:
            helmet = difference([helmet, arch])
        except ValueError:
            pass

    if chamfer_bottom:
        try:
            helmet = difference([helmet, _bottom_chamfer_cutter(outer_dims)])
        except ValueError:
            pass

    if condition_type:
        trim = (
            _top_trim_line_from_landmarks(condition_type, landmarks)
            if landmarks else _top_trim_line(condition_type, outer_dims)
        )
        if trim is not None:
            try:
                helmet = difference([helmet, trim])
            except ValueError:
                pass

    helmet = _smooth_final(helmet, iterations=4)
    helmet = _fillet_open_edges(helmet, iterations=4, factor=0.35, ring_depth=2)
    return helmet


# ---------------------------------------------------------------------------
# Landmarks e offsets por região
# ---------------------------------------------------------------------------

def _detect_landmarks(mesh: trimesh.Trimesh) -> dict:
    """
    Detecção heurística de landmarks a partir de bounding box + simetria
    aproximada do scan. Convenção de eixos: +x frente, +y direita, +z topo.

    Retorna dict com pontos 3D (mm) + dims locais. Não usa ML —
    extremos da bounding box e amostragem dirigida via ray casting.
    """
    bounds = mesh.bounds  # 2x3
    center = (bounds[0] + bounds[1]) / 2
    extents = bounds[1] - bounds[0]
    ax, ay, az = extents / 2

    v = mesh.vertices
    # Translada para centro da bbox (não destrói o mesh original — só pra
    # trabalhar em coords centradas)
    vc = v - center

    # vértex: ponto de maior z
    idx_top = int(np.argmax(vc[:, 2]))
    vertex = v[idx_top]

    # ínion (occipital extremo): menor x
    idx_back = int(np.argmin(vc[:, 0]))
    inion = v[idx_back]

    # násio aproximado: maior x, z médio-baixo
    front_mask = vc[:, 0] > ax * 0.7
    if front_mask.any():
        candidates = vc[front_mask]
        z_target = -az * 0.1  # um pouco abaixo do equador
        idx_local = int(np.argmin(np.abs(candidates[:, 2] - z_target)))
        nasion = v[front_mask][idx_local]
    else:
        nasion = center + np.array([ax, 0, 0])

    # tragus E/D: pontos laterais extremos em z médio
    z_eq_mask = np.abs(vc[:, 2]) < az * 0.25
    if z_eq_mask.any():
        sub = vc[z_eq_mask]
        idx_r = int(np.argmax(sub[:, 1]))
        idx_l = int(np.argmin(sub[:, 1]))
        tragus_r = v[z_eq_mask][idx_r]
        tragus_l = v[z_eq_mask][idx_l]
    else:
        tragus_r = center + np.array([0, ay, 0])
        tragus_l = center + np.array([0, -ay, 0])

    # glabela: frontal alto (entre as sobrancelhas)
    front_high_mask = (vc[:, 0] > ax * 0.6) & (vc[:, 2] > az * 0.2)
    if front_high_mask.any():
        sub = vc[front_high_mask]
        idx_g = int(np.argmin(np.abs(sub[:, 1])))  # mais central em y
        glabela = v[front_high_mask][idx_g]
    else:
        glabela = center + np.array([ax * 0.85, 0, az * 0.4])

    return {
        "center": center,
        "extents": extents,
        "vertex": vertex,
        "inion": inion,
        "nasion": nasion,
        "tragus_r": tragus_r,
        "tragus_l": tragus_l,
        "glabela": glabela,
    }


def _per_vertex_offsets(
    mesh: trimesh.Trimesh,
    base_offset: float,
    cvai: float | None = None,
    side: str | None = None,
) -> np.ndarray:
    """
    Calcula offset por vértice. Quando cvai+side disponíveis, aplica:
      - relief zone no occipital do lado achatado (offset maior)
      - contact zone no occipital contralateral (offset menor)
    Severidade dosada pelo CVAI (Argenta).
    """
    n = len(mesh.vertices)
    offsets = np.full(n, base_offset, dtype=float)

    if cvai is None or side is None or cvai < 1.0:
        return offsets

    # Severidade → modulação de offset (mm relativos ao base)
    if cvai < 3.5:
        relief = 1.0
        contact = -0.5
    elif cvai < 6.5:
        relief = 2.5
        contact = -1.0
    elif cvai < 8.75:
        relief = 4.0
        contact = -1.5
    else:
        relief = 5.5
        contact = -2.0

    bounds = mesh.bounds
    center = (bounds[0] + bounds[1]) / 2
    ax, ay, az = (bounds[1] - bounds[0]) / 2
    if ax < 1e-3 or ay < 1e-3:
        return offsets

    v = mesh.vertices - center
    nx = v[:, 0] / ax       # frente=+, trás=-
    ny = v[:, 1] / ay       # direita=+, esquerda=-
    nz = v[:, 2] / az

    affected_y = +1.0 if side == "right" else -1.0
    # Gaussian centrada no quadrante posterior do lado afetado
    posterior = np.maximum(-nx, 0)             # 0..1 só na traseira
    side_match_relief = np.maximum(ny * affected_y, 0)
    side_match_contact = np.maximum(-ny * affected_y, 0)
    z_band = np.exp(-((nz - 0.0) ** 2) / 0.6)  # banda em torno do equador

    relief_field = posterior ** 2 * side_match_relief * z_band
    contact_field = posterior ** 2 * side_match_contact * z_band

    offsets += relief * relief_field + contact * contact_field
    # Garante que offset interno nunca fica negativo (capacete tem que
    # caber sobre a cabeça)
    offsets = np.clip(offsets, 0.5, base_offset + max(relief, 0) * 1.2)
    return offsets


def _frontal_arch_cutter_from_landmarks(landmarks: dict) -> trimesh.Trimesh:
    """Arch frontal ancorado em glabela + tragi (aprox 8mm acima da glabela)."""
    glabela = landmarks["glabela"]
    extents = landmarks["extents"]
    ax, ay, az = extents / 2
    radius = az * 1.2
    cyl = trimesh.creation.cylinder(radius=radius, height=ay * 2.6, sections=48)
    R = trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0])
    cyl.apply_transform(R)
    # Posiciona o cilindro de modo que seu topo passe ~8mm acima da glabela
    cz = glabela[2] - radius - 8.0
    cyl.apply_translation([glabela[0], landmarks["center"][1], cz])
    return cyl


def _ear_cutters_from_landmarks(landmarks: dict):
    """Capsules nas posições reais dos tragus (5mm de folga)."""
    extents = landmarks["extents"]
    ay = extents[1] / 2
    az = extents[2] / 2
    cuts = []
    for tragus in (landmarks["tragus_r"], landmarks["tragus_l"]):
        cap = trimesh.creation.capsule(
            radius=ay * 0.18,
            height=az * 0.55,
            count=[12, 12],
        )
        R = trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0])
        cap.apply_transform(R)
        cap.apply_translation(tragus)
        cuts.append(cap)
    return cuts


def _top_trim_line_from_landmarks(condition_type: str, landmarks: dict):
    """Trim line centrada no vértex (não na bbox)."""
    vertex = landmarks["vertex"]
    extents = landmarks["extents"]
    cutter = _top_trim_line(condition_type, extents / 2)
    if cutter is None:
        return None
    # _top_trim_line já posiciona em az*0.95; recoloca exatamente sobre o vértex
    cutter.apply_translation([
        vertex[0] - 0,
        vertex[1] - 0,
        vertex[2] - extents[2] / 2 * 0.95,
    ])
    return cutter


# ---------------------------------------------------------------------------
# Anatomia (B)
# ---------------------------------------------------------------------------

def _skull_shape(
    ax, ay, az, subdivisions=4,
    relief_occipital: bool = False,
    affected_side: str | None = None,
    cvai: float | None = None,
    wall: float = 3.0,
) -> trimesh.Trimesh:
    """
    Forma ovóide com warp anatômico:
      - testa elevada (frente +x mais alta no topo)
      - occipital arredondado
      - têmporas levemente côncavas em z médio

    Quando relief_occipital=True (uso interno do capacete), aplica warp
    adicional puxando o occipital pra dentro = mais espaço entre casca
    interna e a nuca real do bebê. Sem isso, o capacete marcaria a nuca.
    Se cvai+affected_side fornecidos, intensifica relief assimétrico no
    lado achatado (Argenta).
    """
    sphere = trimesh.creation.icosphere(subdivisions=subdivisions)
    v = sphere.vertices.copy()

    # escala base elipsoidal
    v *= np.array([ax, ay, az])

    # warp 1: testa elevada (+x correlaciona com +z)
    front = np.clip(v[:, 0] / ax, -1, 1)
    v[:, 2] += np.maximum(front, 0) * az * 0.10

    # warp 2: occipital arredondado (parte traseira mais "cheia")
    back = np.clip(-v[:, 0] / ax, -1, 1)
    v[:, 0] -= np.maximum(back, 0) ** 2 * ax * 0.06

    # warp 3: têmporas levemente côncavas em z médio
    z_norm = v[:, 2] / az
    side = np.abs(v[:, 1]) / ay
    temple = side * np.exp(-(z_norm * 2.5) ** 2)
    v[:, 1] *= 1 - temple * 0.04

    if relief_occipital:
        # Relief simétrico padrão: occipital recuado em direção ao
        # centro. Garante que a nuca encontra ar, não casca. Banda em
        # z em torno do equador (onde a nuca encosta no apoio).
        nx = v[:, 0] / max(ax, 1e-6)
        nz = v[:, 2] / max(az, 1e-6)
        # expoente menor → relief mais distribuído (sente como camada
        # contínua de ar atrás, não só num pontinho central)
        posterior = np.maximum(-nx, 0) ** 1.2
        z_band = np.exp(-((nz - 0.05) ** 2) / 0.5)
        relief_base = wall * 0.7        # ~2mm com wall=3mm
        v[:, 0] += posterior * z_band * relief_base   # puxa pra +x = pra dentro

        # Relief assimétrico se condition + side + cvai disponíveis
        if affected_side in ("left", "right") and cvai is not None and cvai >= 1.0:
            if cvai < 3.5:
                extra = wall * 0.5
            elif cvai < 6.5:
                extra = wall * 0.9
            elif cvai < 8.75:
                extra = wall * 1.4
            else:
                extra = wall * 1.8
            ny = v[:, 1] / max(ay, 1e-6)
            sign = +1 if affected_side == "right" else -1
            # expoente baixo → o lado afetado todo recebe relief, não
            # só vértices muito laterais
            side_field = np.maximum(sign * ny, 0) ** 0.8
            v[:, 0] += posterior * z_band * side_field * extra

    sphere.vertices = v
    return sphere


# ---------------------------------------------------------------------------
# Aberturas (A)
# ---------------------------------------------------------------------------

def _rounded_plate(thickness, extension, width, sections=16):
    """
    Plate (aba) com cantos arredondados — substitui box pra evitar
    pontas vivas. Eixos do mesh resultante: thickness em X, extension
    em Y, width em Z.

    Construção: caixa central + 4 cilindros nos cantos + 4 caixas de
    cantilever pra preencher entre os cilindros. O resultado tem
    todas as bordas verticais arredondadas com raio min(width, extension)/2.
    """
    radius = min(width, extension) * 0.4
    # box central reduzida pra deixar espaço pros cantos arredondados
    inner_ext = max(0.001, extension - 2 * radius)
    inner_wid = max(0.001, width - 2 * radius)

    parts = []
    if inner_ext > 0.001 and inner_wid > 0.001:
        center = trimesh.creation.box(extents=(thickness, inner_ext, inner_wid))
        parts.append(center)
    # 2 boxes laterais (preenchem ao longo do width)
    if inner_wid > 0.001:
        side1 = trimesh.creation.box(extents=(thickness, 2 * radius, inner_wid))
        side1.apply_translation([0, +(extension - 2 * radius) / 2, 0])
        parts.append(side1)
        side2 = trimesh.creation.box(extents=(thickness, 2 * radius, inner_wid))
        side2.apply_translation([0, -(extension - 2 * radius) / 2, 0])
        parts.append(side2)
    # 2 boxes superiores e inferiores
    if inner_ext > 0.001:
        top = trimesh.creation.box(extents=(thickness, inner_ext, 2 * radius))
        top.apply_translation([0, 0, +(width - 2 * radius) / 2])
        parts.append(top)
        bot = trimesh.creation.box(extents=(thickness, inner_ext, 2 * radius))
        bot.apply_translation([0, 0, -(width - 2 * radius) / 2])
        parts.append(bot)
    # 4 cilindros nos cantos (eixo X = thickness)
    R_x = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0])
    for sy, sz in [(+1, +1), (+1, -1), (-1, +1), (-1, -1)]:
        cyl = trimesh.creation.cylinder(radius=radius, height=thickness, sections=sections)
        cyl.apply_transform(R_x)
        cyl.apply_translation([
            0,
            sy * (extension / 2 - radius),
            sz * (width / 2 - radius),
        ])
        parts.append(cyl)

    plate = parts[0]
    for p in parts[1:]:
        plate = union([plate, p])
    return plate


def _anchor_pin(y_pos, z_pos, side='front',
                base_radius=4.5, neck_radius=2.5, head_radius=4.5,
                base_height=2.0, neck_length=3.5, head_length=2.5):
    """
    Pino de engate (anchor pin) tipo cogumelo, integrado direto à
    superfície externa da carcaça. Sistema MyCRO Band: a tira
    elástica (item separado, não impresso) tem um clipe na ponta
    com fenda interna que abraça o pino por pressão (snap-fit).
    O travamento é mantido pela tensão da tira elástica.

    Eixo do pino = direção radial-out (sai pra fora da carcaça).
    Geometria:
      base   : cilindro curto (transição suave casca → pino)
      neck   : cilindro fino (onde o clipe abraça)
      head   : cilindro maior (segura o clipe contra a tensão)

    side='front' posiciona em x≈0 levemente positivo; 'back'
    em x≈0 levemente negativo (não causa overlap entre peças).
    """
    norm = (y_pos ** 2 + z_pos ** 2) ** 0.5
    if norm < 0.001:
        return None
    ny, nz = y_pos / norm, z_pos / norm
    angle = np.arctan2(nz, ny)
    R = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])

    # Frame local: eixo Y_local = radial-out (pino sai pra fora).
    # Construo cilindros em Z e roto Z→Y_local.
    R_zy = trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0])
    # +90° em X leva +Z → -Y; -90° em X leva +Z → +Y. Quero +Y.
    R_zy = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])

    parts = []
    # base: começa em Y_local=0, vai até Y_local=base_height
    base = trimesh.creation.cylinder(radius=base_radius, height=base_height, sections=20)
    base.apply_transform(R_zy)
    base.apply_translation([0, base_height / 2, 0])
    parts.append(base)
    # neck: continua acima da base
    neck = trimesh.creation.cylinder(radius=neck_radius, height=neck_length, sections=16)
    neck.apply_transform(R_zy)
    neck.apply_translation([0, base_height + neck_length / 2, 0])
    parts.append(neck)
    # head: cilindro maior na ponta
    head = trimesh.creation.cylinder(radius=head_radius, height=head_length, sections=20)
    head.apply_transform(R_zy)
    head.apply_translation([0, base_height + neck_length + head_length / 2, 0])
    parts.append(head)

    pin = parts[0]
    for c in parts[1:]:
        try:
            pin = union([pin, c])
        except Exception:
            continue

    # Aplica rotação radial + posiciona na superfície da carcaça
    pin.apply_transform(R)
    # Pequeno offset em X para evitar splits indesejados quando pino
    # é unido à peça frontal/traseira (lugar perto do plano de corte)
    cx = +0.5 if side == 'front' else -0.5
    pin.apply_translation([cx, y_pos, z_pos])
    return pin


def _guide_groove_cutter(y_pos, z_pos, length_axial=22.0, depth=1.2,
                          width_tangential=10.0, side='front'):
    """
    Canal de guia (rebaixo): cápsula rasa na superfície externa que
    guia a tira lateralmente, evitando deslocamento. O canal corre
    no eixo X (axial = direção do split frente↔trás).

    Eixo da cápsula: X (axial). Dimensões locais:
      length_axial      → comprimento na direção do split (X)
      depth             → profundidade radial-in (entra na casca)
      width_tangential  → largura tangencial (Z_local)
    """
    norm = (y_pos ** 2 + z_pos ** 2) ** 0.5
    if norm < 0.001:
        return None
    ny, nz = y_pos / norm, z_pos / norm
    angle = np.arctan2(nz, ny)
    R = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])

    # Cápsula em Z (eixo longo), depois roda Z→X (axial)
    cap = trimesh.creation.capsule(
        radius=width_tangential / 2,
        height=max(0.001, length_axial - width_tangential),
        count=[12, 12],
    )
    R_zx = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0])
    cap.apply_transform(R_zx)
    # Achata no eixo radial-out (Y_local) para virar canal raso
    # depois de aplicar R, então fazemos no frame local antes
    # multiplicando vertices.
    flat = depth / max(1e-6, width_tangential / 2)
    # No frame local: eixo radial-out é Y. Após R_zx, capsule está
    # com eixo X axial; suas dimensões Y/Z (= largura/altura) são
    # ainda Y/Z. Achata Y para profundidade desejada.
    cap.vertices[:, 1] *= flat

    # Posiciona: centro da capsule fica na superfície (y_pos, z_pos);
    # como achatamos em Y, o canal entra apenas `depth` na casca
    cap.apply_transform(R)
    # Pequeno offset axial para o canal terminar no plano de corte;
    # x=±length/3 desloca o canal para o interior da peça
    side_x = +length_axial / 3 if side == 'front' else -length_axial / 3
    cap.apply_translation([side_x, y_pos, z_pos])
    return cap


def _strap_anchor(y_pos, z_pos, lug_thickness=6.0, lug_extension=14.0,
                  lug_width=22.0, slot_length=16.0, slot_height=4.0,
                  side='front'):
    """
    Âncora da tira (tipo D-ring rígido): plate com uma fenda oblonga
    passante em X. A extremidade da tira de tecido/velcro é amarrada
    ou costurada nesta âncora. A outra extremidade passa pela fivela
    slide da peça contralateral.

    side='front' coloca o plate em x>=0; 'back' em x<=0.
    """
    norm = (y_pos ** 2 + z_pos ** 2) ** 0.5
    if norm < 0.001:
        return None
    ny, nz = y_pos / norm, z_pos / norm
    angle = np.arctan2(nz, ny)
    R = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])

    cy = y_pos + ny * lug_extension / 2
    cz = z_pos + nz * lug_extension / 2
    cx = +lug_thickness / 2 if side == 'front' else -lug_thickness / 2

    plate = _rounded_plate(lug_thickness, lug_extension, lug_width)
    plate.apply_transform(R)
    plate.apply_translation([cx, cy, cz])

    # Uma fenda oblonga passante (tira passa por aqui e é fixada)
    R_zx = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0])
    cutters_local = []
    slot_box = trimesh.creation.box(extents=(
        lug_thickness * 1.8,
        slot_height,
        max(0.001, slot_length - slot_height),
    ))
    cutters_local.append(slot_box)
    for s in (-1, +1):
        cap = trimesh.creation.cylinder(
            radius=slot_height / 2,
            height=lug_thickness * 1.8, sections=16,
        )
        cap.apply_transform(R_zx)
        cap.apply_translation([0, 0, s * (slot_length - slot_height) / 2])
        cutters_local.append(cap)

    out = plate
    for c in cutters_local:
        c.apply_transform(R)
        c.apply_translation([cx, cy, cz])
        try:
            out = difference([out, c])
        except Exception:
            continue
    return out


def _slide_buckle_plate(y_pos, z_pos, lug_thickness=6.0, lug_extension=18.0,
                        lug_width=28.0, slot_length=16.0, slot_height=4.0,
                        bar_width=4.0, side='back'):
    """
    Fivela slide / ladder lock: plate com 2 fendas oblongas paralelas
    separadas por uma barra central. A tira passa pela fenda externa,
    dobra sobre a barra central, sai pela fenda interna e é tensionada.
    Fricção da dobra mantém o ajuste — sistema de ajuste contínuo.

    A sobra da tira (após tensionar) é fixada por um keeper elástico
    fornecido como item separado (não impresso): loop de elástico que
    o usuário desliza sobre a sobra para evitar que se solte.

    side='back' coloca o plate em x<=0; 'front' em x>=0.
    """
    norm = (y_pos ** 2 + z_pos ** 2) ** 0.5
    if norm < 0.001:
        return None
    ny, nz = y_pos / norm, z_pos / norm
    angle = np.arctan2(nz, ny)
    R = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])

    cy = y_pos + ny * lug_extension / 2
    cz = z_pos + nz * lug_extension / 2
    cx = -lug_thickness / 2 if side == 'back' else +lug_thickness / 2

    plate = _rounded_plate(lug_thickness, lug_extension, lug_width)
    plate.apply_transform(R)
    plate.apply_translation([cx, cy, cz])

    # 2 fendas distribuídas em Z_local (tangencial), separadas pela
    # barra central de largura bar_width
    slot_offset = (bar_width + slot_height) / 2
    R_zx = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0])

    cutters_local = []
    for sign in (-1, +1):
        center_z = sign * slot_offset
        slot_box = trimesh.creation.box(extents=(
            lug_thickness * 1.8,
            slot_height,
            max(0.001, slot_length - slot_height),
        ))
        slot_box.apply_translation([0, 0, center_z])
        cutters_local.append(slot_box)
        for s in (-1, +1):
            cap = trimesh.creation.cylinder(
                radius=slot_height / 2,
                height=lug_thickness * 1.8, sections=16,
            )
            cap.apply_transform(R_zx)
            cap.apply_translation([
                0, 0,
                center_z + s * (slot_length - slot_height) / 2,
            ])
            cutters_local.append(cap)

    out = plate
    for c in cutters_local:
        c.apply_transform(R)
        c.apply_translation([cx, cy, cz])
        try:
            out = difference([out, c])
        except Exception:
            continue
    return out


def _slide_latch_male(y_pos, z_pos, lug_thickness=8.0, lug_extension=14.0,
                      lug_width=22.0, neck_radius=2.5, head_radius=4.5,
                      neck_length=12.0, head_length=3.0):
    """
    Macho: aba (plate) totalmente na peça frontal (centrada em x=+T/2)
    com pino cogumelo apontando para -X. O pino atravessa o plate da
    fêmea e a head fica do outro lado, travando como keyhole Ottobock.

    Restrições para travar:
      neck_length >= 1.5 * lug_thickness  (atravessa o plate fêmea com folga)
      head_radius > neck_radius           (head segura do outro lado)
    """
    norm = (y_pos ** 2 + z_pos ** 2) ** 0.5
    if norm < 0.001:
        return None
    ny, nz = y_pos / norm, z_pos / norm
    angle = np.arctan2(nz, ny)
    R = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])

    cy = y_pos + ny * lug_extension / 2
    cz = z_pos + nz * lug_extension / 2
    cx = +lug_thickness / 2     # plate inteiro em x>=0 (frontal)

    plate = _rounded_plate(lug_thickness, lug_extension, lug_width)
    plate.apply_transform(R)
    plate.apply_translation([cx, cy, cz])

    # Pino: neck em Z + head deslocada em +Z. Depois rotação Z→-X.
    neck = trimesh.creation.cylinder(radius=neck_radius, height=neck_length, sections=16)
    head = trimesh.creation.cylinder(radius=head_radius, height=head_length, sections=20)
    head.apply_translation([0, 0, neck_length / 2 + head_length / 2])
    pin = union([neck, head])

    # Rotação -90° em Y leva +Z → -X. Após isso, conjunto (pré-translação):
    #   neck:  x ∈ [-N/2, +N/2]
    #   head:  x ∈ [-(N/2+H), -N/2]
    #   total: x ∈ [-(N/2+H), +N/2]
    R_pin = trimesh.transformations.rotation_matrix(-np.pi / 2, [0, 1, 0])
    pin.apply_transform(R_pin)
    # Quero base do neck (x=+N/2 pré-translação) em x=cx (dentro do plate
    # macho); ponta da head fica em cx - N - H (atrás do plate fêmea).
    pin.apply_translation([cx - neck_length / 2, cy, cz])

    try:
        return union([plate, pin])
    except Exception:
        return None


def _slide_latch_female(y_pos, z_pos, lug_thickness=8.0, lug_extension=14.0,
                        lug_width=22.0, neck_radius=2.5, head_radius=4.5,
                        slot_length=10.0, clearance=0.4):
    """
    Fêmea: aba (plate) totalmente na peça traseira (centrada em x=-T/2)
    com slot keyhole passante em X. O pino do macho entra pelo big_hole,
    desliza tangencialmente para o narrow_slot, ficando preso pela head.
    """
    norm = (y_pos ** 2 + z_pos ** 2) ** 0.5
    if norm < 0.001:
        return None
    ny, nz = y_pos / norm, z_pos / norm
    angle = np.arctan2(nz, ny)
    R = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])

    cy = y_pos + ny * lug_extension / 2
    cz = z_pos + nz * lug_extension / 2
    cx = -lug_thickness / 2    # plate inteiro em x<=0 (traseira)

    plate = _rounded_plate(lug_thickness, lug_extension, lug_width)
    plate.apply_transform(R)
    plate.apply_translation([cx, cy, cz])

    # Construo cutters em frame local (X axial passante, Z tangencial),
    # depois aplico R + translação. Mais limpo que o cálculo manual.
    R_zx = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0])

    cutters_local = []
    # big hole: +Z_local
    big = trimesh.creation.cylinder(
        radius=head_radius + clearance,
        height=lug_thickness * 1.6, sections=20,
    )
    big.apply_transform(R_zx)
    big.apply_translation([0, 0, +slot_length / 2])
    cutters_local.append(big)

    # narrow slot: caixa central com 2 capsule caps nas pontas
    nr = neck_radius + clearance
    narrow = trimesh.creation.box(extents=(
        lug_thickness * 1.6, 2 * nr, slot_length,
    ))
    cutters_local.append(narrow)

    for sign in (-1, +1):
        cap = trimesh.creation.cylinder(
            radius=nr, height=lug_thickness * 1.6, sections=16,
        )
        cap.apply_transform(R_zx)
        cap.apply_translation([0, 0, sign * slot_length / 2])
        cutters_local.append(cap)

    plate_with_slot = plate
    for c in cutters_local:
        c.apply_transform(R)
        c.apply_translation([cx, cy, cz])
        try:
            plate_with_slot = difference([plate_with_slot, c])
        except Exception:
            continue

    return plate_with_slot


def split_into_two_parts(
    helmet: trimesh.Trimesh,
    outer_dims,
    pin_count: int = 2,
    closure_type: str = "snap_pin",
    use_slide_latch: bool = True,           # legado, lido se closure_type='slide_latch'
    pin_radius: float = 2.5,                # parafuso M5 (modo legado)
    lug_extension: float = 14.0,
    lug_thickness: float = 8.0,
    lug_width: float = 22.0,
):
    """
    Divide o capacete em duas peças (frontal e traseira) por um plano
    coronal (YZ em x=0).

    closure_type:
      'snap_pin' (padrão) — sistema MyCRO Band: anchor pin (cogumelo)
        integrado direto na carcaça externa em cada lateral, com
        canal de guia raso. Tira elástica + clipe snap-fit são itens
        separados (não impressos): o clipe na ponta da tira abraça
        o pino por pressão e a tensão da tira mantém o travamento.
      'slide_buckle' — fivela slide com 2 fendas e barra central
        na peça traseira + âncora de tira (D-ring) na peça frontal.
        Tira de tecido/velcro com keeper elástico.
      'slide_latch' — keyhole Ottobock: pino cogumelo + slot keyhole.
        Fechamento rígido por encaixe + rotação tangencial.
      'simple' — lug com furo passante para parafuso M5.

    Layout: 2 conectores laterais (z=0, y=±ay) — posições com casca
    real (não em zona cortada por trim/arch/ear). Pin_count=4 adiciona
    par superior z=+az*0.4, ainda dentro da casca remanescente.
    """
    ax, ay, az = outer_dims

    # Layout: 2 conectores laterais médios (lado D + lado E).
    # z=0 fica acima da abertura de orelhas (que está em z=-az*0.55)
    # e abaixo da trim line do topo (que corta z>az*0.4 aprox).
    lug_layout = [
        (+ay * 0.95, 0.0),    # lateral direita
        (-ay * 0.95, 0.0),    # lateral esquerda
    ]
    if pin_count >= 4:
        # Par superior (acima dos laterais), ainda longe da trim line
        lug_layout.append((+ay * 0.55, +az * 0.40))
        lug_layout.append((-ay * 0.55, +az * 0.40))
    lug_layout = lug_layout[:pin_count]

    # Caixas removedoras do split coronal
    back_remover = trimesh.creation.box(extents=(ax * 4, ay * 4, az * 4))
    back_remover.apply_translation([-ax * 2 - 0.001, 0, 0])
    front_remover = trimesh.creation.box(extents=(ax * 4, ay * 4, az * 4))
    front_remover.apply_translation([ax * 2 + 0.001, 0, 0])

    # Split puro primeiro
    front_part = difference([helmet, back_remover])
    back_part = difference([helmet, front_remover])

    # Resolve closure_type (legado: use_slide_latch=True força slide_latch
    # mesmo com closure_type padrão; útil pra clientes antigos da API)
    effective_closure = closure_type
    if effective_closure not in ("snap_pin", "slide_buckle", "slide_latch", "simple"):
        effective_closure = "snap_pin"
    if use_slide_latch is False and effective_closure == "slide_latch":
        effective_closure = "simple"

    # Adiciona os fechos a cada metade independentemente
    for (y_surf, z_surf) in lug_layout:
        if effective_closure == "snap_pin":
            # MyCRO: pino direto na carcaça externa de cada metade.
            # Cada peça (frontal e traseira) recebe seu próprio pino;
            # uma tira elástica externa conecta os pinos D↔D e E↔E.
            pin_front = _anchor_pin(y_surf, z_surf, side='front')
            pin_back = _anchor_pin(y_surf, z_surf, side='back')
            if pin_front is None or pin_back is None:
                continue
            try:
                front_part = union([front_part, pin_front])
            except Exception:
                pass
            try:
                back_part = union([back_part, pin_back])
            except Exception:
                pass
            # Canal de guia: rebaixo entre o pino e a borda do split,
            # facilita a tira correr alinhada
            groove_f = _guide_groove_cutter(y_surf, z_surf, side='front')
            groove_b = _guide_groove_cutter(y_surf, z_surf, side='back')
            if groove_f is not None:
                try:
                    front_part = difference([front_part, groove_f])
                except Exception:
                    pass
            if groove_b is not None:
                try:
                    back_part = difference([back_part, groove_b])
                except Exception:
                    pass
        elif effective_closure == "slide_buckle":
            anchor = _strap_anchor(
                y_surf, z_surf,
                lug_thickness=max(6.0, lug_thickness * 0.75),
                lug_extension=lug_extension,
                lug_width=lug_width,
                side='front',
            )
            buckle = _slide_buckle_plate(
                y_surf, z_surf,
                lug_thickness=max(6.0, lug_thickness * 0.75),
                lug_extension=lug_extension * 1.3,
                lug_width=lug_width * 1.25,
                side='back',
            )
            if anchor is None or buckle is None:
                continue
            front_part = union([front_part, anchor])
            back_part = union([back_part, buckle])
        elif effective_closure == "slide_latch":
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


def _top_trim_line(condition_type, outer_dims):
    """
    Trim line no topo do capacete específica para a condição clínica.
    Padrão Sprout3D — Surestep oferece dois cortes distintos:

    - 'plagiocephaly': abertura OVAL (eixo E-D maior). A abertura
      lateralmente alongada deixa o crânio se simetrizar livremente
      em relação ao plano sagital.
    - 'brachycephaly': abertura CURVA E ALONGADA (eixo F-O maior).
      Tira contato com a região occipital achatada, estimulando
      crescimento posterior para alongar a forma craniana.
    """
    ax, ay, az = outer_dims
    max_r = max(outer_dims) * 1.6
    z_pen = max_r * 0.6     # profundidade de penetração radial

    if condition_type == 'plagiocephaly':
        # Oval lateral: comprimento Y > largura X
        ellipse_x = ax * 0.50      # extensão F-O moderada
        ellipse_y = ay * 0.85      # largo lateralmente (E-D)
    elif condition_type == 'brachycephaly':
        # Alongado F-O: comprimento X >> largura Y
        ellipse_x = ax * 0.95      # estende quase toda a anteroposterior
        ellipse_y = ay * 0.45      # estreito lateralmente
    else:
        return None

    # Constrói uma cápsula achatada via icosphere escalada — depois
    # subtrai do topo para gerar abertura. Usar icosphere garante
    # mesh manifold após escalonamento.
    cutter = trimesh.creation.icosphere(subdivisions=4)
    # Escalonamento: largo em XY (forma do trim), fino em Z (achatado)
    cutter.vertices = cutter.vertices * np.array([
        ellipse_x, ellipse_y, az * 0.35,
    ])
    # Posiciona no topo, ligeiramente para baixo para o "diâmetro"
    # do cutter ficar acima do plano superior
    cutter.apply_translation([0, 0, az * 0.95])
    return cutter


def _bottom_chamfer_cutter(outer_dims):
    """
    Cutter inferior: combinação de uma elipsoide grande embaixo
    (curvatura suave que arredonda a borda) com uma caixa que remove
    todo o material abaixo. A elipsoide cria filete contínuo na borda
    inferior, sem aresta diagonal — inspirado em forma de bacia.
    """
    ax, ay, az = outer_dims
    # Elipsoide enorme vinda de baixo, raio Z bem menor pra dar fillet
    bowl = trimesh.creation.icosphere(subdivisions=3)
    bowl.vertices = bowl.vertices * np.array([ax * 1.6, ay * 1.6, az * 0.55])
    bowl.apply_translation([0, 0, -az * 0.95])
    # Caixa que remove tudo abaixo da elipsoide pra garantir clearance
    box = trimesh.creation.box(extents=(ax * 4, ay * 4, az * 1.2))
    box.apply_translation([0, 0, -az * 1.6])
    try:
        return union([bowl, box])
    except Exception:
        return bowl


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


def _oval_slot_cutter(center, direction, radius, length, depth):
    """
    Slot oval (capsule) Sprout3D-style. Direction é a normal radial;
    o eixo longo do oval fica tangencial à superfície (perpendicular
    ao meridiano).
    """
    cap = trimesh.creation.capsule(
        radius=radius, height=length, count=[12, 12],
    )
    # Capsule está em Z (eixo longo). Para o slot ficar tangencial,
    # primeiro alinhamos esse eixo Z à direção tangencial-meridional
    # (perpendicular à normal e ao eixo vertical do mundo).
    z_axis = np.array([0, 0, 1])
    direction = np.asarray(direction, dtype=float)
    direction = direction / max(np.linalg.norm(direction), 1e-9)

    # tangente meridional ≈ projeção de Z no plano da normal
    tangent = z_axis - np.dot(z_axis, direction) * direction
    if np.linalg.norm(tangent) < 1e-3:
        tangent = np.array([1.0, 0.0, 0.0])
    tangent = tangent / np.linalg.norm(tangent)

    # rotação que leva +Z (eixo da capsule) → tangent
    rot_axis = np.cross(z_axis, tangent)
    rot_norm = np.linalg.norm(rot_axis)
    if rot_norm > 1e-9:
        angle = np.arccos(np.clip(np.dot(z_axis, tangent), -1, 1))
        R = trimesh.transformations.rotation_matrix(angle, rot_axis / rot_norm)
        cap.apply_transform(R)

    # bore radial perfurando profundamente — garante atravessamento
    bore = trimesh.creation.cylinder(
        radius=radius * 1.02, height=depth, sections=16,
    )
    rot_axis_b = np.cross(z_axis, direction)
    rot_norm_b = np.linalg.norm(rot_axis_b)
    if rot_norm_b > 1e-9:
        angle_b = np.arccos(np.clip(np.dot(z_axis, direction), -1, 1))
        R_b = trimesh.transformations.rotation_matrix(angle_b, rot_axis_b / rot_norm_b)
        bore.apply_transform(R_b)

    cap.apply_translation(center)
    bore.apply_translation(center)
    try:
        slot = union([cap, bore])
        return slot
    except Exception:
        return bore  # fallback: pelo menos perfura


def _vent_cylinders(outer_dims, n_holes, radius):
    """
    Padrão híbrido Sprout3D-style: 1 cluster "flor Sphera" no centro
    do topo + slots ovais (capsules tangenciais) nas demais posições.
    Retorna lista de cutters individuais para boolean encadeada robusta.
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

    # Slots ovais nos demais pontos (Fibonacci spiral)
    remaining = max(0, n_holes - 8)
    placed = 0
    slot_length = radius * 3.6   # oval alongado vertical
    for i in range(remaining * 2):
        idx = i + 0.5
        phi = np.arccos(1 - 2 * idx / (remaining * 4))
        theta = np.pi * (1 + 5 ** 0.5) * idx
        x = np.sin(phi) * np.cos(theta)
        y = np.sin(phi) * np.sin(theta)
        z = np.cos(phi)

        # ignora hemisfério inferior + zona do cluster topo
        if z < 0.30 or z > 0.85:
            continue
        if abs(y) > 0.85 and z < 0.6:
            continue
        if x > 0.6 and z < 0.5:
            continue

        center = np.array([x * ax, y * ay, z * az])
        direction = np.array([x, y, z])
        direction = direction / np.linalg.norm(direction)

        cutters.append(_oval_slot_cutter(
            center, direction,
            radius=radius, length=slot_length, depth=max_r,
        ))
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
