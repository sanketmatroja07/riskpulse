# Deploy RiskPulse (Vercel + Railway)

This guide deploys the **Next.js** frontend to [Vercel](https://vercel.com) and the **FastAPI** API (plus **PostgreSQL**, **Redis**, and an optional **worker**) to [Railway](https://railway.app). Same pattern works on Render/Fly with small changes.

## What you need

- GitHub repo pushed (e.g. `sanketmatroja07/riskpulse`)
- Accounts on Vercel and Railway (both have free tiers)

---

## Part 1 — Railway (API + database + Redis)

### 1. Create a project

1. Open [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select **riskpulse**.
2. **Important — root directory:** open the API service → **Settings** → **Root Directory** and leave it **empty** (repo root `/`). This repo ships **`railway.toml`** at the top level and **`apps/api/Dockerfile`** with `COPY apps/api/...` paths. If you set Root Directory to `apps/api`, Railpack runs from the wrong context and fails (e.g. “start.sh not found” / “could not determine how to build”).
3. Confirm **Build** uses **Dockerfile**: Settings → Build → Builder should be **Dockerfile** (driven by `railway.toml`).

### 2. Add PostgreSQL

1. In the project → **New** → **Database** → **PostgreSQL**.
2. Railway injects **`DATABASE_URL`** into services in the same project. Link it to your API service:
   - Open the **Postgres** plugin → **Variables** → **Reference** (or connect the API service to the database from the Postgres **Connect** tab so `DATABASE_URL` appears on the API).

### 3. Add Redis (recommended)

1. **New** → **Database** → **Redis** (or use [Upstash](https://upstash.com) and paste `REDIS_URL` manually).
2. Ensure **`REDIS_URL`** is available to the API service (same project / shared variables).

### 4. API service variables

On the **API** service (**apps/api**), set:

| Variable | Example | Notes |
|----------|---------|--------|
| `MODE` | `production` | Recommended for prod |
| `JWT_SECRET` | long random string | `openssl rand -hex 32` |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | **Your Vercel URL** (add `https://www...` if you use a custom domain) |
| `BASE_URL` | `https://xxxx.up.railway.app` | Public API URL Railway assigns |
| `FRONTEND_URL` | `https://your-app.vercel.app` | Same as Vercel site |
| `LLM_PROVIDER` | `local` | Or `openai` / `anthropic` + API keys |

`DATABASE_URL` and `REDIS_URL` usually come from Railway plugins (reference them if needed).

**Do not commit real secrets** — set them only in Railway.

### 5. Deploy the API

- **Build**: Root **`railway.toml`** sets **`builder = DOCKERFILE`** and **`dockerfilePath = apps/api/Dockerfile`**. The Dockerfile expects the build context to be the **repo root** (see `COPY apps/api/...`).
- **Start**: `apps/api/start.sh` runs the seed (idempotent) then `uvicorn` on `$PORT`.
- After deploy, open **`https://<your-railway-domain>/docs`** — you should see Swagger.

Copy your API’s public HTTPS URL (e.g. `https://riskpulse-api-production.up.railway.app`).

### 6. Worker (optional, background jobs)

1. **New** → **Empty service** → **Connect repo** → same `riskpulse` repo.
2. **Settings** → **Root Directory** → **empty** (same as API).
3. **Build** → same as API: **Dockerfile** path `apps/api/Dockerfile`, Root Directory **empty**.
4. **Deploy** → **Custom start command** (overrides the API’s `start.sh`):
   ```bash
   python workers/worker_main.py
   ```
5. Copy the **same** env vars as the API (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `MODE`, etc.) or use **Shared Variables** in Railway.

---

## Part 2 — Vercel (Next.js)

### 1. Import the project

1. [vercel.com/new](https://vercel.com/new) → Import **riskpulse**.
2. **Root Directory**: `apps/web` (critical).
3. Framework: Next.js (auto-detected).

### 2. Environment variables (Production)

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_API_URL` | Your Railway API URL, e.g. `https://xxxx.up.railway.app` |

No trailing slash. Redeploy after changing this (Next bakes public env at build time).

### 3. Deploy

Click **Deploy**. When it finishes, open the **.vercel.app** URL.

### 4. CORS

If the UI loads but API calls fail with CORS errors, add your exact Vercel URL to Railway **`CORS_ORIGINS`** (comma-separated, no spaces), redeploy API.

---

## Demo login (after seed)

Same as local:

- `admin@riskpulse.io` / `riskpulse123`
- (See `README.md` for other roles.)

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| “Railpack could not determine how to build” / “start.sh not found” | Service **Root Directory** must be **empty** (not `apps/api`). Use repo-root `railway.toml` + `apps/api/Dockerfile`. |
| API 502 / crash | Railway **Deploy Logs**; ensure `DATABASE_URL` is set and Postgres is running |
| CORS errors in browser | `CORS_ORIGINS` must include your Vercel `https://...` URL exactly |
| Login / API fails from Vercel | `NEXT_PUBLIC_API_URL` must match Railway URL; redeploy Vercel after changing it |
| Empty database | `start.sh` runs `seed/seed_data.py` on boot; check API logs for seed output |

---

## Alternative: all-in-one with Docker

If you prefer a single VM or Docker host, use `docker compose up` with production env files and a reverse proxy (Caddy/NGINX) for HTTPS — not covered here, but `docker-compose.yml` is the starting point.
