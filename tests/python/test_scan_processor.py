import trimesh
import tempfile
import os
from python.services.scan_processor import process_scan


def _make_test_stl():
    sphere = trimesh.creation.icosphere(subdivisions=3)
    sphere.vertices *= 70  # ~baby head size in mm
    buf = tempfile.NamedTemporaryFile(suffix=".stl", delete=False)
    sphere.export(buf.name)
    return buf.name


def test_process_scan_returns_mesh():
    path = _make_test_stl()
    try:
        mesh = process_scan(path)
        assert mesh is not None
    finally:
        os.unlink(path)


def test_process_scan_is_trimesh():
    path = _make_test_stl()
    try:
        mesh = process_scan(path)
        assert isinstance(mesh, trimesh.Trimesh)
    finally:
        os.unlink(path)


def test_process_scan_has_vertices():
    path = _make_test_stl()
    try:
        mesh = process_scan(path)
        assert len(mesh.vertices) > 50
    finally:
        os.unlink(path)


def test_process_scan_single_component():
    path = _make_test_stl()
    try:
        mesh = process_scan(path)
        components = mesh.split(only_watertight=False)
        assert len(components) == 1
    finally:
        os.unlink(path)
