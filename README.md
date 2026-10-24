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
├── backend/        FastAPI classifier (main.py: MobileNetV3 features + Random Forest), port 8001
│   ├── main.py       the service that runs (loads backend/weights/)
│   ├── weights/      trained models + preprocessing config
│   ├── app/          older structured package (+ /train); its weights are not included
│   └── Dockerfile
├── feedback-api/   Node/Express API, port 5000: auth (JWT), predictions (proxied to
│                   FastAPI), doctor directory, consultations (PDF + email), feedback
├── web/            React web app, port 5173: patients, doctors and the admin
│                   portal (/admin); same features as the mobile app
├── mobile/         Expo (React Native) app; talks to the Node API
├── docs/           E2E test plan, Postman collection
├── start-all.ps1   starts everything for local development (Windows)
└── docker-compose.yml
```

Request flow: web / mobile → Node API (:5000) → FastAPI (:8001, localhost only) and MongoDB.

---

## 1. Local development (without Docker)

On Windows, start everything with one command from the repo root:

```bash
powershell -ExecutionPolicy Bypass -File .\start-all.ps1
```

It opens a window per service and waits until the Node API has connected to MongoDB:

| Service | Folder | URL |
|---|---|---|
| FastAPI classifier | `backend/` | http://127.0.0.1:8001 (docs: `/docs`; localhost only) |
| Node API | `feedback-api/` | http://localhost:5000 (phones: `http://<PC-LAN-IP>:5000`) |
| Web app | `web/` | http://localhost:5173 (admin portal: `/admin`) |
| Expo mobile app | `mobile/` | QR code in its window |

Before the first run:

- `feedback-api/.env`: copy from `.env.example` and set `MONGODB_URI` and `JWT_SECRET`.
- `mobile/.env`: `EXPO_PUBLIC_NODE_API_URL=http://<PC-LAN-IP>:5000` (the script warns when your IP changes).
- `npm install` in `feedback-api/`, `web/` and `mobile/`; `backend/venv` with `pip install -r requirements.txt`.
- First admin: `cd feedback-api && npm run create-admin -- you@example.com "StrongPass123" "Admin"`.

The web app's dev server proxies `/api` and `/uploads` to the Node API
(`VITE_NODE_API_PROXY_TARGET` in `web/.env`); it never calls FastAPI directly.

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

Three containers (see `docker-compose.yml`):

| Service | URL | What it is |
|---|---|---|
| `web` | http://localhost:3000 (admin portal: `/admin`) | Web app for patients, doctors and admins (nginx) |
| `node-api` | http://localhost:5000 | Node API; the mobile app connects here (`http://<PC-LAN-IP>:5000`) |
| `backend` | internal only | FastAPI classifier (`backend/main.py`) with the models baked in |

The Node API reads its secrets (`MONGODB_URI`, `JWT_SECRET`, `SMTP_*`) from
`feedback-api/.env` at runtime, so create that file first (see
`feedback-api/.env.example`). Nothing secret is copied into the images.

```bash
docker compose up -d --build
```

Ports are configurable without editing the file, e.g.
`WEB_PORT=8081 NODE_API_PORT=5001 docker compose up -d`.

Useful commands:

```bash
docker compose logs -f node-api                     # API log (request ids, predictions, emails)
docker compose exec node-api npm run seed           # sample doctors + patient
docker compose exec node-api npm run create-admin -- admin@example.com "StrongPass123" "Admin"
docker compose exec node-api ls outbox              # emails saved when SMTP isn't configured
```

Uploaded lesion images and saved emails persist in the `node-uploads` and
`node-outbox` volumes. Model weights are part of the `backend` image: after
changing files in `backend/weights/`, rebuild with `docker compose build backend`.

To tear down:

```bash
docker compose down            # keep volumes
docker compose down -v         # also delete uploaded images and saved emails
```

> Upgrading from an older setup (separate `frontend` container): run
> `docker compose up -d --build --remove-orphans`, then optionally remove the
> unused `model-weights`, `training-data` and `checkpoints` volumes
> (`docker volume ls`, `docker volume rm <name>`).

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

# 3. Create feedback-api/.env (MONGODB_URI, JWT_SECRET, SMTP_*); models in
#    backend/weights/ are baked into the backend image at build time.

# 4. Build and launch
docker compose build
docker compose up -d

# 5. Open inbound firewall ports 3000 (web app) and 5000 (Node API, for the
#    mobile app), or place a reverse proxy / load balancer (e.g. Nginx, ALB)
#    in front. FastAPI is never exposed.
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
