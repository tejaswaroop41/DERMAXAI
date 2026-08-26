# ==========================================================
# DERMAXAI v6 Dockerfile
# ==========================================================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc g++ git libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads heatmaps generated_reports models logs knowledge

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Cloud Run injects PORT; local Docker/Compose falls back to ENV PORT=8000.
CMD ["/bin/sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
