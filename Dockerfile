# ---- Nira AI backend (FastAPI) ----
# Builds a Linux image with the Kokoro/Piper TTS model weights so voice works
# in deployment. Render/Railway/Fly can all use this Dockerfile.

FROM python:3.11-slim

# Git + Git LFS are required to pull the large TTS model weights from LFS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git git-lfs ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pull source.
COPY . .

# Make the LFS model weights real (not pointer stubs) so TTS works.
RUN git lfs install && git lfs pull || echo "LFS pull skipped (weights may be mounted as a volume)"

# Render/Railway inject PORT; bind to 0.0.0.0.
ENV HOST=0.0.0.0
EXPOSE 8000

# `PORT` is provided by the platform at runtime.
CMD uvicorn app:app --host 0.0.0.0 --port "${PORT:-8000}"
