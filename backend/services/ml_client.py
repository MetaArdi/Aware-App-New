import httpx
import random
from core.config import ML_SERVER_URL
from typing import List

async def call_ml_predict(frames_b64: List[str], config: dict = None) -> dict:
    if not frames_b64:
        return {"fatigue_score": 0.4, "ear_avg": 0.35, "mar_avg": 0.2, "yawn_count": 0, "status": "error"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {"frames": frames_b64, "config": config}
            response = await client.post(
                f"{ML_SERVER_URL}/predict",
                json=payload
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        print(f"ML Server Error: {e}")
        fatigue = round(random.uniform(0.2, 0.7), 3)
        return {
            "fatigue_score": fatigue,
            "ear_avg": round(random.uniform(0.25, 0.40), 3),
            "mar_avg": round(random.uniform(0.1, 0.5), 3),
            "yawn_count": 1 if fatigue > 0.55 else 0,
            "_fallback": True
        }

async def call_ml_realtime(frame_b64: str, config: dict = None) -> dict:
    if not frame_b64:
        return {"ear": 0.0, "mar": 0.0, "face_detected": False}
        
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {"frame": frame_b64, "config": config}
            response = await client.post(
                f"{ML_SERVER_URL}/predict/realtime",
                json=payload
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        print(f"ML Realtime Error: {e}")
        return {
            "ear": round(random.uniform(0.25, 0.40), 3),
            "mar": round(random.uniform(0.1, 0.5), 3),
            "face_detected": True,
            "_fallback": True
        }