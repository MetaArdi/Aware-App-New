import httpx
import base64
from core.config import ML_SERVER_URL
from typing import List
import random

async def call_ml_predict(frames_b64: List[str]) -> dict:
    """
    Kirim sekumpulan frame Base64 ke ML server (/predict/batch).
    """
    if not frames_b64:
        return {"fatigue_score": 0.4, "ear_avg": 0.35, "mar_avg": 0.2, "_fallback": True}

    files_payload = []
    for idx, b64_str in enumerate(frames_b64):
        # Buang header "data:image/jpeg;base64," jika ada
        header, encoded = b64_str.split(",", 1) if "," in b64_str else ("", b64_str)
        img_bytes = base64.b64decode(encoded)
        # Bentuk tuple untuk httpx multipart: (field_name, (filename, file_bytes, content_type))
        files_payload.append(("files", (f"frame_{idx}.jpg", img_bytes, "image/jpeg")))

    try:
        # Panggil API dari AI Engineer (port 8000/8001)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{ML_SERVER_URL}/predict/batch",
                files=files_payload
            )
            response.raise_for_status()
            ai_data = response.json()
            
            # Hitung rata-rata probabilitas dari semua frame
            results = ai_data.get("results", [])
            if results and "fatigue_probability" in results[0]:
                avg_fatigue = sum(r["fatigue_probability"] for r in results) / len(results)
            else:
                avg_fatigue = 0.4

            return {
                "fatigue_score": avg_fatigue,
                "ear_avg": round(random.uniform(0.25, 0.40), 3),  # Simulasi MediaPipe Backend
                "mar_avg": round(random.uniform(0.1, 0.5), 3),
                "yawn_detected": avg_fatigue > 0.55
            }
    except Exception as e:
        print(f"ML Server Error: {e}")
        # Fallback agar aplikasi tidak crash jika AI Server mati
        fatigue = round(random.uniform(0.2, 0.7), 3)
        return {
            "fatigue_score": fatigue,
            "ear_avg": round(random.uniform(0.25, 0.40), 3),
            "mar_avg": round(random.uniform(0.1, 0.5), 3),
            "yawn_detected": fatigue > 0.55,
            "_fallback": True
        }