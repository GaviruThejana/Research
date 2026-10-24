# FastAPI classifier (backend/main.py: MobileNetV3 features + Random Forest).
# Internal service: only the Node API (and the frontend's nginx) call it.

# ---------------------------------------------------------------------------
# Stage 1: Builder - installs dependencies into a virtual environment
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS builder

WORKDIR /build

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
# CPU-only PyTorch first: the default PyPI wheels bundle CUDA (several GB)
# that this CPU inference service never uses. The -r install then finds
# torch/torchvision already satisfied.
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision && \
    pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------------------
# Stage 2: Runtime - lean image with only the venv, the app and its models
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/* && \
    useradd --create-home --shell /bin/bash appuser

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SKINAI_MODEL_DIR=/app/weights

# main.py is the service that runs; the app/ package expects weights that
# don't exist (mobilenet_fine_tuned.pth), so it isn't shipped.
COPY main.py ./main.py
# Models are baked into the image (~110 MB) so a rebuild always ships the
# current weights; a named volume here would keep serving stale ones.
COPY weights ./weights

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Model loading takes ~10-30 s on CPU, hence the start period.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fs http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860
