# End-to-End Test Plan: SkinAI Pipeline

Manual checklist for the full flow on a real phone:
**Auth → Image upload → AI prediction → Teledermatology (PDF + email)**.

```
Phone (Expo Go) ──JWT──► Node API :5000 ──► FastAPI :8001 (localhost only)
                              │
                              ├──► MongoDB Atlas (users, predictions, consultations, flaggedpredictions)
                              └──► SMTP / feedback-api/outbox/*.eml
```

Every Node API log line looks like:

```
[2026-10-12T10:15:02.123Z] a1b2c3d4 POST /api/predictions 201 812ms user=66f0...
                           └ request id: shown in app error alerts as "Reference: a1b2c3d4"
```

---

## 0. Setup (once)

| ✓ | Step | Expected |
|---|------|----------|
| ☐ | `cd mobile` then `npm install`. | Done; packages match Expo SDK 57 (`npx expo install --check` reports nothing to fix). |
| ☐ | Find your PC's LAN IP: `ipconfig`, look for "IPv4 Address" (e.g. `192.168.1.20`). | |
| ☐ | Create `mobile/.env` from `mobile/.env.example` with `EXPO_PUBLIC_NODE_API_URL=http://<LAN-IP>:5000`. | Android emulator: `http://10.0.2.2:5000`. |
| ☐ | Phone and PC on the **same Wi-Fi** (not guest Wi-Fi, which usually isolates devices). | |
| ☐ | `cd feedback-api && npm run seed` | 3 Sri Lanka + 2 USA doctors and 1 patient seeded. |
| ☐ | `cd feedback-api && npm run create-admin -- you@example.com "StrongPass123" "Admin"` | `Admin ready: you@example.com` |
| ☐ | Start everything: `powershell -ExecutionPolicy Bypass -File .\start-all.ps1` | Four windows open. |
| ☐ | First run only: when Windows Firewall asks, allow **Node.js** on **Private networks**. | |

**Startup logs to check:**

- **Node API window:** `Connected to MongoDB (database: skin_disease)`, then
  `Node API listening on http://localhost:5000`, then `AI service at http://127.0.0.1:8001: healthy`.
  - `AI service … not reachable yet` is fine for a few seconds while FastAPI loads its models.
  - `[dns] OS resolver failed … using DNS-over-HTTPS` is normal on your network.
- **FastAPI window:** `Application startup complete` / `Uvicorn running on http://127.0.0.1:8001`, with **no** `InconsistentVersionWarning`.
- **From the phone's browser:** open `http://<LAN-IP>:5000/health`. You should see `{"status":"ok"}`.
  If not, the app won't connect either: check the IP, the Wi-Fi and the firewall.

---

## 1. Authentication (JWT)

| ✓ | Do this in the app | Expected in app | Backend log | MongoDB (Atlas → Browse Collections → `skin_disease`) |
|---|---|---|---|---|
| ☐ | Tap **Register as Patient**: name, a new email, 8+ char password, country *Sri Lanka*. | Lands on Home: "Hello, <name>". | `POST /api/auth/register/patient 201` | `users`: new doc, `role: "patient"`, `country: "Sri Lanka"`, `password` starts with `$2` (hashed). |
| ☐ | Tap **Log out**, then log in with a **wrong** password. | Inline "Incorrect email or password", no crash. | `POST /api/auth/login 401` | |
| ☐ | Log in correctly. | Home screen. | `POST /api/auth/login 200` | |
| ☐ | Fully close the app and reopen it. | Goes straight to Home ("Checking session…" briefly). The token was restored from secure storage. | `GET /api/auth/me 200` | |
| ☐ | **Register as Doctor**, then try to log in with that doctor account. | Alert "Pending Admin Approval". | `POST /api/auth/login 403` | `users`: `role: "doctor"`, `isApproved: false`. |
| ☐ | Stop the Node API window (Ctrl+C), then tap **Login**. | Alert "Can't connect … same Wi-Fi as your PC". The app stays responsive. Restart the API afterwards. | (none: the server is down) | |

## 2. Image capture and upload (multipart + JWT)

| ✓ | Do this | Expected in app | Backend log |
|---|---|---|---|
| ☐ | Tap **Camera**, take a photo, crop it. Do the same with **Gallery**. | A preview appears. | |
| ☐ | Deny camera permission once (system dialog). | "Permission is required…", no crash. | |
| ☐ | Tap **Analyse**. | Spinner, then the Result screen. | `[prediction] user=… <Disease> (xx.x%, <Risk> risk) id=…`, then `POST /api/predictions 201 …ms user=…` |

**In MongoDB, `predictions` collection:** a new doc with your `user` id, `label` (e.g. `bcc`),
`displayName`, `confidence`, `riskLevel` and `imageUrl`.
**On disk:** a matching `feedback-api/uploads/<sha256>.jpg` exists.

