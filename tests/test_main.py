# Tests for the hello world endpoint.
from fastapi.testclient import TestClient

from app.main import app

# TestClient lets us call our API in a test without starting a real server.
client = TestClient(app)


def test_root_says_running():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Depot Management System is running"}


def test_health_is_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
