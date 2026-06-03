FROM python:3.10-slim

# Install system dependencies (just in case for OpenCV and MediaPipe)
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY backend/requirements.txt ./backend/requirements.txt

# Install dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the backend and model directories
COPY backend/ ./backend/
COPY model/ ./model/

# Set working directory to backend where main.py is located
WORKDIR /app/backend

# Create a non-root user (Hugging Face Spaces requirement/best practice)
RUN useradd -m -u 1000 user
USER user

# Hugging Face exposes port 7860
ENV PORT=7860
EXPOSE 7860

# Command to run the FastAPI app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
