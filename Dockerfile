# ---- Nira AI backend (FastAPI) ----
# Lightweight image: NO large TTS model. NIRA's voice now runs CLIENT-SIDE
# via ResponsiveVoice (UK English Male), so the 325MB Kokoro + 114MB
# Piper weights are no longer needed. That keeps the image small and stops
# the 512MB Render free-tier OOM that killed the process on cold start.

FROM python:3.11-slim

# Git is needed only if we clone the repo; we COPY the build context instead.
# (Render provides the source tree at build time.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Render supplies the repo at build time; copy it in.
COPY . /app

# Install deps.
RUN pip install --no-cache-dir -r requirements.txt

# Unbuffer Python so startup/OOM errors surface in the deploy log immediately.
ENV PYTHONUNBUFFERED=1

# Render/Railway inject PORT; bind to 0.0.0.0.
ENV HOST=0.0.0.0
EXPOSE 8000

# `PORT` is provided by the platform at runtime.
CMD uvicorn app:app --host 0.0.0.0 --port "${PORT:-8000}"
