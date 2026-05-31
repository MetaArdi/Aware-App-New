from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL                = os.getenv("DATABASE_URL", "sqlite:///./aware.db")
SECRET_KEY                  = os.getenv("SECRET_KEY", "fallback-secret-key-change-in-production")
ALGORITHM                   = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480))
ML_SERVER_URL               = os.getenv("ML_SERVER_URL", "http://localhost:8000/ml")
MODEL_PATH                  = os.getenv("MODEL_PATH", "d:/Dev/Capstone Coding Camp Workspace/resource/aware_fatigue_savedmodel-20260524T115612Z-3-001/aware_fatigue_savedmodel/aware_fatigue_model.tflite")