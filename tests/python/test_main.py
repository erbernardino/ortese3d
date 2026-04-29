from fastapi.testclient import TestClient
from python.main import app

client = TestClient(app)

def test_health():
    response = client.get("/status")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_model_generate_stub():
    response = client.post("/model/generate", json={})
    assert response.status_code == 200
    assert response.json() == {"message": "not implemented"}

def test_model_validate_stub():
    response = client.post("/model/validate", json={})
    assert response.status_code == 200
    assert response.json() == {"message": "not implemented"}

def test_export_stl_stub():
    response = client.post("/export/stl", json={})
    assert response.status_code == 200
    assert response.json() == {"message": "not implemented"}

def test_export_gcode_stub():
    response = client.post("/export/gcode", json={})
    assert response.status_code == 200
    assert response.json() == {"message": "not implemented"}

def test_export_pdf_stub():
    response = client.post("/export/pdf", json={})
    assert response.status_code == 200
    assert response.json() == {"message": "not implemented"}
