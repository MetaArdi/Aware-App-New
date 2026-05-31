import pytest
import base64
import os
import sys
from io import BytesIO
from PIL import Image
from httpx import ASGITransport, AsyncClient

# Add current directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from main import app
from models.database import SessionLocal, Employee, User

def create_dummy_base64_image(size=(224, 224)):
    img = Image.new('RGB', size, color='white')
    buffered = BytesIO()
    img.save(buffered, format="JPEG")
    return base64.b64encode(buffered.getvalue()).decode()

import pytest_asyncio

@pytest_asyncio.fixture
async def auth_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Assuming budi is seeded by init_db.py
        response = await ac.post("/auth/login", json={
            "employee_number": "AW-2023-001",
            "password": "budi123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        print(f"Login failed: {response.status_code} - {response.text}")
        return None

@pytest.mark.asyncio
async def test_screening_analyze_success(auth_token):
    if not auth_token:
        pytest.skip("Auth token could not be acquired (is DB initialized?)")
        
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get employee_id for AW-2023-001
        db = SessionLocal()
        user = db.query(User).filter(User.employee_number == "AW-2023-001").first()
        employee = db.query(Employee).filter(Employee.user_id == user.id).first()
        employee_id = employee.id
        db.close()
        
        dummy_frame = create_dummy_base64_image()
        
        payload = {
            "employee_id": employee_id,
            "frames": [dummy_frame] * 3,
            "self_report": {
                "sleep_hours": 8,
                "energy_level": 5,
                "physical_complaints": "None"
            }
        }
        
        response = await ac.post("/screening/analyze", json=payload, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "risk_score" in data
        assert "fatigue_score" in data
        assert "recommendation" in data

@pytest.mark.asyncio
async def test_screening_analyze_invalid_employee(auth_token):
    if not auth_token:
        pytest.skip("Auth token could not be acquired")
        
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        payload = {
            "employee_id": 9999, # Hopefully non-existent
            "frames": [create_dummy_base64_image()],
            "self_report": {
                "sleep_hours": 8,
                "energy_level": 5,
                "physical_complaints": "None"
            }
        }
        
        response = await ac.post("/screening/analyze", json=payload, headers=headers)
        assert response.status_code == 404
