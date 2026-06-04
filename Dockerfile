FROM python:3.10-slim

# Install system dependencies (for OpenCV and MediaPipe)
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libxcb1 \
    libgl1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Create user with UID 1000 (Hugging Face Spaces requirement)
RUN useradd -m -u 1000 user

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY backend/requirements.txt ./backend/requirements.txt

# Install python dependencies (as root so they are installed globally in the container)
RUN pip install --no-cache-dir -r backend/requirements.txt

# Change ownership of /app to the new user so they can write to it (e.g., for aware.db SQLite)
RUN chown -R user:user /app

# Switch to the non-root user
USER user

# Copy the backend and model directories with correct ownership
COPY --chown=user:user backend/ ./backend/
COPY --chown=user:user model/ ./model/

# Set working directory to where main.py is located
WORKDIR /app/backend

# Set Protobuf to Python implementation to avoid C++ MemoryError/Conflicts between TF and MediaPipe
ENV PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python

# Hugging Face exposes port 7860
ENV PORT=7860
EXPOSE 7860

# Command to run the database initialization script and then the FastAPI app
CMD python init_db.py && uvicorn main:app --host 0.0.0.0 --port 7860
