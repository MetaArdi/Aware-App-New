# api/main.py
# AWARE — FastAPI Skeleton
# Jalankan: uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
# Docs    : http://localhost:8000/docs

"""
API skeleton — siap untuk integrasi Full-Stack Developer (Minggu 3).
AI Engineer cukup menjaga endpoint ini konsisten dengan model output.
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import io
import os

app = FastAPI(
    title       = "AWARE API",
    description = "AI-Based Workplace Assessment for Readiness and Safety",
    version     = "1.0.0",
)

# CORS — allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# Mount static files folder
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# ── Response Schemas ───────────────────────────────────────
class FatigueResult(BaseModel):
    employee_id:          Optional[str] = None
    fatigue_probability:  float
    prediction:           str       # "alert" | "fatigue"
    confidence:           float
    risk_level:           str       # "Low" | "Medium" | "High"
    fit_to_work:          str       # "FIT" | "NOT FIT" | "AT RISK"


class HealthResponse(BaseModel):
    status:  str
    model:   str
    version: str


# ── Global model (lazy loaded) ─────────────────────────────
_model = None

def get_model():
    global _model
    if _model is None:
        import tensorflow as tf
        import sys
        from pathlib import Path
        
        # Setup paths to include root directory for configs/src modules
        root_dir = Path(__file__).resolve().parents[1]
        sys.path.insert(0, str(root_dir))
        
        from configs.config import MODEL_KERAS_PATH
        from src.model import AwareFatigueModel, ChannelAttention, FatigueClassificationHead
        
        # Load model using custom objects and compile=False
        _model = tf.keras.models.load_model(
            MODEL_KERAS_PATH,
            compile=False,
            custom_objects={
                "AwareFatigueModel": AwareFatigueModel,
                "ChannelAttention": ChannelAttention,
                "FatigueClassificationHead": FatigueClassificationHead,
            }
        )
    return _model


# ── Endpoints ──────────────────────────────────────────────
@app.get("/")
async def root():
    return FileResponse(os.path.join(static_dir, "index.html"))


@app.get("/health", response_model=HealthResponse)
async def health():
    return {"status": "healthy", "model": "AwareFatigueModel-MobileNetV2", "version": "1.0.0"}


@app.post("/predict", response_model=FatigueResult)
async def predict(
    file:        UploadFile = File(...),
    employee_id: Optional[str] = None,
    threshold:   float = 0.5,
):
    """
    Receive a face image (JPEG/PNG) and return fatigue detection result.
    Used by frontend screening page.
    """
    import tensorflow as tf
    import numpy as np
    from configs.config import IMG_SIZE

    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400,
                            detail="File harus berupa gambar (JPEG/PNG/WebP)")

    # Read and preprocess
    contents = await file.read()
    raw      = tf.constant(contents, dtype=tf.string)
    image    = tf.image.decode_image(raw, channels=3, expand_animations=False)
    image    = tf.image.resize(image, IMG_SIZE)
    image    = tf.cast(image, tf.float32) / 255.0
    tensor   = tf.expand_dims(image, 0)

    # Inference
    model  = get_model()
    logit  = model(tensor, training=False)
    prob   = float(tf.sigmoid(tf.cast(logit, tf.float32)).numpy().flatten()[0])

    pred       = "fatigue" if prob >= threshold else "alert"
    confidence = prob if pred == "fatigue" else (1 - prob)

    if prob < 0.35:
        risk, fit = "Low", "FIT"
    elif prob < 0.65:
        risk, fit = "Medium", "AT RISK"
    else:
        risk, fit = "High", "NOT FIT"

    return FatigueResult(
        employee_id         = employee_id,
        fatigue_probability = round(prob, 4),
        prediction          = pred,
        confidence          = round(confidence, 4),
        risk_level          = risk,
        fit_to_work         = fit,
    )


@app.post("/predict/batch")
async def predict_batch(files: list[UploadFile] = File(...)):
    """Batch prediction — multiple images at once."""
    results = []
    for f in files:
        try:
            result = await predict(file=f)
            results.append(result.dict())
        except Exception as e:
            results.append({"error": str(e), "filename": f.filename})
    return {"results": results, "total": len(results)}


# ── Run directly ───────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
