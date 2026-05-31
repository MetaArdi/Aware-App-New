import pytest
import numpy as np
import base64
import os
import sys
from io import BytesIO
from PIL import Image

# Add current directory to path so we can import services
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from services.model_service import ModelService
from core.config import MODEL_PATH

@pytest.fixture
def model_service():
    return ModelService(MODEL_PATH)

def create_dummy_base64_image(size=(224, 224)):
    img = Image.new('RGB', size, color='white')
    buffered = BytesIO()
    img.save(buffered, format="JPEG")
    return base64.b64encode(buffered.getvalue()).decode()

def test_preprocess_frame(model_service):
    dummy_b64 = create_dummy_base64_image()
    processed = model_service.preprocess_frame(dummy_b64)
    
    assert processed is not None
    assert processed.shape == (1, 224, 224, 3)
    assert np.max(processed) <= 1.0
    assert np.min(processed) >= 0.0

def test_predict_single_frame(model_service):
    dummy_b64 = create_dummy_base64_image()
    result = model_service.predict([dummy_b64])
    
    assert result["status"] == "success"
    assert "fatigue_score" in result
    assert result["total_frames"] == 1
    assert result["face_detected_count"] == 1

def test_predict_empty_list(model_service):
    result = model_service.predict([])
    assert result["status"] == "error"
    assert result["total_frames"] == 0

def test_invalid_base64(model_service):
    result = model_service.predict(["invalid_base64_string"])
    assert result["status"] == "error"
    assert "message" in result
