# AWARE Backend Setup Guide

This guide provides instructions for setting up the AWARE backend and ML integration.

## Prerequisites
- Python 3.12 (Recommended: 3.12.2)
- Virtual Environment tool (`venv`)

## Installation

1. **Create and activate virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   *Note: If you encounter issues with `bcrypt` or `passlib`, ensure `bcrypt==4.0.1` is installed.*

3. **Environment Variables:**
   - Copy `.env.example` to `.env`.
   - Update `MODEL_PATH` in `.env` with the absolute path to your `aware_fatigue_model.tflite` file.

4. **Initialize Database:**
   ```bash
   python init_db.py
   ```
   This will create `aware.db` and seed it with test accounts:
   - Employee: `AW-2023-001` (Password: `budi123`)
   - Admin: `ADMIN-001` (Password: `admin123`)

## Running the Server

Start the FastAPI server:
```bash
uvicorn main:app --reload
```

## Running Tests

Execute the test suite to verify integration:
```bash
pytest
```

## ML Integration Details
- The backend hosts a `/ml/predict` endpoint for frame analysis.
- Model logic is contained in `services/model_service.py`.
- TFLite is used for low-latency inference.
