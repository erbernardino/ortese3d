import trimesh
from python.services.validator import validate_mesh


def _helmet_mesh():
    from python.services.model_generator import generate_from_measurements
    return generate_from_measurements({
        "circ_occipital": 380, "circ_frontal": 370,
        "diag_a": 135, "diag_b": 118, "cvai": 8.4,
        "height": 72, "offset_mm": 4, "wall_mm": 3,
    })


def test_valid_mesh_result_has_required_keys():
    mesh = _helmet_mesh()
    result = validate_mesh(mesh)
    for key in ["is_valid", "errors", "warnings", "volume_cm3", "weight_g"]:
        assert key in result


def test_valid_mesh_passes():
    mesh = _helmet_mesh()
    result = validate_mesh(mesh, min_thickness_mm=2.0)
    assert isinstance(result["is_valid"], bool)
    assert isinstance(result["errors"], list)
    assert isinstance(result["warnings"], list)


def test_non_manifold_mesh_has_errors():
    mesh = trimesh.Trimesh(
        vertices=[[0, 0, 0], [1, 0, 0], [0, 1, 0]],
        faces=[[0, 1, 2]],
    )
    result = validate_mesh(mesh)
    assert result["is_valid"] is False
    assert len(result["errors"]) > 0


def test_volume_and_weight_are_numbers():
    mesh = _helmet_mesh()
    result = validate_mesh(mesh)
    assert isinstance(result["volume_cm3"], float)
    assert isinstance(result["weight_g"], float)
    assert result["volume_cm3"] > 0
    assert result["weight_g"] > 0
