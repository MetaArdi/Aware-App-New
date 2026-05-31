from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import time

from models.database import Base, engine
from routers import auth, screening, employees, dashboard
from services.model_service import ModelService
from core.config import MODEL_PATH

# Buat semua tabel otomatis
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AWARE Backend API", version="1.0.0")

# Initialize Model Service
model_service = ModelService(MODEL_PATH)

class PredictRequest(BaseModel):
    """Schema for ML prediction request.
    
    Attributes:
        frames (List[str]): List of base64 encoded strings representing image frames.
    """
    frames: List[str]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(screening.router)
app.include_router(employees.router)
app.include_router(dashboard.router)


@app.get("/")
def root():
    return {"message": "AWARE API is running", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/ml/predict")
async def predict_ml(request: PredictRequest):
    """Internal ML Inference endpoint for fatigue detection.

    Processes a batch of images to determine fatigue metrics. Used mainly 
    by the /screening/analyze endpoint for integrated risk assessment.

    Args:
        request (PredictRequest): The request containing base64 images.

    Returns:
        dict: Inference results including fatigue_score and yawn status.
    """
    # ML-302: Menambahkan logging dasar
    start_time = time.time()
    
    result = model_service.predict(request.frames)
    
    execution_time = time.time() - start_time
    print(f"ML Predict - Frames: {len(request.frames)}, Result: {result.get('status')}, Latency: {execution_time:.3f}s")
    
    return result
