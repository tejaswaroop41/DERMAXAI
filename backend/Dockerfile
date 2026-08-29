# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ git libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install CPU PyTorch explicitly from the PyTorch wheel index so pip never
# resolves a CUDA build for the slim CPU runtime image.
COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir \
       --extra-index-url https://download.pytorch.org/whl/cpu \
       torch==2.6.0+cpu torchvision==0.21.0+cpu \
    && python -m pip install --no-cache-dir --no-deps \
       torch==2.6.0+cpu torchvision==0.21.0+cpu \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads heatmaps generated_reports models logs knowledge

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

CMD ["/bin/sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
