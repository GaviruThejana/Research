# Dermoscope — Multi-Modal Skin Disease Classification Platform

A production-grade, cloud-ready web application that fuses lesion imagery
with structured patient metadata (age, sex, anatomical site) to produce a
ranked differential diagnosis with Grad-CAM explainability. Built as an
enterprise-ready evolution of a PyTorch research pipeline (EfficientNet /
ResNet / MobileNet backbone + metadata MLP fusion, Stratified K-Fold CV,
Grad-CAM).

> ⚠️ **Research prototype.** This system is not a certified medical device
> and must not be used to guide real clinical decisions.

---

## Architecture

```
skin-disease-app/
├── backend/                 FastAPI + PyTorch inference & training service
│   ├── app/
│   │   ├── config.py         pydantic-settings environment configuration
│   │   ├── schemas.py         Pydantic v2 request/response models
│   │   ├── main.py            FastAPI app, middleware, exception handlers
│   │   ├── logging_config.py  Structured JSON logging
│   │   ├── models/
│   │   │   ├── multimodal_net.py   CNN + metadata MLP fusion network
│   │   │   └── explainability.py   Grad-CAM engine
│   │   ├── services/
│   │   │   ├── preprocessing.py    Albumentations transforms, metadata encoding
│   │   │   ├── inference.py        Thread-safe inference manager
│   │   │   └── trainer.py          Stratified K-Fold training pipeline
│   │   └── api/
│   │       └── routes.py           /health, /api/v1/predict, /api/v1/train
│   ├── tests/                pytest suite (preprocessing, model, API)
│   ├── requirements.txt
│   ├── Dockerfile            Multi-stage (builder venv + slim runtime)
│   └── pytest.ini
├── frontend/                 React + Tailwind SPA
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api/client.js
│   │   └── components/
│   │       ├── Dropzone.jsx
│   │       ├── MetadataForm.jsx
│   │       ├── ConfidenceChart.jsx
│   │       ├── GradCamViewer.jsx
│   │       └── PredictionResults.jsx
│   ├── Dockerfile             Multi-stage (Node build + Nginx serve)
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

---

## 1. Local development (without Docker)

### Backend

```bash
cd backend
python3.10 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # adjust as needed

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`, with interactive
docs at `http://localhost:8000/docs`.

> On first run, if no trained weights exist at `SKINAI_MODEL_DIR`, the
> service automatically falls back to an ImageNet-pretrained backbone with
> a randomly initialized classification head so the API remains fully
> functional end-to-end (predictions will not be clinically meaningful
> until you train and place real weights — see Section 4).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env               # optional; defaults to dev-server proxy
npm run dev
```

The SPA will be available at `http://localhost:5173` and will proxy
`/api/*` and `/health` requests to `http://localhost:8000` (configurable
via `VITE_API_PROXY_TARGET` in `vite.config.js` / `.env`).

---

## 2. Running tests

```bash
cd backend
source .venv/bin/activate
pytest -v
```

The suite covers:
- `test_preprocessing.py` — image decoding, resizing, normalization, metadata one-hot encoding.
- `test_model.py` — forward pass shape checks and Grad-CAM Base64 output validation.
- `test_api.py` — FastAPI `TestClient` checks for `/health`, `/api/v1/predict`, and `/api/v1/train` response schemas.

> The first test run will download ImageNet-pretrained backbone weights
> via `torchvision`, which requires outbound internet access. In fully
> offline CI environments, pre-populate the torch hub cache or mount a
> trained checkpoint at `SKINAI_MODEL_DIR` beforehand.

---

## 3. Docker deployment

Build and run both services with Docker Compose:

```bash
docker compose build
docker compose up -d
```

- Frontend (Nginx, serving the built SPA and proxying `/api` + `/health`
  to the backend container): `http://localhost`
- Backend (FastAPI): `http://localhost:8000`

Named volumes (`model-weights`, `training-data`, `checkpoints`) persist
model artifacts across container restarts. To use a pre-trained checkpoint,
copy it into the `model-weights` volume:

```bash
docker cp ./multimodal_skin_net.pth skin-disease-backend:/app/weights/multimodal_skin_net.pth
docker restart skin-disease-backend
```

To tear down:

```bash
docker compose down            # keep volumes
docker compose down -v         # also remove volumes
```

---

## 4. Training a model

Prepare a dataset directory with the following layout:

```
data/
├── metadata.csv     # columns: image_path,age,sex,anatomical_site,label
└── images/          # referenced by image_path
```

`label` may be either a class name matching `Settings.CLASS_NAMES` or an
integer index. `sex` must be one of `male|female|unknown`; `anatomical_site`
must be one of the values listed in `Settings.ANATOMICAL_SITES`.

Trigger a background Stratified K-Fold training job via the API:

```bash
curl -X POST http://localhost:8000/api/v1/train \
  -H "Content-Type: application/json" \
  -d '{
        "dataset_dir": "/app/data",
        "epochs": 15,
        "batch_size": 32,
        "n_splits": 5,
        "learning_rate": 0.001
      }'
```

This returns a `job_id`. Poll progress with:

```bash
curl http://localhost:8000/api/v1/train/<job_id>
```

The best-performing fold (by macro F1) is automatically saved to
`SKINAI_MODEL_DIR/SKINAI_MODEL_FILENAME`, and the inference manager
hot-reloads the new weights once training completes — no restart required.

---

## 5. Cloud VM hosting (generic instructions)

These steps apply to any Ubuntu 22.04+ VM (AWS EC2, GCP Compute Engine,
Azure VM, DigitalOcean Droplet, etc.):

```bash
# 1. Install Docker + Compose plugin
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker

# 2. Clone / copy the project onto the VM
git clone <your-repo-url> skin-disease-app
cd skin-disease-app

# 3. (Optional) place a trained checkpoint under backend/weights/
#    before the first build, or upload it into the running volume later.

# 4. Build and launch
docker compose build
docker compose up -d

# 5. Open inbound firewall ports 80 (frontend) and 8000 (backend API),
#    or place a reverse proxy / load balancer (e.g. Nginx, ALB) in front.
```

For GPU-accelerated inference on a CUDA-enabled VM, install the NVIDIA
Container Toolkit and add a `deploy.resources.reservations.devices` GPU
stanza to the `backend` service in `docker-compose.yml`, then set
`SKINAI_DEVICE_PREFERENCE=cuda`.

---

## 6. API reference (summary)

| Method | Path                     | Description                                              |
|--------|--------------------------|------------------------------------------------------------|
| GET    | `/health`                | Liveness/readiness probe                                   |
| POST   | `/api/v1/predict`        | Multipart `image` + JSON `metadata` → Top-K + Grad-CAM      |
| POST   | `/api/v1/train`          | Queues a background Stratified K-Fold training job          |
| GET    | `/api/v1/train/{job_id}` | Polls background training job status                        |

Full interactive documentation (OpenAPI/Swagger) is served at `/docs`
when the backend is running.

---

## 7. Configuration reference

All backend settings are environment-driven (prefix `SKINAI_`) via
`pydantic-settings`; see `backend/.env.example` for the complete list,
including `SKINAI_BACKBONE` (`resnet50` | `efficientnet_b0` |
`mobilenet_v3_large`), `SKINAI_TOP_K`, `SKINAI_DEVICE_PREFERENCE`
(`auto` | `cpu` | `cuda` | `mps`), and `SKINAI_CORS_ORIGINS`.
