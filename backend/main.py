from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.database import Base, engine
from routers import auth, screening, employees, dashboard

# Buat semua tabel otomatis
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AWARE Backend API", version="1.0.0")

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