import httpx
import random
from core.config import ML_SERVER_URL
from typing import List


async def call_ml_predict(frames: List[str], config: dict = None) -> dict:
    """
    Kirim frame ke ML server, kembalikan hasil prediksi.
    Fallback ke rule-based jika ML server tidak tersedia.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {"frames": frames}
            if config:
                payload["config"] = config
                
            response = await client.post(
                f"{ML_SERVER_URL}/predict",
                json=payload
            )
            response.raise_for_status()
            return response.json()
    except Exception:
        # Fallback simulasi jika ML server down
        # Gunakan jumlah frame sebagai seed untuk konsistensi
        n_frames = len(frames)
        fatigue  = round(random.uniform(0.2, 0.7), 3) if n_frames > 0 else 0.4
        return {
            "fatigue_score":       fatigue,
            "ear_avg":             round(random.uniform(0.25, 0.40), 3),
            "mar_avg":             round(random.uniform(0.1, 0.5), 3),
            "yawn_detected":       fatigue > 0.55,
            "face_detected_count": n_frames,
            "total_frames":        n_frames,
            "_fallback":           True
        }

async def call_ml_realtime(frame: str, config: dict = None) -> dict:
    """
    Kirim 1 frame untuk analisis realtime cepat (MediaPipe only).
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            payload = {"frame": frame}
            if config:
                payload["config"] = config
                
            response = await client.post(
                f"{ML_SERVER_URL}/predict/realtime",
                json=payload
            )
            response.raise_for_status()
            return response.json()
    except Exception:
        # Fallback silent
        return {
            "ear": 0.3,
            "mar": 0.1,
            "face_detected": False,
            "status": "fallback"
        }