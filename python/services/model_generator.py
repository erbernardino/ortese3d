import numpy as np
import trimesh


def generate_from_measurements(m: dict) -> trimesh.Trimesh:
    """
    Generates helmet mesh from cranial measurements.
    Model: ellipsoidal cranium with external offset and hollow wall.
    """
    ax = m["diag_a"] / 2
    ay = m["diag_b"] / 2
    az = m["height"] / 2

    offset = m.get("offset_mm", 4.0)
    wall = m.get("wall_mm", 3.0)

    outer = _make_ellipsoid(ax + offset, ay + offset, az + offset * 0.5, subdivisions=4)
    inner = _make_ellipsoid(
        ax + offset - wall,
        ay + offset - wall,
        az + offset * 0.5 - wall,
        subdivisions=4,
    )
    inner.invert()

    helmet = trimesh.util.concatenate([outer, inner])
    helmet.process(validate=True)

    return helmet


def _make_ellipsoid(ax: float, ay: float, az: float, subdivisions: int = 3) -> trimesh.Trimesh:
    sphere = trimesh.creation.icosphere(subdivisions=subdivisions)
    sphere.vertices *= np.array([ax, ay, az])
    return sphere
