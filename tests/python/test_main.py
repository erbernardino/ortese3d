from fastapi.testclient import TestClient
from python.main import app

client = TestClient(app)

def test_health():
    response = client.get("/status")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_model_generate_stub():
    response = client.post("/model/generate", json={
        "circ_occipital": 380,
        "circ_frontal": 370,
        "diag_a": 135,
        "diag_b": 118,
        "cvai": 8.4,
        "height": 72,
    })
    assert response.status_code == 200
    data = response.json()
    assert "stl_b64" in data
    assert data["vertex_count"] > 100

def test_model_validate_requires_stl_b64():
    response = client.post("/model/validate", json={})
    assert response.status_code == 400
    assert "stl_b64" in response.json()["detail"]

def test_export_stl_requires_stl_b64():
    response = client.post("/export/stl", json={})
    assert response.status_code == 400
    assert "stl_b64" in response.json()["detail"]

def test_export_gcode_requires_stl_b64():
    response = client.post("/export/gcode", json={})
    assert response.status_code == 400
    assert "stl_b64" in response.json()["detail"]

def test_export_pdf_returns_pdf():
    response = client.post("/export/pdf", json={
        "type": "clinical",
        "patient": {"name": "Test"},
        "measurements": {},
        "model_meta": {},
    })
    assert response.status_code == 200
    assert response.content[:4] == b"%PDF"
