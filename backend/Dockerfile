# ==========================================================
# DERMAXAI v6 Dockerfile
# ==========================================================

FROM python:3.11-slim

# Prevent Python from creating .pyc files
ENV PYTHONDONTWRITEBYTECODE=1

# Flush logs immediately
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# ----------------------------------------------------------
# Install Linux packages
# ----------------------------------------------------------
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ----------------------------------------------------------
# Install Python packages
# ----------------------------------------------------------
COPY requirements.txt .

RUN pip install --upgrade pip

RUN pip install --no-cache-dir -r requirements.txt

# ----------------------------------------------------------
# Copy project
# ----------------------------------------------------------
COPY . .

# ----------------------------------------------------------
# Create runtime directories
# ----------------------------------------------------------
RUN mkdir -p \
    uploads \
    heatmaps \
    generated_reports \
    models \
    logs \
    knowledge

# ----------------------------------------------------------
# Port
# ----------------------------------------------------------
EXPOSE 8000

# ----------------------------------------------------------
# Health Check
# ----------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
CMD curl -f http://localhost:8000/api/health || exit 1

# ----------------------------------------------------------
# Run FastAPI
# ----------------------------------------------------------
CMD [
    "uvicorn",
    "app:app",
    "--host",
    "0.0.0.0",
    "--port",
    "8000"
]