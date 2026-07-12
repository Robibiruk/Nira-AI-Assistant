# ---- Nira AI backend (FastAPI) ----
# Builds a Linux image with the Kokoro/Piper TTS model weights so voice works
# in deployment (Render / Railway / Fly).
#
# IMPORTANT: we `git clone` the repo INSIDE the container (rather than relying
# on `COPY . .`) because Render's Docker build context does NOT include `.git`.
# Without `.git`, `git lfs pull` has no LFS metadata and the ~460 MB model
# weights stay as tiny pointer stubs -> /speak returns "TTS not available".
# Cloning here guarantees real weights are fetched via Git LFS.

FROM python:3.11-slim

# Git + Git LFS are required to pull the large TTS model weights from LFS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git git-lfs ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Queue LFS downloads and limit parallelism so `git lfs pull` doesn't fork
# many transfers at once (each can spike RAM and OOM the build on small tiers).
ENV GIT_LFS_PROCESS_QUEUED=1
ENV GIT_LFS_MAX_PROCESSES=2
# Unbuffer Python so OOM / startup errors surface in the deploy log immediately.
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Clone the public repo WITH Git LFS so the model weights are real files.
# (Render's Docker context lacks .git, so a plain COPY leaves LFS pointers.)
ARG REPO_URL=https://github.com/Robibiruk/Nira-AI-Assistant.git
RUN git clone --depth 1 "$REPO_URL" /app \
    && cd /app \
    && git lfs install \
    && git lfs pull \
    && echo "LFS objects after pull:" \
    && du -h kokoro-voice/kokoro-v1.0.onnx kokoro-voice/voices-v1.0.bin nira-voice/nira-high.onnx 2>/dev/null || true

# Install deps (after clone so requirements.txt is present).
RUN pip install --no-cache-dir -r requirements.txt

# Render/Railway inject PORT; bind to 0.0.0.0.
ENV HOST=0.0.0.0
EXPOSE 8000

# `PORT` is provided by the platform at runtime.
CMD uvicorn app:app --host 0.0.0.0 --port "${PORT:-8000}"
