import io
import numpy as np
import trimesh


def export_stl(mesh: trimesh.Trimesh) -> bytes:
    buf = io.BytesIO()
    mesh.export(buf, file_type="stl")
    return buf.getvalue()


def export_gcode(
    mesh: trimesh.Trimesh,
    layer_height_mm: float = 0.2,
    feedrate: int = 1500,
) -> str:
    """
    Generates simplified G-code for CNC milling (layer contours).
    For full 3D printing slicing, use an external slicer (PrusaSlicer CLI).
    """
    bounds = mesh.bounds
    z_min, z_max = float(bounds[0][2]), float(bounds[1][2])
    layers = np.arange(z_min, z_max, layer_height_mm)

    lines = [
        f"; OrteseCAD G-code export",
        f"; Layer height: {layer_height_mm}mm",
        f"; Total layers: {len(layers)}",
        "G21 ; mm units",
        "G90 ; absolute positioning",
        "G28 ; home",
        f"F{feedrate}",
    ]

    for i, z in enumerate(layers):
        lines.append(f"; Layer {i + 1} — Z={z:.2f}mm")
        lines.append(f"G0 Z{z:.2f}")
        try:
            section = mesh.section(
                plane_origin=[0, 0, z],
                plane_normal=[0, 0, 1],
            )
            if section is None:
                continue
            path2d, _ = section.to_planar()
            for entity in path2d.entities:
                pts = path2d.vertices[entity.points]
                for j, pt in enumerate(pts):
                    cmd = "G0" if j == 0 else "G1"
                    lines.append(f"{cmd} X{pt[0]:.3f} Y{pt[1]:.3f}")
        except Exception:
            continue

    lines.append("G0 Z50 ; lift tool")
    lines.append("M2 ; end program")
    return "\n".join(lines)
