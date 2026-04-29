from python.services.exporter import export_stl, export_gcode


def _mesh():
    from python.services.model_generator import generate_from_measurements
    return generate_from_measurements({
        "circ_occipital": 380, "circ_frontal": 370,
        "diag_a": 135, "diag_b": 118, "cvai": 8.4,
        "height": 72, "offset_mm": 4, "wall_mm": 3,
    })


def test_export_stl_returns_bytes():
    mesh = _mesh()
    data = export_stl(mesh)
    assert isinstance(data, bytes)
    assert len(data) > 0


def test_export_stl_is_valid_stl():
    mesh = _mesh()
    data = export_stl(mesh)
    # Binary STL: 80 byte header + 4 byte count
    assert len(data) > 84


def test_export_gcode_returns_string():
    mesh = _mesh()
    gcode = export_gcode(mesh, layer_height_mm=0.2, feedrate=1500)
    assert isinstance(gcode, str)
    assert len(gcode) > 0


def test_export_gcode_has_header_comment():
    mesh = _mesh()
    gcode = export_gcode(mesh, layer_height_mm=0.2, feedrate=1500)
    assert gcode.startswith(";")


def test_export_gcode_has_movement_commands():
    mesh = _mesh()
    gcode = export_gcode(mesh, layer_height_mm=0.2, feedrate=1500)
    assert "G0" in gcode or "G1" in gcode


def test_export_gcode_has_end_command():
    mesh = _mesh()
    gcode = export_gcode(mesh, layer_height_mm=0.2, feedrate=1500)
    assert "M2" in gcode or "M30" in gcode
