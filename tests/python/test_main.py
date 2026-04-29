from fastapi.testclient import TestClient
from python.main import app

client = TestClient(app)

def test_health():
    response = client.get("/status")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