**If it fails:**

- `401` in the log: the token isn't attached. All requests go through `mobile/src/api/client.js`, so check `setAuthToken` is called on login.
- `400 "image is required"`: the FormData part isn't named `image`, or a manual `Content-Type` header removed the multipart boundary. `client.js` must not set Content-Type for FormData.
- `503 "AI service is not available"`: FastAPI isn't running on 127.0.0.1:8001.

## 3. AI prediction and result display

| ✓ | Check | Expected |
|---|---|---|
| ☐ | Result screen | Photo, disease name, a coloured **High / Moderate / Low Risk** badge and confidence %. |
| ☐ | Stop FastAPI, then tap **Analyse**. | Alert "Analysis failed: The AI service is not available right now…". The log shows `[ai] FastAPI unreachable` and `POST /api/predictions 503`. Restart FastAPI afterwards. |
| ☐ | Analyse a photo of a non-skin object. | Either a normal result or the "doesn't look like a skin lesion" message, depending on the model's OOD check; never a crash. |
| ☐ | Patient: **Report Incorrect Result** → **Report**. | "Thank you" alert. Log: `POST /api/feedback/report 201`. MongoDB `flaggedpredictions`: `imageUrl` and `aiPrediction` copied from the stored prediction. |

## 4. Teledermatology (doctor, PDF, email)

| ✓ | Do this | Expected |
|---|---|---|
| ☐ | On the Result screen tap **Get Doctor's Opinion**. | "Doctors in Sri Lanka (3)", showing the seeded Sri Lankan doctors only. Log: `GET /api/doctors/by-country/Sri%20Lanka 200`. |
| ☐ | Pick a doctor, fill in the medical history, tap **Send report to …**. | Alert "Report sent to Dr. … A copy was sent to <your email>." You return to the Result screen. |
| ☐ | Backend log | `[consultation] user=… -> <doctor email> (<Disease>, <Risk>) email=sent id=…`, then `POST /api/consultations 201`. |
| ☐ | MongoDB `consultations` | `prediction` = the id from step 2, `emailStatus: "sent"`, `riskLevel`, `medicalHistory` snapshot. |
| ☐ | MongoDB `users` (your patient) | `medicalHistory` updated with what you entered. |
| ☐ | Email | With no SMTP configured: a new `feedback-api/outbox/<timestamp>-consultation.eml`. Open it in Outlook or Thunderbird: To = doctor, Cc = you, PDF attached. With SMTP: check the inbox of the address you registered with (the doctor's copy goes to `@example.com`, which is never delivered). |
| ☐ | PDF | Patient details, "<Disease> - <Risk> Risk", the photo, the medical history and a disclaimer. |
| ☐ | Open **Get Doctor's Opinion** again, then turn on airplane mode before tapping Send. | Alert "Report not sent: Can't reach the server…". Nothing is saved twice. |

## 5. Admin and session checks

| ✓ | Do this | Expected |
|---|---|---|
| ☐ | Browser: `http://localhost:5173`, log in as the admin, tap **Admin portal** (or open `/admin`). | **Doctor approvals** lists the doctor from step 1. Approve them. |
| ☐ | Log in on the phone as that doctor. | Works now; the Result screen shows the ground-truth label picker. |
| ☐ | Browser: **Expert review queue**. | The flagged report from step 3 is listed with its image. |
| ☐ | Session expiry: in `feedback-api/.env` set `JWT_EXPIRES_IN=1m`, restart the API, log in, wait 2 minutes, then tap **Analyse**. | The app returns to the Login screen by itself with no error dialog. Log: `401`. **Set it back to `7d` afterwards.** |

---

## Automated checks

- Backend: the pipeline was verified with 43 automated end-to-end checks (auth, JWT, multipart → FastAPI → MongoDB, teledermatology by `predictionId`, error handling, CORS).
- Mobile build: `cd mobile && npx expo export --platform android` must finish with `Android Bundled … index.js` and a `.hbc` bundle.

## Troubleshooting quick reference

| Symptom | Likely cause |
|---|---|
| App: "Can't reach the server at http://localhost:5000" | `mobile/.env` missing; restart Expo with `npx expo start -c` after creating it. |
| App: "Can't reach the server at http://192.168…" | Different Wi-Fi, the firewall is blocking Node, or the IP changed (check `ipconfig`). |
| Expo Go: "Project is incompatible with this version of Expo Go" | Update Expo Go, or run `npx expo install --fix` in `mobile/`. |
| Browser console: CORS error | Add the page's origin to `CORS_ORIGINS` in `feedback-api/.env`; the API logs `[cors] Blocked browser origin …`. |
| `500` with "Reference: abcd1234" in the app | Search the Node API window for `abcd1234` to find the full stack trace. |
