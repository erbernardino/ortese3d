import pytest
import numpy as np
from python.services.model_generator import generate_from_measurements

MEASUREMENTS = {
    "circ_occipital": 380.0,
    "circ_frontal": 370.0,
    "diag_a": 135.0,
    "diag_b": 118.0,
    "cvai": 8.4,
    "height": 72.0,
    "offset_mm": 4.0,
    "wall_mm": 3.0,
}

def test_generate_returns_mesh():
    mesh = generate_from_measurements(MEASUREMENTS)
    assert mesh is not None

def test_mesh_is_trimesh():
    import trimesh
    mesh = generate_from_measurements(MEASUREMENTS)
    assert isinstance(mesh, trimesh.Trimesh)

def test_mesh_has_vertices():
    mesh = generate_from_measurements(MEASUREMENTS)
    assert len(mesh.vertices) > 100

def test_mesh_has_faces():
    mesh = generate_from_measurements(MEASUREMENTS)
    assert len(mesh.faces) > 100

def test_mesh_dimensions_match_input():
    mesh = generate_from_measurements(MEASUREMENTS)
    bounds = mesh.bounding_box.extents
    # Width should be approximately diag_a + offset on both sides
    expected_width = MEASUREMENTS["diag_a"] + 2 * MEASUREMENTS["offset_mm"]
    assert abs(bounds[0] - expected_width) < 15  # 15mm tolerance
